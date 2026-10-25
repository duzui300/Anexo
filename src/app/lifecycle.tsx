import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { browser } from 'wxt/browser';
import { getConversationId } from '@/chatgpt/selectors';
import { fetchDbSnapshot, watchDb } from '@/data/repository';
import { conversationQueryClient } from '@/features/conversations/query-client';
import type { Theme } from '@/data/schema';
import { setLocale } from '@/i18n';
import { log } from '@/platform/logger';
import { useDbStore } from '@/stores/db-store';
import { useUiStore } from '@/stores/ui-store';
import { OverlayApp } from './overlay/App';
import { RailApp } from './rail/App';
import { SidebarApp } from './sidebar/App';
import { applyTheme, createSurface } from './surface-host';
import { observeTheme, resolveTheme } from './theme';

let booted = false;

async function waitForBody(): Promise<void> {
  if (document.body) return;
  await new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

export async function boot(): Promise<void> {
  if (booted) return;
  booted = true;

  try {
    await waitForBody();

    const surfaces = [
      createSurface('sidebar'),
      createSurface('rail'),
      createSurface('overlay'),
    ] as const;
    const [sidebar, rail, overlay] = surfaces;

    document.documentElement.append(sidebar.host, rail.host, overlay.host);

    sidebar.reactRoot.render(
      <StrictMode>
        <QueryClientProvider client={conversationQueryClient}>
          <SidebarApp host={sidebar.host} />
        </QueryClientProvider>
      </StrictMode>,
    );
    rail.reactRoot.render(
      <StrictMode>
        <QueryClientProvider client={conversationQueryClient}>
          <RailApp host={rail.host} />
        </QueryClientProvider>
      </StrictMode>,
    );
    overlay.reactRoot.render(
      <StrictMode>
        <OverlayApp />
      </StrictMode>,
    );

    try {
      const db = await fetchDbSnapshot();
      useDbStore.getState().setDb(db);
      setLocale(db.settings.locale);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      useDbStore.getState().setError(message);
      log.error('Failed to hydrate Anexo data', message);
    }

    let currentTheme: Theme = useDbStore.getState().db.settings.theme;
    const applyVisibility = () => {
      const { features } = useDbStore.getState().db.settings;
      sidebar.host.style.display = features.sidebar ? '' : 'none';
      rail.host.style.display = features.rightRail ? '' : 'none';
    };

    applyTheme(surfaces, resolveTheme(currentTheme));
    applyVisibility();

    let disposeTheme = observeTheme(currentTheme, (resolved) => {
      applyTheme(surfaces, resolved);
    });

    const unsubscribeStore = useDbStore.subscribe((state) => {
      const theme = state.db.settings.theme;
      if (theme !== currentTheme) {
        currentTheme = theme;
        disposeTheme();
        disposeTheme = observeTheme(theme, (resolved) => applyTheme(surfaces, resolved));
        applyTheme(surfaces, resolveTheme(theme));
      }
      applyVisibility();
    });

    const unsubscribeDb = watchDb((db) => {
      useDbStore.getState().setDb(db);
      setLocale(db.settings.locale);
    });

    const onRuntimeMessage = (message: unknown) => {
      if (
        message !== null &&
        typeof message === 'object' &&
        (message as { type?: unknown }).type === 'ui:openCommandCenter'
      ) {
        useUiStore.getState().openCommandCenter();
      }
    };
    browser.runtime.onMessage.addListener(onRuntimeMessage);

    const cleanup = () => {
      unsubscribeDb();
      unsubscribeStore();
      disposeTheme();
      browser.runtime.onMessage.removeListener(onRuntimeMessage);
      for (const surface of surfaces) surface.destroy();
    };

    window.addEventListener('pagehide', cleanup, { once: true });

    log.debug('Anexo booted', { conversationId: getConversationId() });
  } catch (error) {
    log.error('Anexo failed to boot', error);
  }
}
