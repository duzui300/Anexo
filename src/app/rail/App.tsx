import { useEffect } from 'react';
import {
  Bookmark,
  Lightbulb,
  Map,
  MessageSquare,
  Settings,
  StickyNote,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { UiSettings } from '@/data/schema';
import { t, type MessageKey } from '@/i18n';
import { updateSettings } from '@/stores/actions';
import { useSettings } from '@/stores/db-store';
import { useUiStore } from '@/stores/ui-store';
import { AnexoMark } from '@/ui/AnexoMark';
import { BookmarksPanel } from './BookmarksPanel';
import { FollowupsPanel } from './FollowupsPanel';
import { MinimapPanel } from './MinimapPanel';
import { NotesPanel } from './NotesPanel';
import { SideChatPanel } from './SideChatPanel';

type RailTab = UiSettings['railTab'];

const TABS: { id: RailTab; label: MessageKey; icon: LucideIcon }[] = [
  { id: 'minimap', label: 'rail.minimap', icon: Map },
  { id: 'bookmarks', label: 'rail.bookmarks', icon: Bookmark },
  { id: 'notes', label: 'rail.notes', icon: StickyNote },
  { id: 'sideChat', label: 'rail.sideChat', icon: MessageSquare },
  { id: 'followups', label: 'rail.followups', icon: Lightbulb },
];

function RailBody({ tab }: { tab: RailTab }) {
  if (tab === 'minimap') return <MinimapPanel />;
  if (tab === 'bookmarks') return <BookmarksPanel />;
  if (tab === 'notes') return <NotesPanel />;
  if (tab === 'followups') return <FollowupsPanel />;
  return <SideChatPanel />;
}

export function RailApp({ host }: { host: HTMLElement }) {
  const settings = useSettings();
  const openCommandCenter = useUiStore((state) => state.openCommandCenter);
  const { railOpen, railTab, railWidth } = settings.ui;

  useEffect(() => {
    host.style.width = railOpen ? `${railWidth}px` : '44px';
    host.dataset.open = String(railOpen);
    host.style.display = settings.features.rightRail ? '' : 'none';
  }, [host, railOpen, railWidth, settings.features.rightRail]);

  useEffect(() => {
    if (!railOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (event.composedPath().includes(host)) return;
      void updateSettings({ ui: { railOpen: false } }).catch(() => {});
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [host, railOpen]);

  if (!settings.features.rightRail) return null;

  const selectTab = (tab: RailTab) => {
    const nextOpen = railTab === tab ? !railOpen : true;
    void updateSettings({ ui: { railTab: tab, railOpen: nextOpen } }).catch(() => {});
  };

  const close = () => {
    void updateSettings({ ui: { railOpen: false } }).catch(() => {});
  };

  const active = TABS.find((tab) => tab.id === railTab) ?? TABS[0]!;

  return (
    <div className={`ax-rail${railOpen ? ' ax-rail--open' : ''}`}>
      <div
        className="ax-rail__whisker"
        role="tablist"
        aria-orientation={railOpen ? 'horizontal' : 'vertical'}
        aria-label="Anexo tools"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={railOpen && railTab === tab.id}
              aria-label={t(tab.label)}
              title={t(tab.label)}
              className="ax-whisker-tab"
              data-active={railOpen && railTab === tab.id}
              onClick={() => selectTab(tab.id)}
            >
              <Icon size={15} />
            </button>
          );
        })}
      </div>

      {railOpen ? (
        <section className="ax-rail__panel" data-tab={railTab} aria-label={t(active.label)}>
          <div className="ax-rail__header">
            <span className="ax-rail__title">{t(active.label)}</span>
            <button
              type="button"
              className="ax-icon-btn"
              title={t('rail.close')}
              aria-label={t('rail.close')}
              onClick={close}
            >
              <X size={15} />
            </button>
          </div>
          <div className="ax-rail__body">
            <RailBody tab={railTab} />
          </div>
          <div className="ax-rail__footer">
            <span className="ax-rail__footer-brand">
              <AnexoMark size={20} />
              {t('rail.footer')}
            </span>
            <button
              type="button"
              className="ax-icon-btn"
              title={t('overlay.openSettings')}
              aria-label={t('overlay.openSettings')}
              onClick={() => openCommandCenter()}
            >
              <Settings size={14} />
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
