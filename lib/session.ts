import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export const SESSION_COOKIE = 'verilens_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getOrCreateSessionId(): string {
  const cookieStore = cookies();
  const existing = cookieStore.get(SESSION_COOKIE);
  if (existing?.value) return existing.value;
  const id = uuidv4();
  cookieStore.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  return id;
}

export function getSessionId(): string | null {
  const cookieStore = cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}
