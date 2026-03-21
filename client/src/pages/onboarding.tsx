import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m, useIsPresent } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { AuraShell } from '../components/layout/AuraShell';
import { ActionButton, TextButton } from '../components/ui/action-button';
import { spring, tapMotionProps, withReducedMotion } from '../lib/motion';
import { usePrefersReducedMotion } from '../lib/use-prefers-reduced-motion';
import type {
  WritingStyle,
  JournalTopic,
  NarrativeVoice,
  EmotionalDepth,
  PersonalityTag,
  MBTIType,
  Occupation,
  DailyPerson,
  DailyActivity,
} from '../types';

// ─── Constants ───

const TOTAL_STEPS = 11;

const WRITING_SAMPLES: Record<WritingStyle, string> = {
  poetic: 'The morning light whispered through the curtains...',
  casual: 'Grabbed coffee, hit the gym, pretty solid morning.',
  reflective: 'I noticed something shift in me today...',
  witty: 'Survived another Monday. Barely. The coffee deserves a medal.',
};

const STYLE_PREVIEWS: Record<WritingStyle, Record<NarrativeVoice, string>> = {
  poetic: {
    first_person:
      'I moved through the day like it was stitched together by little glints of light, each moment leaving a trace I wanted to keep.',
    second_person:
      'You moved through the day like it was stitched together by little glints of light, each moment leaving a trace you wanted to keep.',
    third_person:
      'They moved through the day like it was stitched together by little glints of light, each moment leaving a trace they wanted to keep.',
  },
  casual: {
    first_person:
      'I had one of those days that only made sense once I looked back at it. Nothing huge, just a bunch of small things that somehow landed right.',
    second_person:
      'You had one of those days that only made sense once you looked back at it. Nothing huge, just a bunch of small things that somehow landed right.',
    third_person:
      'They had one of those days that only made sense once they looked back at it. Nothing huge, just a bunch of small things that somehow landed right.',
  },
  reflective: {
    first_person:
      'I kept circling the same thought all day: maybe meaning lives in the details I almost miss. The more I paid attention, the more the day opened up.',
    second_person:
      'You kept circling the same thought all day: maybe meaning lives in the details you almost miss. The more you paid attention, the more the day opened up.',
    third_person:
      'They kept circling the same thought all day: maybe meaning lives in the details they almost miss. The more they paid attention, the more the day opened up.',
  },
  witty: {
    first_person:
      'I spent the day pretending I had everything under control, which was brave of me. Somehow the chaos still turned into a story worth keeping.',
    second_person:
      'You spent the day pretending you had everything under control, which was brave of you. Somehow the chaos still turned into a story worth keeping.',
    third_person:
      'They spent the day pretending they had everything under control, which was brave of them. Somehow the chaos still turned into a story worth keeping.',
  },
};

const ALL_MBTI: MBTIType[] = [
  'INTJ','INTP','ENTJ','ENTP',
  'INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ',
  'ISTP','ISFP','ESTP','ESFP',
];

const PERSONALITY_OPTIONS: { label: string; value: PersonalityTag }[] = [
  { label: 'Introvert', value: 'introvert' },
  { label: 'Extrovert', value: 'extrovert' },
  { label: 'Night owl', value: 'night-owl' },
  { label: 'Early bird', value: 'early-bird' },
  { label: 'Coffee lover', value: 'coffee-lover' },
  { label: 'Foodie', value: 'foodie' },
  { label: 'Tech nerd', value: 'tech-nerd' },
  { label: 'Creative', value: 'creative' },
  { label: 'Adventurous', value: 'adventurous' },
  { label: 'Homebody', value: 'homebody' },
  { label: 'Overthinker', value: 'overthinker' },
  { label: 'Optimist', value: 'optimist' },
];

const PEOPLE_OPTIONS: { label: string; value: DailyPerson }[] = [
  { label: 'Partner / spouse', value: 'partner' },
  { label: 'Close friends', value: 'close-friends' },
  { label: 'Family', value: 'family' },
  { label: 'Coworkers / classmates', value: 'coworkers' },
  { label: 'Mostly solo', value: 'mostly-solo' },
  { label: 'Pets', value: 'pets' },
];

const ACTIVITY_OPTIONS: { label: string; value: DailyActivity }[] = [
  { label: 'Work / school', value: 'work-school' },
  { label: 'Cooking', value: 'cooking' },
  { label: 'Exercise', value: 'exercise' },
  { label: 'Reading', value: 'reading' },
  { label: 'Music / art', value: 'music-art' },
  { label: 'Gaming', value: 'gaming' },
  { label: 'Nature', value: 'nature' },
  { label: 'Café culture', value: 'cafe-culture' },
  { label: 'Side projects', value: 'side-projects' },
  { label: 'Travel', value: 'travel' },
  { label: 'Socializing', value: 'socializing' },
  { label: 'Self-care', value: 'self-care' },
];

// ─── Persona state ───

interface PersonaState {
  writing_style: WritingStyle | null;
  journal_topics: JournalTopic[];
  narrative_voice: NarrativeVoice | null;
  emotional_depth: EmotionalDepth | null;
  personality_tags: PersonalityTag[];
  mbti: MBTIType | null;
  occupation: Occupation | null;
  daily_people: DailyPerson[];
  daily_activities: DailyActivity[];
  additional_context: string | null;
}

const initialPersona: PersonaState = {
  writing_style: null,
  journal_topics: [],
  narrative_voice: null,
  emotional_depth: null,
  personality_tags: [],
  mbti: null,
  occupation: null,
  daily_people: [],
  daily_activities: [],
  additional_context: null,
};

// ─── Component ───

export function OnboardingPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState<PersonaState>(initialPersona);
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward');
  const [stepFrameHeight, setStepFrameHeight] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextText, setContextText] = useState('');

  const goTo = useCallback(
    (next: number) => {
      if (transitioning || next < 0 || next >= TOTAL_STEPS) return;
      setAnimDir(next > step ? 'forward' : 'back');
      setTransitioning(true);
      setStep(next);
    },
    [step, transitioning]
  );

  const next = () => goTo(step + 1);
  const back = () => goTo(step - 1);

  // ─── Helpers ───

  function toggleMulti<T>(arr: T[], val: T, max?: number): T[] {
    if (arr.includes(val)) return arr.filter((v) => v !== val);
    if (max && arr.length >= max) return arr;
    return [...arr, val];
  }

  // ─── Can proceed? ───

  function canProceed(): boolean {
    switch (step) {
      case 0: return persona.writing_style !== null;
      case 1: return persona.journal_topics.length >= 1 && persona.journal_topics.length <= 3;
      case 2: return persona.narrative_voice !== null;
      case 3: return persona.emotional_depth !== null;
      case 4: return persona.personality_tags.length >= 2;
      case 5: return true; // mbti can be skipped
      case 6: return persona.occupation !== null;
      case 7: return persona.daily_people.length >= 1;
      case 8: return persona.daily_activities.length >= 1;
      case 9: return true; // context is optional
      case 10: return true; // confirmation
      default: return false;
    }
  }

  // ─── Submit ───

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      await api.persona.create({
        writing_style: persona.writing_style,
        journal_topics: persona.journal_topics,
        narrative_voice: persona.narrative_voice,
        emotional_depth: persona.emotional_depth,
        personality_tags: persona.personality_tags,
        mbti: persona.mbti,
        occupation: persona.occupation,
        daily_people: persona.daily_people,
        daily_activities: persona.daily_activities,
        additional_context: persona.additional_context,
      });
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'something went wrong. try again.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function getPreviewText(): string {
    const style = persona.writing_style ?? 'reflective';
    const voice = persona.narrative_voice ?? 'first_person';
    const base = STYLE_PREVIEWS[style][voice];

    if (!persona.mbti) {
      return base;
    }

    return `${base} It has that ${persona.mbti} kind of texture too: a voice shaped by how ${voice === 'first_person' ? 'I' : voice === 'second_person' ? 'you' : 'they'} naturally process the world.`;
  }

  // ─── Step renderers ───

  function renderStep(): ReactNode {
    switch (step) {
      case 0:
        return (
          <StepShell question="how should your journal sound?">
            {(['poetic', 'casual', 'reflective', 'witty'] as WritingStyle[]).map((s) => (
              <TextLinkOption
                key={s}
                selected={persona.writing_style === s}
                onClick={() => setPersona((p) => ({ ...p, writing_style: s }))}
              >
                <span className="capitalize">{s}</span>
                <span className="block font-serif text-sm italic text-film-500 mt-1">
                  {WRITING_SAMPLES[s]}
                </span>
              </TextLinkOption>
            ))}
          </StepShell>
        );

      case 1:
        return (
          <StepShell question="what matters to you?">
            <p className="font-sans text-xs text-film-500 text-center mb-6">pick 1 to 3</p>
            <PillGroup>
              {(['emotions', 'events', 'growth', 'relationships', 'ideas', 'gratitude'] as JournalTopic[]).map(
                (t) => (
                  <Pill
                    key={t}
                    selected={persona.journal_topics.includes(t)}
                    disabled={false}
                    onClick={() =>
                      setPersona((p) => ({
                        ...p,
                        journal_topics: toggleMulti(p.journal_topics, t, 3),
                      }))
                    }
                  >
                    {t}
                  </Pill>
                )
              )}
            </PillGroup>
          </StepShell>
        );

      case 2:
        return (
          <StepShell question="how do you talk to yourself?">
            {([
              { label: 'First person — I went...', value: 'first_person' as NarrativeVoice },
              { label: 'Second person — You went...', value: 'second_person' as NarrativeVoice },
              { label: 'Third person — She went...', value: 'third_person' as NarrativeVoice },
            ]).map((o) => (
              <TextLinkOption
                key={o.value}
                selected={persona.narrative_voice === o.value}
                onClick={() => setPersona((p) => ({ ...p, narrative_voice: o.value }))}
              >
                {o.label}
              </TextLinkOption>
            ))}
          </StepShell>
        );

      case 3:
        return (
          <StepShell question="how deep should we go?">
            {([
              { label: 'Light — just the highlights', value: 'light' as EmotionalDepth },
              { label: 'Moderate — some feelings, some facts', value: 'moderate' as EmotionalDepth },
              { label: 'Deep — I want to actually reflect', value: 'deep' as EmotionalDepth },
            ]).map((o) => (
              <TextLinkOption
                key={o.value}
                selected={persona.emotional_depth === o.value}
                onClick={() => setPersona((p) => ({ ...p, emotional_depth: o.value }))}
              >
                {o.label}
              </TextLinkOption>
            ))}
          </StepShell>
        );

      case 4:
        return (
          <StepShell question="pick what fits you">
            <p className="font-sans text-xs text-film-500 text-center mb-6">pick 2 to 4</p>
            <PillGroup>
              {PERSONALITY_OPTIONS.map((o) => {
                const selected = persona.personality_tags.includes(o.value);
                const atMax = persona.personality_tags.length >= 4 && !selected;
                return (
                  <Pill
                    key={o.value}
                    selected={selected}
                    disabled={atMax}
                    onClick={() =>
                      setPersona((p) => ({
                        ...p,
                        personality_tags: toggleMulti(p.personality_tags, o.value, 4),
                      }))
                    }
                  >
                    {o.label}
                  </Pill>
                );
              })}
            </PillGroup>
          </StepShell>
        );

      case 5:
        return (
          <StepShell question="what's your MBTI type?">
            <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
              {ALL_MBTI.map((t) => (
                <m.button
                  key={t}
                  type="button"
                  onClick={() => setPersona((p) => ({ ...p, mbti: p.mbti === t ? null : t }))}
                  className={`rounded-2xl border py-2.5 text-center font-sans text-sm font-bold transition-[background-color,border-color,color,transform] duration-150 ${
                    persona.mbti === t
                      ? 'border-film-900 bg-film-900 text-abyss-900 shadow-[0_14px_32px_rgba(245,245,245,0.08)]'
                      : 'border-abyss-700 bg-abyss-900/60 text-film-900 hover:border-film-700 hover:bg-abyss-800/80'
                  }`}
                  {...tapMotionProps}
                >
                  {t}
                </m.button>
              ))}
            </div>
            <div className="mt-4 text-center">
              <TextButton
              onClick={() => {
                setPersona((p) => ({ ...p, mbti: null }));
                next();
              }}
              >
                I don't know / skip
              </TextButton>
            </div>
          </StepShell>
        );

      case 6:
        return (
          <StepShell question="what do you do?">
            {([
              { label: 'Student', value: 'student' as Occupation },
              { label: 'Working professional', value: 'professional' as Occupation },
              { label: 'Freelancer / creative', value: 'freelancer' as Occupation },
              { label: 'Between things right now', value: 'between' as Occupation },
              { label: 'Rather not say', value: 'skip' as Occupation },
            ]).map((o) => (
              <TextLinkOption
                key={o.value}
                selected={persona.occupation === o.value}
                onClick={() => setPersona((p) => ({ ...p, occupation: o.value }))}
              >
                {o.label}
              </TextLinkOption>
            ))}
          </StepShell>
        );

      case 7:
        return (
          <StepShell question="who's usually in your day?">
            <PillGroup>
              {PEOPLE_OPTIONS.map((o) => (
                <Pill
                  key={o.value}
                  selected={persona.daily_people.includes(o.value)}
                  disabled={false}
                  onClick={() =>
                    setPersona((p) => ({
                      ...p,
                      daily_people: toggleMulti(p.daily_people, o.value),
                    }))
                  }
                >
                  {o.label}
                </Pill>
              ))}
            </PillGroup>
          </StepShell>
        );

      case 8:
        return (
          <StepShell question="what fills your days lately?">
            <p className="font-sans text-xs text-film-500 text-center mb-6">pick up to 4</p>
            <PillGroup>
              {ACTIVITY_OPTIONS.map((o) => {
                const selected = persona.daily_activities.includes(o.value);
                const atMax = persona.daily_activities.length >= 4 && !selected;
                return (
                  <Pill
                    key={o.value}
                    selected={selected}
                    disabled={atMax}
                    onClick={() =>
                      setPersona((p) => ({
                        ...p,
                        daily_activities: toggleMulti(p.daily_activities, o.value, 4),
                      }))
                    }
                  >
                    {o.label}
                  </Pill>
                );
              })}
            </PillGroup>
          </StepShell>
        );

      case 9:
        return (
          <StepShell question="tell the AI anything else">
            <p className="font-sans text-xs text-film-500 text-center mb-6">
              your name, vibe, current chapter — or skip
            </p>
            <textarea
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="e.g., I'm Tan, a CS student who lives on cà phê sữa đá..."
              className="min-h-[120px] w-full rounded-[22px] border border-abyss-700 bg-abyss-900/60 px-4 py-4 text-lg text-film-900 placeholder:text-film-500 focus:outline-none focus:border-film-700 resize-none font-serif transition-colors duration-200"
            />
            <div className="mt-4 text-center">
              <TextButton
              onClick={() => {
                setPersona((p) => ({ ...p, additional_context: null }));
                setContextText('');
                next();
              }}
              >
                skip
              </TextButton>
            </div>
          </StepShell>
        );

      case 10:
        return (
          <StepShell question="this is how your journal will sound">
            <p className="font-serif text-base leading-relaxed text-film-900 italic max-w-[85%] mx-auto text-center py-8 border-y border-abyss-600">
              {getPreviewText()}
            </p>
            {error && (
              <p className="font-sans text-sm text-aura-rough text-center mt-4">{error}</p>
            )}
          </StepShell>
        );

      default:
        return null;
    }
  }

  // ─── Handle "Next" press for steps with special pre-advance logic ───

  function handleNext() {
    if (step === 9 && contextText.trim()) {
      setPersona((p) => ({ ...p, additional_context: contextText.trim() }));
    }
    if (step === 10) {
      handleFinish();
      return;
    }
    next();
  }

  // ─── Render ───

  return (
    <AuraShell>
      <div className="min-h-screen flex flex-col px-5 safe-top safe-bottom">
        {/* Progress dots */}
        <div className="flex gap-2 items-center justify-center pb-5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'bg-film-900 scale-125'
                  : i < step
                    ? 'bg-film-700'
                    : 'bg-abyss-600'
              }`}
            />
          ))}
        </div>

        {/* Step content with animation */}
        <div className="flex-1 flex items-center">
          <m.div
            layout={!shouldReduceMotion}
            transition={withReducedMotion(Boolean(shouldReduceMotion), spring)}
            className="w-full overflow-hidden rounded-[28px] border border-abyss-700/80 bg-abyss-900/88 shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
          >
            <div className="border-b border-abyss-700/80 px-6 py-4">
              <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-film-500">
                step {step + 1} of {TOTAL_STEPS}
              </p>
            </div>

            <m.div
              layout={!shouldReduceMotion}
              transition={withReducedMotion(Boolean(shouldReduceMotion), spring)}
              className="relative overflow-hidden px-5 py-6"
              data-testid="survey-step-container"
              style={stepFrameHeight ? { minHeight: stepFrameHeight } : undefined}
            >
              <AnimatePresence
                initial={false}
                mode="sync"
                custom={animDir}
                onExitComplete={() => setTransitioning(false)}
              >
                <SurveyStepPanel
                  key={step}
                  direction={animDir}
                  onHeightChange={setStepFrameHeight}
                  shouldReduceMotion={Boolean(shouldReduceMotion)}
                >
                  {renderStep()}
                </SurveyStepPanel>
              </AnimatePresence>
            </m.div>
          </m.div>
        </div>

        {/* Navigation */}
        <div className="pt-6 space-y-3">
          <ActionButton
            disabled={!canProceed() || saving || transitioning}
            onClick={handleNext}
            pending={saving}
            pendingLabel="saving..."
            className="w-full"
          >
            {step === 10 ? "looks good, let's go" : 'next'}
          </ActionButton>
          {step > 0 && (
            <div className="text-center">
              <TextButton
                onClick={back}
                disabled={transitioning}
              >
                back
              </TextButton>
            </div>
          )}
        </div>
      </div>
    </AuraShell>
  );
}

// ─── Sub-components ───

function StepShell({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full">
      <h2 className="font-serif text-[2rem] font-medium leading-tight text-film-900 text-center mb-8">
        {question}
      </h2>
      {children}
    </div>
  );
}

function TextLinkOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-[22px] border px-4 py-4 text-left font-sans text-base transition-[background-color,border-color,color,transform] duration-150 ${
        selected
          ? 'border-film-900 bg-film-900 text-abyss-900 shadow-[0_18px_40px_rgba(245,245,245,0.08)]'
          : 'border-abyss-700 bg-abyss-900/55 text-film-900 hover:border-film-700 hover:bg-abyss-800/80'
      }`}
      {...tapMotionProps}
    >
      {children}
    </m.button>
  );
}

function PillGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-3 justify-center max-w-[90%] mx-auto">
      {children}
    </div>
  );
}

function Pill({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={`rounded-full border px-4 py-2.5 font-sans text-sm transition-[background-color,border-color,color,opacity,transform] duration-150 capitalize ${
        selected
          ? 'border-film-900 bg-film-900 text-abyss-900 shadow-[0_14px_32px_rgba(245,245,245,0.08)]'
          : disabled
            ? 'border-abyss-700 text-film-500 opacity-30 cursor-not-allowed pointer-events-none'
            : 'border-abyss-700 bg-abyss-900/60 text-film-900 hover:border-film-700 hover:bg-abyss-800/80'
      }`}
      {...tapMotionProps}
    >
      {children}
    </m.button>
  );
}

function SurveyStepPanel({
  direction,
  onHeightChange,
  shouldReduceMotion,
  children,
}: {
  direction: 'forward' | 'back';
  onHeightChange: (height: number) => void;
  shouldReduceMotion: boolean;
  children: ReactNode;
}) {
  const isPresent = useIsPresent();
  const panelRef = useRef<HTMLDivElement>(null);
  const stepVariants = getStepPanelVariants(shouldReduceMotion);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !isPresent) {
      return undefined;
    }

    const updateHeight = () => {
      onHeightChange(panel.getBoundingClientRect().height);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => updateHeight());
    resizeObserver.observe(panel);

    return () => resizeObserver.disconnect();
  }, [children, isPresent, onHeightChange]);

  return (
    <m.div
      ref={panelRef}
      custom={direction}
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={withReducedMotion(shouldReduceMotion, spring)}
      className="w-full"
      data-testid="survey-step-panel"
      style={{
        position: isPresent ? 'relative' : 'absolute',
        top: 0,
        left: 0,
        right: 0,
        pointerEvents: isPresent ? 'auto' : 'none',
      }}
      aria-hidden={!isPresent}
      tabIndex={isPresent ? undefined : -1}
    >
      {children}
    </m.div>
  );
}

function getStepPanelVariants(shouldReduceMotion: boolean) {
  if (shouldReduceMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }

  return {
    hidden: {
      opacity: 0,
      scale: 0.985,
      filter: 'blur(8px)',
    },
    visible: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
    },
    exit: {
      opacity: 0,
      scale: 1.01,
      filter: 'blur(6px)',
    },
  };
}
