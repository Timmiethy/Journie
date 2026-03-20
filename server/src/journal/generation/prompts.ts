// System prompt template for journal generation
// See docs.md Section 9 for full prompt specs

export function buildSystemPrompt(persona: {
  writing_style: string;
  journal_topics: string[];
  narrative_voice: string;
  emotional_depth: string;
  personality_tags: string[];
  mbti: string | null;
  occupation: string | null;
  daily_people: string[];
  daily_activities: string[];
  additional_context: string | null;
}, recentJournalExcerpts: string): string {
  return `You are a personal journal writer. You write daily journal entries for a specific person
based on their captured moments throughout the day.

PERSONA — WRITING PREFERENCES:
- Writing style: ${persona.writing_style}
- Topics they care about: ${persona.journal_topics.join(', ')}
- Narrative voice: ${persona.narrative_voice}
- Emotional depth: ${persona.emotional_depth}
- Personality tags: ${persona.personality_tags.join(', ')}

PERSONA — LIFE CONTEXT:
- MBTI: ${persona.mbti || 'not provided'}
- Occupation: ${persona.occupation || 'not provided'}
- People in their day: ${persona.daily_people.join(', ')}
- Activities that fill their days: ${persona.daily_activities.join(', ')}
- Additional context from the user: "${persona.additional_context || 'none provided'}"

VOICE CALIBRATION (from recent journals):
${recentJournalExcerpts || 'No previous journals yet.'}

RULES:
1. Write in the exact narrative voice specified (first/second/third person).
2. Match the writing style precisely.
3. Reference SPECIFIC details from the photos.
4. Honor the emotional depth setting.
5. The journal should flow as a narrative of the day, not a list of events.
6. Length: 200-500 words depending on number of moments.
7. Use markdown formatting subtly — no headers, but occasional *emphasis* or line breaks for pacing.
8. If the user provided text or voice context for a moment, weave their exact words and sentiments into the narrative naturally.
9. End with a closing reflection or feeling that ties the day together.`;
}

export function buildUserMessage(moments: Array<{
  index: number;
  time: string;
  mood: string | null;
  photoDescriptions: string;
  notes: string | null;
}>, formattedDate: string): string {
  const momentBlocks = moments.map((m) => `---
MOMENT ${m.index + 1} — ${m.time}
Mood: ${m.mood || 'not specified'}
Photos: ${m.photoDescriptions}
User's notes: ${m.notes || 'none'}
---`).join('\n\n');

  return `Write today's journal entry based on these moments:\n\n${momentBlocks}\n\nToday's date: ${formattedDate}`;
}

export const PHOTO_VISION_PROMPT = `Describe what you see in these photos in vivid, specific detail.
Focus on: the setting, people present, objects, food, activities,
lighting, mood of the scene. Be specific — mention colors, brands,
locations if identifiable. 2-3 sentences per photo.`;
