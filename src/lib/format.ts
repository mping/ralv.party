// Formatação pt-PT de datas/horas e a data do evento (31 de outubro).

export function eventDate(): string {
  // 31 de outubro do ano corrente, em formato yyyy-mm-dd (para <input type="date">).
  return `${new Date().getFullYear()}-10-31`;
}

export function formatTime(t: string): string {
  // "18:30:00" → "18:30"
  return t.slice(0, 5);
}

export function formatDate(d: string): string {
  // "2026-10-31" → "sábado, 31 de outubro"
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatDateShort(d: string): string {
  // "2026-10-31" → "31 out"
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-PT', {
    day: 'numeric',
    month: 'short',
  });
}
