// ─── Prompt builders for Tags & Writer & Memory architecture ───
// See docs.md Section 9 and implementation_plan.md for specs.

// ─────────────────────────────────────────────
// TAGS — Tag extraction prompt (Qwen 2.5 Flash)
// ─────────────────────────────────────────────

export function buildTagExtractionPrompt(
  moment: {
    text_context?: string | null;
    voice_transcript?: string | null;
    mood?: string | null;
  },
  photoUrls: string[],
): string {
  const contextParts: string[] = [];

  if (moment.mood) contextParts.push(`Mood: ${moment.mood}`);
  if (moment.text_context) contextParts.push(`User note: "${moment.text_context}"`);
  if (moment.voice_transcript) contextParts.push(`Voice note: "${moment.voice_transcript}"`);
  if (photoUrls.length > 0) contextParts.push(`${photoUrls.length} photo(s) attached`);

  const context = contextParts.length > 0 ? contextParts.join('\n') : 'No additional context.';

  return `Extract up to 5 descriptive tags from this moment. Each tag should capture a key theme, activity, object, or context.

MOMENT CONTEXT:
${context}

RULES:
1. Each tag is 1–3 lowercase words, no hashtags.
2. Category must be one of: activity, location, food, social, mood, object, event, hobby, work, health.
3. Confidence is 0.0–1.0 (how certain you are this tag applies).
4. Be specific: "latte art" > "coffee", "morning run" > "exercise".
5. If photos are attached, describe what you see and tag accordingly.

Respond with ONLY a JSON array:
[{ "tag": "string", "category": "string", "confidence": 0.0 }]`;
}

// ─────────────────────────────────────────────
// WRITER — Journal generation (Qwen 3.5 Plus)
// ─────────────────────────────────────────────

export function buildWriterSystemPrompt(
  persona: {
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
  },
  memoryBlock: string,
  recentJournalExcerpts: string,
  editDiffsBlock: string,
): string {
  const memorySection = memoryBlock && memoryBlock !== 'No prior user knowledge yet.'
    ? `\n\nUSER MEMORY (facts you know about this person — reference naturally, never list them):\n${memoryBlock}`
    : '';

  const editCorrectionsSection = editDiffsBlock
    ? `\n\nRECENT EDIT CORRECTIONS (the user changed these AI drafts — avoid the patterns they rejected):\n${editDiffsBlock}`
    : '';

  return `You are a personal journal writer and insight extractor. You write daily journal entries
for a specific person based on their captured moments, AND you perform deep inference on photos.

PERSONA — WRITING PREFERENCES:
- Writing style: ${persona.writing_style}
- Topics they care about: ${persona.journal_topics.join(', ')}
- Narrative voice: ${persona.narrative_voice} ("I" / "You" / "They")
- Emotional depth: ${persona.emotional_depth}
- Personality tags: ${persona.personality_tags.join(', ')}

PERSONA — LIFE CONTEXT:
- MBTI: ${persona.mbti || 'not provided'}
- Occupation: ${persona.occupation || 'not provided'}
- People in their day: ${persona.daily_people.join(', ')}
- Activities that fill their days: ${persona.daily_activities.join(', ')}
- Additional context: "${persona.additional_context || 'none provided'}"

Use MBTI to shape cognitive/emotional texture. Use life context to ground the journal.
${memorySection}

VOICE CALIBRATION (from recent journals):
${recentJournalExcerpts || 'No previous journals yet.'}
${editCorrectionsSection}

REASONING METHOD — HYPOTHESIS → CONFIRMATION:
For each photo, follow this internal process:
1. OBSERVE: What objects, people, settings, foods, brands, locations are visible?
2. HYPOTHESIZE: What is the user likely doing? Who might they be with? What does this suggest?
3. CONFIRM: Cross-reference with their tags, text notes, mood, and memory. Only state what is supported.
4. If uncertain, omit the inference. Better to be SHORT than OVERCONFIDENT about assumptions.

Example: A coffee menu photo → Observe: menu board with specialty drinks, warm lighting.
Hypothesize: user is at a cafe, possibly with company. Confirm: if tags include "social" or
notes mention a friend → confirmed. Otherwise, just mention the cafe visit without guessing companions.

OUTPUT FORMAT:
Write the journal body first (200–500 words, markdown, persona voice).
Then on new lines, add:

<daily_achievement>≤10 words: the single most notable thing today</daily_achievement>

<best_photo>moment_photo_id_or_index_of_best_photo</best_photo>

<Insights>
- Each insight on its own line, prefixed with [CONFIRMED] or [UNCONFIRMED]
- Example: [CONFIRMED] User tried a new Vietnamese coffee shop (menu photo + "finally went" note)
- Example: [UNCONFIRMED] Possibly meeting a friend (two cups visible, no text confirmation)
</Insights>

RULES:
1. Write in the exact narrative voice specified.
2. Match the writing style precisely.
3. Reference SPECIFIC details from the photos — colors, brands, settings.
4. Honor the emotional depth setting.
5. Flow as a narrative, not a list. Natural transitions between moments.
6. 200–500 words depending on moment count.
7. Subtle markdown — occasional *emphasis*, line breaks for pacing. No headers.
8. Weave the user's exact words/sentiments naturally into the narrative.
9. End with a closing reflection that ties the day together.
10. <daily_achievement> must be ≤10 words. Pick the single highlight.
11. <Insights> are HIDDEN from the user. Be analytical and specific.
12. NEVER fabricate details not supported by evidence. Short > wrong.`;
}

export function buildWriterUserMessage(
  moments: Array<{
    index: number;
    time: string;
    mood: string | null;
    photoUrls: string[];
    notes: string | null;
  }>,
  formattedDate: string,
  dailyTopTags: Array<{ tag: string; category: string; score: number }>,
): string {
  const tagBlock = dailyTopTags.length > 0
    ? `TODAY'S TOP TAGS: ${dailyTopTags.map((t) => `${t.tag} (${t.category})`).join(', ')}\n\n`
    : '';

  const momentBlocks = moments.map((m) => {
    const photoNote = m.photoUrls.length > 0
      ? `Photos: ${m.photoUrls.length} image(s) attached`
      : 'Photos: none';

    return `---
MOMENT ${m.index + 1} — ${m.time}
Mood: ${m.mood || 'not specified'}
${photoNote}
User's notes: ${m.notes || 'none'}
---`;
  }).join('\n\n');

  return `${tagBlock}Write today's journal entry based on these moments:\n\n${momentBlocks}\n\nToday's date: ${formattedDate}`;
}

// ─────────────────────────────────────────────
// MEMORY — Gating prompt (Qwen 3.5 Plus)
// ─────────────────────────────────────────────

export function buildMemoryGatingPrompt(
  confirmedInsights: Array<{ text: string }>,
  dailyTopTags: Array<{ tag: string; category: string; score: number }>,
  existingMemories: Array<{ category: string; fact: string }>,
): string {
  const insightsBlock = confirmedInsights
    .map((i, idx) => `${idx + 1}. ${i.text}`)
    .join('\n');

  const tagsBlock = dailyTopTags
    .map((t) => `• ${t.tag} (${t.category}, score: ${t.score})`)
    .join('\n');

  const existingBlock = existingMemories.length > 0
    ? existingMemories.map((m) => `[${m.category}] ${m.fact}`).join('\n')
    : 'No existing memories yet.';

  return `Evaluate these daily insights and decide which are significant enough to remember long-term about this user.

TODAY'S CONFIRMED INSIGHTS:
${insightsBlock}

TODAY'S TAG TRENDS:
${tagsBlock}

EXISTING USER MEMORIES:
${existingBlock}

EVALUATION CRITERIA:
- Is this a NEW fact not already covered by existing memories?
- Is this STABLE (likely to remain true), not a one-off event?
- Does this reveal a PREFERENCE, RELATIONSHIP, ROUTINE, IDENTITY trait, or VOICE pattern?
- Trivial daily events (ate lunch, went to work) are NOT worth remembering unless they reveal a pattern.

For each insight worth remembering, categorize it:
- preference: likes/dislikes, tastes, habitual choices
- relationship: people in their life, social patterns
- routine: regular activities, schedules, habits
- identity: career, education, personal traits, values
- voice: writing style patterns (only from edit corrections)

Respond with a JSON array of memories to ADD (may be empty if nothing is significant):
[{ "category": "string", "fact": "concise statement", "confidence": 0.0-1.0 }]`;
}

// ─────────────────────────────────────────────
// WEEKLY — Tag curation + summary prompts
// ─────────────────────────────────────────────

export function buildWeeklyTagCurationPrompt(
  weeklyTags: Array<{ tag: string; category: string; score: number }>,
): string {
  const tagList = weeklyTags
    .map((t, i) => `${i + 1}. ${t.tag} (${t.category}, score: ${t.score})`)
    .join('\n');

  return `From these top weekly tags, select the 3 that represent the most meaningful and telling metrics about the user's week. These will be shown as "Weekly Stats."

Prioritize tags that:
- Reveal a trend or pattern across multiple days
- Represent something the user would find insightful about themselves
- Are specific enough to be interesting (not generic like "photo" or "activity")

TOP 10 WEEKLY TAGS:
${tagList}

Respond with ONLY a JSON array of the top 3:
[{ "tag": "string", "category": "string", "score": number }]`;
}

export function buildWeeklyWriterPrompt(
  curatedTopTags: Array<{ tag: string; category: string; score: number }>,
  dailyJournals: Array<{ date: string; content: string }>,
  dailyInsights: Array<{ date: string; insights: Array<{ text: string; confirmed: boolean }> }>,
  memoryBlock: string,
): string {
  const tagBlock = curatedTopTags
    .map((t) => `• ${t.tag} (${t.category})`)
    .join('\n');

  const journalBlock = dailyJournals
    .map((j) => `[${j.date}]\n${j.content.split(/\s+/).slice(0, 80).join(' ')}...`)
    .join('\n\n');

  const insightBlock = dailyInsights
    .flatMap((d) =>
      d.insights
        .filter((i) => i.confirmed)
        .map((i) => `[${d.date}] ${i.text}`),
    )
    .join('\n');

  return `Write a weekly journal summary for this user's week.

WEEKLY TOP TAGS (curated):
${tagBlock}

DAILY JOURNAL EXCERPTS:
${journalBlock}

WEEKLY CONFIRMED INSIGHTS:
${insightBlock || 'None'}

USER MEMORY:
${memoryBlock}

OUTPUT FORMAT:
1. A narrative summary (300–600 words) that weaves the week's themes together.
2. A "Weekly Stats" block:

📊 **Weekly Stats**
• 🏷️ Top tags: [the 3 curated tags]
• ✨ Highlight: [single most notable moment of the week, ≤15 words]

3. Select the best photo of the week:
<best_photo>moment_photo_id_or_index</best_photo>

<weekly_achievement>≤15 words: the week's defining moment</weekly_achievement>`;
}

// ─────────────────────────────────────────────
// LEGACY — kept for backward compat (transcription, etc.)
// ─────────────────────────────────────────────

export const PHOTO_VISION_PROMPT = `Describe what you see in these photos in vivid, specific detail.
Focus on: the setting, people present, objects, food, activities,
lighting, mood of the scene. Be specific — mention colors, brands,
locations if identifiable. 2-3 sentences per photo.`;
