// Tipos globais do widget Turnstile (Cloudflare).
interface TurnstileWidget {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
}

interface Window {
  turnstile?: TurnstileWidget;
}
