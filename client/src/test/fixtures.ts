import type {
  JournalEntry,
  JournalEntryType,
  JournalStatus,
  MomentPhoto,
  MomentWithPhotos,
  Mood,
  Persona,
} from '../types';

const timestamp = '2026-03-22T12:00:00.000Z';

export function createMoment(overrides: Partial<MomentWithPhotos> = {}): MomentWithPhotos {
  const mood = overrides.mood ?? 'good';

  return {
    id: 'moment-1',
    user_id: 'user-1',
    day_date: '2026-03-22',
    order_index: 0,
    text_context: 'Captured moment',
    voice_transcript: null,
    mood,
    captured_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    photos: [
      createMomentPhoto({
        moment_id: 'moment-1',
        photo_url: 'https://example.com/photo.jpg',
      }),
    ],
    ...overrides,
  };
}

export function createMomentPhoto(overrides: Partial<MomentPhoto> = {}): MomentPhoto {
  return {
    id: 'photo-1',
    moment_id: 'moment-1',
    storage_path: 'moments/photo-1.jpg',
    photo_url: 'https://example.com/photo.jpg',
    order_index: 0,
    created_at: timestamp,
    ...overrides,
  };
}

export function createJournalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  const status: JournalStatus = overrides.status ?? 'draft';
  const entryType: JournalEntryType = overrides.entry_type ?? 'daily';

  return {
    id: 'journal-1',
    user_id: 'user-1',
    day_date: '2026-03-22',
    content: 'Captured details for the day.',
    generated_content: 'Captured details for the day.',
    status,
    entry_type: entryType,
    daily_achievement: 'A clear moment',
    best_photo_url: 'https://example.com/journal-photo.jpg',
    generated_at: timestamp,
    confirmed_at: status === 'confirmed' ? timestamp : null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

export function createPersona(overrides: Partial<Persona> = {}): Persona {
  return {
    id: 'persona-1',
    user_id: 'user-1',
    attention_filter: 'aesthetics',
    life_chapter: 'building',
    tone_preset: 'poetic',
    daily_people: ['mostly-solo'],
    additional_context: 'Testing context',
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
}

export function createJsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
  });
}

export function createEmptyResponse(init: ResponseInit = {}) {
  return new Response(null, {
    status: 204,
    ...init,
  });
}

export function createMockMomentSequence(count: number, mood: Mood = 'good') {
  return Array.from({ length: count }, (_, index) =>
    createMoment({
      id: `moment-${index + 1}`,
      order_index: index,
      mood,
      photos: [
        createMomentPhoto({
          id: `photo-${index + 1}`,
          moment_id: `moment-${index + 1}`,
          order_index: 0,
          photo_url: `https://example.com/photo-${index + 1}.jpg`,
        }),
      ],
    }),
  );
}
