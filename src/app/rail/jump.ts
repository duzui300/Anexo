export interface JumpTarget {
  messageId?: string | null;
  index: number;
  total: number;
  preview?: string | null;
  role?: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[^\n]*/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, ' ')
    .replace(/[*_`~]/g, ' ');
}

/** Strip the markdown syntax ChatGPT removes when it renders a message. */
function searchable(text: string): string {
  return normalize(stripMarkdown(text).replace(/[#>*_`~|]/g, ' '));
}

/** A normalized needle that can still be located in the rendered text. */
function plainNeedle(text: string): string | null {
  const plain = normalize(stripMarkdown(text).replace(/[>|]/g, ' '));
  return plain.length >= 16 ? plain.slice(0, 100) : null;
}

function escapeAttribute(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&');
}

function turnElements(): HTMLElement[] {
  const primary = Array.from(
    document.querySelectorAll<HTMLElement>('[data-content-search-turn-key]'),
  );
  const candidates =
    primary.length > 0
      ? primary
      : Array.from(document.querySelectorAll<HTMLElement>('[data-turn-key]'));
  return candidates.filter(
    (element, index) =>
      !candidates.some((other, otherIndex) => otherIndex !== index && other.contains(element)),
  );
}

/**
 * ChatGPT wraps every prompt and its response in a turn. The turn key is the user
 * message id, and the search index attributes carry both message ids. Prefer the
 * rendered content node, then the user bubble, and only then the whole turn.
 */
function findById(messageId: string): HTMLElement | null {
  const id = escapeAttribute(messageId);
  const content = document.querySelector<HTMLElement>(
    `[data-chatgpt-selection-message-id="${id}"], [data-dil-message-id="${id}"]`,
  );
  if (content) return content;

  const searchNode = document.querySelector<HTMLElement>(
    `[data-chatgpt-search-message-ids~="${id}"]`,
  );
  if (searchNode) {
    return searchNode.querySelector<HTMLElement>('[data-user-message-bubble="true"]') ?? searchNode;
  }

  return document.querySelector<HTMLElement>(`[data-turn-key="${id}"]`);
}

function idAttributesInDom(): boolean {
  return Boolean(
    document.querySelector(
      '[data-turn-key], [data-chatgpt-search-message-ids], [data-chatgpt-selection-message-id]',
    ),
  );
}

interface TextCandidate {
  element: HTMLElement;
  text: string;
  user: boolean;
}

interface JumpHit {
  element: HTMLElement;
  text?: string;
}

function textCandidates(): TextCandidate[] {
  const userNodes = Array.from(
    document.querySelectorAll<HTMLElement>('[data-chatgpt-search-message-ids]'),
  ).filter((element) => element.querySelector('[data-user-message-bubble="true"]'));
  const assistantNodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-chatgpt-selection-message-id], [data-dil-message-id]',
    ),
  );

  let elements: HTMLElement[] =
    assistantNodes.length > 0 ? [...userNodes, ...assistantNodes] : turnElements();
  if (elements.length === 0) elements = turnElements();

  const unique = elements.filter(
    (element, index) =>
      !elements.some((other, otherIndex) => otherIndex !== index && other.contains(element)),
  );
  unique.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  return unique.map((element) => ({
    element,
    text: searchable(element.innerText || element.textContent || ''),
    user: Boolean(element.querySelector('[data-user-message-bubble="true"]')),
  }));
}

interface TextNeedle {
  value: string;
  exact: boolean;
}

function needlesFor(preview: string): TextNeedle[] {
  const clean = searchable(preview);
  if (!clean) return [];
  if (clean.length <= 24) return [{ value: clean, exact: true }];
  if (clean.length <= 240) return [{ value: clean, exact: false }];

  const middle = Math.floor(clean.length / 2) - 100;
  const values = [clean.slice(0, 200), clean.slice(middle, middle + 200), clean.slice(-200)];
  return values
    .filter((value, index) => value.length >= 24 && values.indexOf(value) === index)
    .map((value) => ({ value, exact: false }));
}

function pickMatch(matches: TextCandidate[], target: JumpTarget): TextCandidate | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;
  const ratio = target.total > 1 ? Math.min(1, Math.max(0, target.index / (target.total - 1))) : 0;
  const position = Math.min(
    matches.length - 1,
    Math.max(0, Math.round(ratio * (matches.length - 1))),
  );
  return matches[position] ?? matches[0]!;
}

function findByText(target: JumpTarget, uniqueOnly = false): JumpHit | null {
  const preview = target.preview ?? '';
  const needles = needlesFor(preview);
  if (needles.length === 0) return null;

  let candidates = textCandidates();
  if (target.role === 'user' && candidates.some((candidate) => candidate.user)) {
    candidates = candidates.filter((candidate) => candidate.user);
  } else if (target.role === 'assistant' && candidates.some((candidate) => !candidate.user)) {
    candidates = candidates.filter((candidate) => !candidate.user);
  }

  const plain = plainNeedle(preview);
  for (const needle of needles) {
    const exact = candidates.filter((candidate) => candidate.text === needle.value);
    const matches =
      exact.length > 0
        ? exact
        : needle.exact
          ? []
          : candidates.filter((candidate) => candidate.text.includes(needle.value));
    if (uniqueOnly) {
      // A missing id can mean ChatGPT merged several assistant messages into one
      // rendered response. Match its text only when exactly one node contains it.
      if (matches.length === 1) {
        return {
          element: matches[0]!.element,
          text: needle.exact ? undefined : (plain ?? undefined),
        };
      }
      continue;
    }
    const picked = pickMatch(matches, target);
    if (picked) {
      return {
        element: picked.element,
        text: matches.length === 1 && !needle.exact ? (plain ?? undefined) : undefined,
      };
    }
  }

  return null;
}

function findTarget(target: JumpTarget): JumpHit | null {
  if (target.messageId) {
    const byId = findById(target.messageId);
    if (byId) return { element: byId };
    // ChatGPT renders some consecutive assistant messages as one node and keeps
    // only one id on it. A unique text match still lands on the right response.
    if (idAttributesInDom()) return findByText(target, true);
  }
  return findByText(target);
}

function findRange(root: HTMLElement, needle: string): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    if (text.nodeValue?.trim()) nodes.push(text);
    current = walker.nextNode();
  }

  let haystack = '';
  const map: { node: Text; offset: number }[] = [];
  for (const node of nodes) {
    const value = node.nodeValue ?? '';
    for (let offset = 0; offset < value.length; offset += 1) {
      const char = value[offset]!;
      if (/\s/.test(char)) {
        if (haystack.length > 0 && !haystack.endsWith(' ')) {
          haystack += ' ';
          map.push({ node, offset });
        }
      } else {
        haystack += char.toLowerCase();
        map.push({ node, offset });
      }
    }
    if (haystack.length > 0 && !haystack.endsWith(' ')) {
      haystack += ' ';
      map.push({ node, offset: value.length - 1 });
    }
  }

  const start = haystack.indexOf(needle);
  if (start < 0) return null;
  const first = map[start];
  const last = map[start + needle.length - 1];
  if (!first || !last) return null;
  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, Math.min(last.offset + 1, (last.node.nodeValue ?? '').length));
  return range;
}

function flashElement(element: HTMLElement): void {
  let target = element;
  if (target.getBoundingClientRect().height === 0) {
    const turn = target.closest<HTMLElement>('[data-turn-key]');
    if (turn && turn.getBoundingClientRect().height > 0) target = turn;
  }
  const previous = {
    outline: target.style.outline,
    outlineOffset: target.style.outlineOffset,
    transition: target.style.transition,
  };
  target.style.transition = 'outline-color 480ms ease-in-out';
  target.style.outline = '2px solid #8b9d77';
  target.style.outlineOffset = '4px';
  window.setTimeout(() => {
    target.style.outline = previous.outline;
    target.style.outlineOffset = previous.outlineOffset;
    target.style.transition = previous.transition;
  }, 1_600);
}

function flash(hit: JumpHit): void {
  const { element, text } = hit;
  const range = text ? findRange(element, text) : null;
  const rangeRect = range?.getBoundingClientRect();
  if (range && rangeRect && rangeRect.height > 0) {
    const scroller = threadScroller();
    const start = range.startContainer.parentElement;
    const block =
      start?.closest<HTMLElement>('p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, table') ??
      start ??
      element;
    if (scroller) {
      const scrollerRect = scroller.getBoundingClientRect();
      const top =
        scroller.scrollTop + (rangeRect.top - scrollerRect.top) - scroller.clientHeight * 0.28;
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } else {
      block.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    flashElement(block);
    return;
  }

  element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  flashElement(element);
}

function threadScroller(): HTMLElement | null {
  const direct = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.thread-scroll-container, [data-app-action-timeline-scroll]',
    ),
  )
    .filter((element) => {
      const style = getComputedStyle(element);
      return (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') && element.clientHeight > 200
      );
    })
    .sort((a, b) => b.clientHeight - a.clientHeight);
  if (direct[0]) return direct[0];

  const anchor =
    document.querySelector<HTMLElement>('[data-thread-find-target="conversation"]') ??
    document.querySelector<HTMLElement>('main');
  let current = anchor?.parentElement ?? null;
  while (current) {
    const style = getComputedStyle(current);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      current.clientHeight > 240
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function domSignal(): string {
  return [
    document.querySelectorAll('[data-turn-key]').length,
    document.querySelectorAll('[data-chatgpt-search-message-ids]').length,
    document.querySelectorAll('[data-chatgpt-selection-message-id]').length,
  ].join(':');
}

async function waitForGrowth(
  scroller: HTMLElement,
  height: number,
  signal: string,
  timeout: number,
): Promise<boolean> {
  const end = performance.now() + timeout;
  while (performance.now() < end) {
    await sleep(150);
    if (scroller.scrollHeight !== height || domSignal() !== signal) return true;
  }
  return false;
}

async function findAfterLoading(
  target: JumpTarget,
  scroller: HTMLElement,
): Promise<JumpHit | null> {
  const maxTop = (): number => Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const ratio = target.total > 1 ? Math.min(1, Math.max(0, target.index / (target.total - 1))) : 0;
  const initialTop = scroller.scrollTop;

  const attemptScroll = async (top: number): Promise<JumpHit | null> => {
    scroller.scrollTop = Math.min(maxTop(), Math.max(0, top));
    await sleep(350);
    return findTarget(target);
  };

  const proportional = await attemptScroll(ratio * maxTop());
  if (proportional) return proportional;

  let edge: 'top' | 'bottom' = ratio < 0.5 ? 'top' : 'bottom';
  let switched = false;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const height = scroller.scrollHeight;
    const signal = domSignal();
    scroller.scrollTop = edge === 'top' ? 0 : maxTop();
    const grew = await waitForGrowth(scroller, height, signal, 1_400);
    const found = findTarget(target);
    if (found) return found;

    if (!grew) {
      if (switched) break;
      edge = edge === 'top' ? 'bottom' : 'top';
      switched = true;
    }
  }

  for (const offset of [0, 0.1, -0.1, 0.22, -0.22]) {
    const topRatio = Math.min(1, Math.max(0, ratio + offset));
    const found = await attemptScroll(topRatio * maxTop());
    if (found) return found;
  }

  scroller.scrollTop = Math.min(initialTop, maxTop());
  return null;
}

/**
 * Jump to a backend message in ChatGPT's virtualized transcript. Message ids are
 * the only reliable mapping: a turn groups a prompt and its answer, so a backend
 * message index does not equal a DOM turn index. When fewer turns are mounted than
 * the conversation contains, progressively load older history before matching.
 */
export async function jumpToMessage(target: JumpTarget): Promise<boolean> {
  const direct = findTarget(target);
  if (direct) {
    flash(direct);
    return true;
  }

  const scroller = threadScroller();
  if (!scroller) return false;

  const loaded = await findAfterLoading(target, scroller);
  if (!loaded) return false;
  flash(loaded);
  return true;
}
