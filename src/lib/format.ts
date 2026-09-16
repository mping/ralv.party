// Format dates and times as pt-PT and provide the October 31 event date.

export function eventDate(): string {
  // October 31 of the current year as yyyy-mm-dd for <input type="date">.
  return `${new Date().getFullYear()}-10-31`;
}

export function formatTime(t: string): string {
  // "18:30:00" → "18:30"
  return t.slice(0, 5);
}

export function formatDate(d: string): string {
  // Return a localized long date including the weekday.
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatDateShort(d: string): string {
  // Return a localized compact date for list cards.
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short',
  });
}
