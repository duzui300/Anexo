import { useEffect, useState } from 'react';
import { onLocationChange } from './navigation';
import { getConversationId } from './selectors';

/** Tracks the ChatGPT conversation ID across the SPA's pushState navigations. */
export function useCurrentConversationId(): string | null {
  const [id, setId] = useState<string | null>(() => getConversationId());

  useEffect(() => {
    // Sync once after mount: an SPA navigation can land between the state
    // initializer and the listener registration.
    setId(getConversationId());
    return onLocationChange(() => setId(getConversationId()));
  }, []);

  return id;
}
