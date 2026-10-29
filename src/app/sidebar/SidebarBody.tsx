import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FolderPlus, Search, Star, X } from 'lucide-react';
import { onLocationChange } from '@/chatgpt/navigation';
import { newId } from '@/domain/id';
import { FOLDER_COLORS, folderColor } from '@/domain/folder-colors';
import { folderDescendantIds, nextFolderOrder } from '@/domain/folder-tree';
import { t, type MessageKey } from '@/i18n';
import { dispatchAndCommit } from '@/stores/actions';
import { useDbStore, useSettings } from '@/stores/db-store';
import { conversationItems, useConversationIndex } from '@/features/conversations/hooks';
import { useDebouncedValue } from '@/features/conversations/use-debounced-value';
import { ConversationSection } from './ConversationSection';
import { FolderSection, type FolderSelection } from './FolderSection';

const COLOR_NAME_KEYS: Record<(typeof FOLDER_COLORS)[number], MessageKey> = {
  '#6b4f3a': 'sidebar.colorBark',
  '#8b9d77': 'sidebar.colorSage',
  '#b08968': 'sidebar.colorClay',
  '#a65b45': 'sidebar.colorTerracotta',
  '#667a55': 'sidebar.colorMoss',
  '#c9a26b': 'sidebar.colorSand',
  '#7a6a58': 'sidebar.colorStone',
  '#9e8c6a': 'sidebar.colorWheat',
};

export function SidebarBody({ open }: { open: boolean }) {
  const db = useDbStore((state) => state.db);
  const settings = useSettings();
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim(), 220);
  const [selected, setSelected] = useState<FolderSelection>('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [folderForm, setFolderForm] = useState<{ parentId: string | null } | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderColorDraft, setFolderColorDraft] = useState<string>(FOLDER_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const index = useConversationIndex(true);
  const items = conversationItems(index.data);
  const total = index.data?.pages[0]?.total ?? null;
  const { refetch } = index;

  useEffect(() => {
    if (selected === 'all' || selected === 'unfiled') return;
    if (!db.folders[selected]) setSelected('all');
  }, [db.folders, selected]);

  useEffect(() => onLocationChange(() => void refetch()), [refetch]);

  // The panel stays mounted while closed so pending folder assignments keep
  // working; refresh the list whenever it is opened again.
  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  const selectedSet = useMemo(() => {
    if (selected === 'all' || selected === 'unfiled') return null;
    return folderDescendantIds(db.folders, selected);
  }, [db.folders, selected]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return items.filter((conversation) => {
      if (starredOnly && !conversation.isStarred) return false;
      if (needle && !conversation.title.toLowerCase().includes(needle)) return false;
      if (selected === 'all') return true;
      const assigned = db.conversationFolders[conversation.id] ?? null;
      if (selected === 'unfiled') return assigned === null;
      return assigned !== null && selectedSet?.has(assigned) === true;
    });
  }, [items, query, starredOnly, selected, selectedSet, db.conversationFolders]);

  const unfiledCount = useMemo(
    () => items.filter((item) => !db.conversationFolders[item.id]).length,
    [items, db.conversationFolders],
  );

  const openFolderForm = (parentId: string | null) => {
    setFolderForm({ parentId });
    setFolderName('');
    const inherited =
      parentId && db.folders[parentId] ? folderColor(db.folders[parentId].color) : FOLDER_COLORS[0];
    setFolderColorDraft(
      (FOLDER_COLORS as readonly string[]).includes(inherited) ? inherited : FOLDER_COLORS[0],
    );
  };

  const createFolder = async () => {
    const form = folderForm;
    const name = folderName.trim();
    if (!form || !name || creating) return;

    const parentId = form.parentId && db.folders[form.parentId] ? form.parentId : null;
    const now = Date.now();
    const folder = {
      id: newId('folder'),
      name,
      color: folderColorDraft,
      parentId,
      order: nextFolderOrder(db.folders, parentId),
      createdAt: now,
      updatedAt: now,
    };

    setCreating(true);
    try {
      await dispatchAndCommit({ kind: 'folder/create', folder });
      setSelected(folder.id);
      setFolderForm(null);
      setFolderName('');
    } finally {
      setCreating(false);
    }
  };

  const parentName = folderForm?.parentId ? db.folders[folderForm.parentId]?.name : null;
  const viewTotal =
    query || starredOnly || selected !== 'all' ? filtered.length : (total ?? filtered.length);

  return (
    <>
      <div className="ax-sidebar__toolbar">
        <div className="ax-sidebar__search-wrap">
          <Search className="ax-sidebar__search-icon" size={14} />
          <input
            className="ax-input ax-sidebar__search"
            value={search}
            placeholder={t('sidebar.search')}
            aria-label={t('sidebar.search')}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search ? (
            <button
              type="button"
              className="ax-icon-btn ax-sidebar__search-clear"
              aria-label={t('common.cancel')}
              onClick={() => setSearch('')}
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="ax-icon-btn ax-sidebar__new"
          title={t('sidebar.newFolder')}
          aria-label={t('sidebar.newFolder')}
          onClick={() => openFolderForm(null)}
        >
          <FolderPlus size={15} />
        </button>
        <button
          type="button"
          className="ax-icon-btn ax-sidebar__star-filter"
          data-active={starredOnly}
          aria-pressed={starredOnly}
          title={t('sidebar.starredOnly')}
          aria-label={t('sidebar.starredOnly')}
          onClick={() => setStarredOnly((value) => !value)}
        >
          <Star size={15} fill={starredOnly ? 'currentColor' : 'none'} />
        </button>
      </div>

      {folderForm ? (
        <form
          className="ax-folder-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createFolder();
          }}
        >
          <div className="ax-folder-form__label">
            {parentName ? t('sidebar.subfolderIn', { name: parentName }) : t('sidebar.rootFolder')}
          </div>
          <input
            className="ax-input"
            value={folderName}
            autoFocus
            aria-label={t('sidebar.folderName')}
            placeholder={t('sidebar.folderName')}
            onChange={(event) => setFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setFolderForm(null);
                setFolderName('');
              }
            }}
          />
          <div className="ax-folder-form__colors">
            <span className="ax-folder-form__label">{t('sidebar.folderColor')}</span>
            <div className="ax-folder-swatches" role="group" aria-label={t('sidebar.folderColor')}>
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="ax-folder-swatch"
                  style={{ '--swatch': color } as CSSProperties}
                  data-selected={folderColorDraft === color}
                  aria-pressed={folderColorDraft === color}
                  aria-label={t(COLOR_NAME_KEYS[color])}
                  title={t(COLOR_NAME_KEYS[color])}
                  onClick={() => setFolderColorDraft(color)}
                />
              ))}
            </div>
          </div>
          <div className="ax-inline">
            <button
              type="submit"
              className="ax-btn ax-btn--primary"
              disabled={!folderName.trim() || creating}
            >
              {t('common.save')}
            </button>
            <button
              type="button"
              className="ax-btn"
              onClick={() => {
                setFolderForm(null);
                setFolderName('');
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      <div className="ax-sidebar__scroll">
        <FolderSection
          selected={selected}
          onSelect={setSelected}
          onNewSubfolder={openFolderForm}
          unfiledCount={unfiledCount}
          allCount={total}
        />

        <ConversationSection
          items={filtered}
          total={viewTotal}
          loading={index.isPending}
          error={index.error}
          hasNextPage={index.hasNextPage}
          isFetchingNextPage={index.isFetchingNextPage}
          onLoadMore={() => void index.fetchNextPage()}
          onRetry={() => void index.refetch()}
          searchQuery={query}
          selected={selected}
          knownConversationIds={items.map((item) => item.id)}
          folders={db.folders}
          assignments={db.conversationFolders}
          bulkEnabled={settings.features.bulk}
        />
      </div>
    </>
  );
}
