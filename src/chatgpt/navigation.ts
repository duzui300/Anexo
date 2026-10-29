export type LocationChangeHandler = (next: URL, previous: URL) => void;

/**
 * ChatGPT is a SPA. popstate covers back/forward; a bounded poll covers pushState navigations
 * that do not emit an event we can observe from an isolated world.
 */
export function onLocationChange(handler: LocationChangeHandler): () => void {
  let current = new URL(location.href);
  let timer: number | null = null;

  const check = () => {
    let next: URL;
    try {
      next = new URL(location.href);
    } catch {
      return;
    }
    if (next.href === current.href) return;
    const previous = current;
    current = next;
    handler(next, previous);
  };

  const onEvent = () => check();

  window.addEventListener('popstate', onEvent);
  window.addEventListener('wxt:locationchange', onEvent);
  timer = window.setInterval(check, 300);

  return () => {
    window.removeEventListener('popstate', onEvent);
    window.removeEventListener('wxt:locationchange', onEvent);
    if (timer !== null) window.clearInterval(timer);
  };
}
