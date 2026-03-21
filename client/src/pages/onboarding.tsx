import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m, useIsPresent } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { AuraShell } from '../components/layout/AuraShell';
import { TextButton } from '../components/ui/action-button';
import { spring, tapMotionProps, withReducedMotion } from '../lib/motion';
import { usePrefersReducedMotion } from '../lib/use-prefers-reduced-motion';
import type { AttentionFilter, LifeChapter, TonePreset, DailyPerson } from '../types';

// ─── Constants ───

const TOTAL_STEPS = 5;

const ATTENTION_OPTIONS: { label: string; description: string; value: AttentionFilter }[] = [
  {
    label: 'Unhinged memes & random screenshots',
    description: 'Digital chaos, humor, and internet culture',
    value: 'memes',
  },
  {
    label: 'Blurry nights & people I love',
    description: 'Candid moments with the people who matter',
    value: 'people',
  },
  {
    label: 'Quiet aesthetics',
    description: 'Skies, coffee cups, street lamps, textures',
    value: 'aesthetics',
  },
  {
    label: 'Mostly just me',
    description: 'Self-portraits, mirror selfies, main character energy',
    value: 'selfies',
  },
];

const CHAPTER_OPTIONS: { label: string; value: LifeChapter }[] = [
  { label: '"Under construction."', value: 'building' },
  { label: '"Cruising."', value: 'cruising' },
  { label: '"Chaotic, but we\'re surviving."', value: 'chaos' },
  { label: '"Waiting for the plot twist."', value: 'waiting' },
];

const TONE_OPTIONS: { label: string; description: string; value: TonePreset }[] = [
  { label: 'Make it poetic and deep.', description: 'Romanticizes the mundane', value: 'poetic' },
  { label: 'Keep it stoic and real.', description: 'Observational, grounded', value: 'stoic' },
  { label: 'Roast me slightly.', description: 'Highly ironic, Gen-Z humor', value: 'roast' },
  { label: 'Just hype me up.', description: 'Optimistic, supportive', value: 'hype' },
];

const PEOPLE_OPTIONS: { label: string; value: DailyPerson }[] = [
  { label: 'Partner / spouse', value: 'partner' },
  { label: 'Close friends', value: 'close-friends' },
  { label: 'Family', value: 'family' },
  { label: 'Coworkers / classmates', value: 'coworkers' },
  { label: 'Mostly solo', value: 'mostly-solo' },
  { label: 'Pets', value: 'pets' },
];

const ATTENTION_PREVIEW_LABELS: Record<AttentionFilter, string> = {
  memes: 'the screenshots, memes, and digital chaos',
  people: 'the people-heavy, candid moments',
  aesthetics: 'the quiet objects, textures, and atmosphere',
  selfies: 'the self-portraits and self-aware snapshots',
};

const CHAPTER_PREVIEW_LABELS: Record<LifeChapter, string> = {
  building: 'evidence that I am still building something',
  cruising: 'proof that steady days can still feel full',
  chaos: 'a messy chapter I am still surviving',
  waiting: 'the stillness right before something shifts',
};

const TONE_PREVIEW_OPENERS: Record<TonePreset, string> = {
  poetic: 'The journal will romanticize',
  stoic: 'The journal will notice',
  roast: 'The journal will lightly roast',
  hype: 'The journal will celebrate',
};

// ─── Persona state ───

interface PersonaState {
  attention_filter: AttentionFilter | null;
  life_chapter: LifeChapter | null;
  tone_preset: TonePreset | null;
  daily_people: DailyPerson[];
  additional_context: string | null;
}

const initialPersona: PersonaState = {
  attention_filter: null,
  life_chapter: null,
  tone_preset: null,
  daily_people: [],
  additional_context: null,
};

function buildPersonaPreview(persona: PersonaState) {
  if (!persona.attention_filter || !persona.life_chapter || !persona.tone_preset) {
    return null;
  }

  return `${TONE_PREVIEW_OPENERS[persona.tone_preset]} ${ATTENTION_PREVIEW_LABELS[persona.attention_filter]} and frame this chapter as ${CHAPTER_PREVIEW_LABELS[persona.life_chapter]}.`;
}

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

  function toggleMulti<T>(arr: T[], val: T): T[] {
    if (arr.includes(val)) return arr.filter((v) => v !== val);
    return [...arr, val];
  }

  // ─── Can proceed? ───

  function canProceed(): boolean {
    switch (step) {
      case 0: return persona.attention_filter !== null;
      case 1: return persona.life_chapter !== null;
      case 2: return persona.tone_preset !== null;
      case 3: return persona.daily_people.length >= 1;
      case 4: return true; // context is optional, this is also the finish step
      default: return false;
    }
  }

  // ─── Submit ───

  async function handleFinish(additionalContext: string | null) {
    setSaving(true);
    setError(null);
    try {
      await api.persona.create({
        attention_filter: persona.attention_filter,
        life_chapter: persona.life_chapter,
        tone_preset: persona.tone_preset,
        daily_people: persona.daily_people,
        additional_context: additionalContext,
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

  // ─── Step renderers ───

  function renderStep(): ReactNode {
    const personaPreview = buildPersonaPreview(persona);

    switch (step) {
      // Q1: Attention Filter
      case 0:
        return (
          <StepShell question="if we opened your camera roll right now, what takes up the most space?">
            <div className="flex w-full flex-col gap-6">
              {ATTENTION_OPTIONS.map((o) => (
                <EditorialOption
                  key={o.value}
                  selected={persona.attention_filter === o.value}
                  onClick={() => setPersona((p) => ({ ...p, attention_filter: o.value }))}
                  title={o.label}
                  description={o.description}
                />
              ))}
            </div>
          </StepShell>
        );

      // Q2: Emotional Anchor / Life Chapter
      case 1:
        return (
          <StepShell question="how does this chapter of your life feel?">
            <div className="flex w-full flex-col gap-6">
              {CHAPTER_OPTIONS.map((o) => (
                <EditorialOption
                  key={o.value}
                  selected={persona.life_chapter === o.value}
                  onClick={() => setPersona((p) => ({ ...p, life_chapter: o.value }))}
                  title={o.label}
                  titleClassName="font-serif text-xl italic text-film-900"
                />
              ))}
            </div>
          </StepShell>
        );

      // Q3: Tone / System Prompt
      case 2:
        return (
          <StepShell question="how should the AI sound?">
            <div className="flex w-full flex-col gap-6">
              {TONE_OPTIONS.map((o) => (
                <EditorialOption
                  key={o.value}
                  selected={persona.tone_preset === o.value}
                  onClick={() => setPersona((p) => ({ ...p, tone_preset: o.value }))}
                  title={o.label}
                  description={o.description}
                />
              ))}
            </div>
          </StepShell>
        );

      // Q4: Daily People (kept)
      case 3:
        return (
          <StepShell question="who's usually in your day?">
            <div className="flex w-full flex-col gap-6">
              {PEOPLE_OPTIONS.map((o) => (
                <EditorialOption
                  key={o.value}
                  selected={persona.daily_people.includes(o.value)}
                  onClick={() =>
                    setPersona((p) => ({
                      ...p,
                      daily_people: toggleMulti(p.daily_people, o.value),
                    }))
                  }
                  title={o.label}
                />
              ))}
            </div>
          </StepShell>
        );

      // Q5: Additional Context + Preview + Finish
      case 4:
        return (
          <StepShell question="tell the AI anything else">
            <p className="font-sans text-xs uppercase tracking-[0.2em] text-film-500">
              optional context for the voice
            </p>
            <textarea
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="e.g., I'm Tan, a CS student who lives on cà phê sữa đá..."
              className="mt-6 min-h-[120px] w-full resize-none border-none bg-transparent p-0 font-serif text-2xl leading-[1.6] text-film-900 placeholder:text-film-700/50 focus:outline-none"
            />
            {personaPreview && (
              <div className="mt-8 border-t border-white/6 pt-6">
                <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-film-500">
                  preview
                </p>
                <p className="mt-3 max-w-[90%] font-serif text-lg italic leading-[1.7] text-film-900">
                  {personaPreview}
                </p>
              </div>
            )}
            {error && (
              <p className="mt-4 font-sans text-sm text-aura-rough">{error}</p>
            )}
          </StepShell>
        );

      default:
        return null;
    }
  }

  // ─── Handle "Next" press ───

  function handleNext() {
    if (step === 4) {
      const additionalContext = contextText.trim() || null;
      void handleFinish(additionalContext);
      return;
    }
    next();
  }

  // ─── Render ───

  return (
    <AuraShell>
      <div className="flex min-h-screen flex-col px-6 safe-top safe-bottom">
        <div className="pt-4">
          <p
            data-testid="onboarding-step-label"
            className="font-sans text-[10px] uppercase tracking-[0.2em] text-film-700"
          >
            step {step + 1} of {TOTAL_STEPS}
          </p>
        </div>

        <div className="flex flex-1 flex-col pt-10">
          <m.div
            layout={!shouldReduceMotion}
            transition={withReducedMotion(Boolean(shouldReduceMotion), spring)}
            className="relative flex-1 overflow-hidden"
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
        </div>

        <div className="flex items-center justify-between pb-4 pt-6">
          {step > 0 ? (
            <TextButton
              onClick={back}
              disabled={transitioning}
              className="text-xs uppercase tracking-[0.18em] no-underline"
            >
              back
            </TextButton>
          ) : (
            <div className="w-16" aria-hidden="true" />
          )}
          <m.button
            type="button"
            disabled={!canProceed() || saving || transitioning}
            onClick={handleNext}
            data-testid="onboarding-next-button"
            className={`font-sans text-sm uppercase tracking-[0.24em] transition-colors duration-200 ${
              !canProceed() || saving || transitioning
                ? 'cursor-not-allowed text-film-700/35'
                : 'text-film-900 hover:text-white'
            }`}
            {...tapMotionProps}
          >
            {step === 4 ? (saving ? 'entering...' : 'enter journie') : 'next'}
          </m.button>
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
    <div className="mx-auto flex w-full flex-col justify-center py-2">
      <h2 className="max-w-[90%] font-serif text-3xl leading-snug text-film-900 sm:text-[2.15rem]">
        {question}
      </h2>
      <div className="mt-10 w-full">
        {children}
      </div>
    </div>
  );
}

function EditorialOption({
  selected,
  onClick,
  title,
  description,
  titleClassName = 'font-sans text-lg text-film-900',
  descriptionClassName = 'mt-1 block font-serif text-sm italic text-film-700',
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group w-full text-left transition-opacity duration-300 ${
        selected
          ? 'opacity-100'
          : 'opacity-50 hover:opacity-100'
      }`}
      {...tapMotionProps}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`mt-3 h-px shrink-0 transition-all duration-300 ${
            selected
              ? 'w-7 bg-film-900'
              : 'w-5 bg-film-700/35 group-hover:bg-film-500/60'
          }`}
        />
        <div className="min-w-0">
          <span className={titleClassName}>{title}</span>
          {description ? (
            <span className={descriptionClassName}>
              {description}
            </span>
          ) : null}
        </div>
      </div>
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
