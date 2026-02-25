import { useEffect, useMemo, useState } from 'react';

export function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useMemo(
    () => (to, replace = false) => {
      if (window.location.pathname === to) return;

      if (replace) {
        window.history.replaceState({}, '', to);
      } else {
        window.history.pushState({}, '', to);
      }

      setPathname(window.location.pathname);
    },
    [],
  );

  return { pathname, navigate };
}
