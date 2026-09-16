// Minimal two-route router for "/" and "/gerir/{uuid}".
// The .svelte.ts extension allows runes in module state.

export type Route = { name: 'home' } | { name: 'manage'; uuid: string };

function parse(path: string): Route {
  const m = path.match(/^\/gerir\/([0-9a-f-]+)$/i);
  if (m) return { name: 'manage', uuid: m[1] };
  return { name: 'home' };
}

export const router = $state<{ route: Route }>({ route: parse(location.pathname) });

window.addEventListener('popstate', () => {
  router.route = parse(location.pathname);
});

export function navigate(path: string): void {
  history.pushState({}, '', path);
  router.route = parse(path);
}
