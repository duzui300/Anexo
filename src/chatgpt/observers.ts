export interface ObserverHandle {
  start: () => void;
  stop: () => void;
}

export interface ObserverOptions {
  debounceMs?: number;
  attributes?: boolean;
  attributeFilter?: string[];
}

/**
 * A single debounced MutationObserver for one concern. Pauses scheduling while the document is
 * hidden; mutations still arrive, but the callback runs on the next visible tick after activity.
 */
export function createDebouncedObserver(
  target: Node,
  callback: () => void,
  options: ObserverOptions = {},
): ObserverHandle {
  const debounceMs = options.debounceMs ?? 250;
  let timer: number | null = null;
  let started = false;

  const schedule = () => {
    if (timer !== null) return;
    const delay = typeof document !== 'undefined' && document.hidden ? 1000 : debounceMs;
    timer = window.setTimeout(() => {
      timer = null;
      callback();
    }, delay);
  };

  const observer = new MutationObserver(schedule);

  const onVisibility = () => {
    if (!document.hidden) schedule();
  };

  return {
    start() {
      if (started) return;
      started = true;
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: options.attributes ?? false,
        attributeFilter: options.attributes ? options.attributeFilter : undefined,
      });
      document.addEventListener('visibilitychange', onVisibility);
      schedule();
    },
    stop() {
      if (!started) return;
      started = false;
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    },
  };
}
