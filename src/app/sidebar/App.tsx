import { useEffect, useRef, useState } from 'react';
import { Settings, X } from 'lucide-react';
import { onLocationChange } from '@/chatgpt/navigation';
import { getConversationId } from '@/chatgpt/selectors';
import { t } from '@/i18n';
import { dispatchAndCommit } from '@/stores/actions';
import { useDbStore, useSettings } from '@/stores/db-store';
import { useUiStore } from '@/stores/ui-store';
import { AnexoMark } from '@/ui/AnexoMark';
import { SidebarBody } from './SidebarBody';
import { takePendingFolderAssignment } from './pending-folder';

const PANEL_ID = 'anexo-organizer-panel';
const EDGE = 8;
const LAUNCHER_SIZE = 36;
const LAUNCHER_GAP = 8;
const PANEL_GAP = 8;
const PANEL_WIDTH = 340;
const FALLBACK_TOP = 52;

interface DrawerAnchor {
  top: number;
  right: number;
  viewportWidth: number;
  viewportHeight: number;
}

function findShareButton(): HTMLElement | null {
  const header = document.querySelector<HTMLElement>('header');
  if (!header) return null;

  const tagged = header.querySelector<HTMLElement>('[data-testid="share-button"]');
  if (tagged) return tagged;

  return (
    Array.from(header.querySelectorAll<HTMLElement>('button, a')).find((element) => {
      const label =
        `${element.getAttribute('aria-label') ?? ''} ${element.textContent ?? ''}`.trim();
      return /^(share\b|分享)/i.test(label);
    }) ?? null
  );
}

function readAnchor(): DrawerAnchor {
  const button = findShareButton();
  if (button) {
    const rect = button.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        top: Math.max(EDGE, Math.round(rect.bottom)),
        right: Math.max(EDGE, Math.round(window.innerWidth - rect.right)),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    }
  }

  return {
    top: FALLBACK_TOP,
    right: EDGE,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

function useDrawerAnchor(): DrawerAnchor {
  const [anchor, setAnchor] = useState<DrawerAnchor>(readAnchor);

  useEffect(() => {
    const update = () => {
      setAnchor((current) => {
        const next = readAnchor();
        return current.top === next.top &&
          current.right === next.right &&
          current.viewportWidth === next.viewportWidth &&
          current.viewportHeight === next.viewportHeight
          ? current
          : next;
      });
    };

    update();
    const timer = window.setInterval(update, 750);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
    };
  }, []);

  return anchor;
}

export function SidebarApp({ host }: { host: HTMLElement }) {
  const settings = useSettings();
  const db = useDbStore((state) => state.db);
  const hydrated = useDbStore((state) => state.hydrated);
  const features = settings.features;
  const openCommandCenter = useUiStore((state) => state.openCommandCenter);
  const anchor = useDrawerAnchor();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    host.style.display = features.sidebar ? '' : 'none';
  }, [host, features.sidebar]);

  useEffect(() => {
    if (!hydrated) return;

    const assignPendingFolder = () => {
      // Read the URL directly instead of a state snapshot: a pending folder
      // record can outlive a stale render while ChatGPT navigates.
      const conversationId = getConversationId();
      if (!conversationId) return;
      const folderId = takePendingFolderAssignment(conversationId);
      if (!folderId || !db.folders[folderId]) return;
      void dispatchAndCommit({ kind: 'conversation/move', conversationId, folderId }).catch(
        () => {},
      );
    };

    assignPendingFolder();
    return onLocationChange(assignPendingFolder);
  }, [db.folders, hydrated]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const path = event.composedPath();
      if (panelRef.current && path.includes(panelRef.current)) return;
      if (launcherRef.current && path.includes(launcherRef.current)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!features.sidebar) return null;

  const railOpen = features.rightRail && settings.ui.railOpen;
  const preferredPanelRight = railOpen ? 12 + settings.ui.railWidth + 12 : 68;
  const panelRight = anchor.viewportWidth - preferredPanelRight >= 280 ? preferredPanelRight : 68;
  const panelWidth = Math.max(220, Math.min(PANEL_WIDTH, anchor.viewportWidth - panelRight - EDGE));
  const panelTop = anchor.top + LAUNCHER_GAP + LAUNCHER_SIZE + PANEL_GAP;
  const panelHeight = Math.max(220, anchor.viewportHeight - panelTop - 16);
  const label = t(open ? 'sidebar.closeOrganizer' : 'sidebar.openOrganizer');

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="ax-sidebar-launcher"
        data-open={open}
        style={{ top: anchor.top + LAUNCHER_GAP, right: anchor.right }}
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
      >
        <AnexoMark size={22} className="ax-sidebar-launcher__mark" />
      </button>

      <aside
        ref={panelRef}
        id={PANEL_ID}
        className="ax-sidebar ax-sidebar--drawer"
        data-open={open}
        aria-label={t('sidebar.title')}
        style={{
          display: open ? undefined : 'none',
          top: panelTop,
          right: panelRight,
          width: panelWidth,
          maxHeight: panelHeight,
        }}
      >
        <div className="ax-sidebar__header">
          <div className="ax-sidebar__brand">
            <AnexoMark />
            <span className="ax-sidebar__title">{t('sidebar.title')}</span>
          </div>
          <button
            type="button"
            className="ax-icon-btn"
            title={t('sidebar.openSettings')}
            aria-label={t('sidebar.openSettings')}
            onClick={() => openCommandCenter()}
          >
            <Settings size={15} />
          </button>
          <button
            type="button"
            className="ax-icon-btn"
            title={t('sidebar.closeOrganizer')}
            aria-label={t('sidebar.closeOrganizer')}
            onClick={() => setOpen(false)}
          >
            <X size={15} />
          </button>
        </div>

        <SidebarBody open={open} />
      </aside>
    </>
  );
}
