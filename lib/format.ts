export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function languageLabel(code: string): string {
  const map: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    ur: 'Urdu',
    zh: 'Chinese',
    auto: 'Auto-detected',
  };
  return map[code] ?? code;
}

/** What kind of input an analysis was made from, judged from its stored source. */
export function inputKind(source: string): 'text' | 'pdf' | 'image' {
  if (source === 'text-only' || !source) return 'text';
  if (source.startsWith('data:')) return source.startsWith('data:application/pdf') ? 'pdf' : 'image';
  try {
    return new URL(source).pathname.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
  } catch {
    return 'image';
  }
}
