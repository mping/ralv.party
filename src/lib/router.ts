import { useEffect, useState } from 'react';

export type Route = { name: 'home' } | { name: 'manage'; uuid: string };

function parse(path: string): Route {
  const match = path.match(/^\/gerir\/([0-9a-f-]+)$/i);
  return match ? { name: 'manage', uuid: match[1] } : { name: 'home' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname));

  useEffect(() => {
    const updateRoute = () => setRoute(parse(window.location.pathname));
    window.addEventListener('popstate', updateRoute);
    return () => window.removeEventListener('popstate', updateRoute);
  }, []);

  return route;
}

export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
