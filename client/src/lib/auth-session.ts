import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const AUTH_SESSION_RETRIES = 20;
const AUTH_SESSION_RETRY_MS = 150;

export async function getSessionWithRetry(): Promise<Session | null> {
  for (let attempt = 0; attempt < AUTH_SESSION_RETRIES; attempt += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      return session;
    }

    if (attempt < AUTH_SESSION_RETRIES - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, AUTH_SESSION_RETRY_MS));
    }
  }

  return null;
}

export async function getAccessTokenOrThrow(): Promise<string> {
  const session = await getSessionWithRetry();
  if (session?.access_token) {
    return session.access_token;
  }

  throw new Error('Not authenticated');
}
