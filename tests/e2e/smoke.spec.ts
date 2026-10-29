import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EXTENSION_PATH = resolve(process.cwd(), '.output/chrome-mv3');

const conversations = [
  {
    id: 'conv-anexo-1',
    title: 'Designing a local-first bookmark system',
    create_time: '2026-10-01T09:12:00.000Z',
    update_time: '2026-10-23T18:40:00.000Z',
    is_archived: false,
    is_starred: true,
    gizmo_id: null,
  },
  {
    id: 'conv-anexo-2',
    title: 'Chrome MV3 service worker notes',
    create_time: '2026-09-22T11:00:00.000Z',
    update_time: '2026-10-20T08:10:00.000Z',
    is_archived: false,
    is_starred: false,
    gizmo_id: null,
  },
];

let context: BrowserContext;
let fixtureHtml = '';
let conversationAuth: string | null = null;
const deletedConversationIds = new Set<string>();

async function installRoutes(target: BrowserContext): Promise<void> {
  fixtureHtml = await readFile(resolve(process.cwd(), 'tests/fixtures/chatgpt/page.html'), 'utf8');

  await target.route('https://chatgpt.com/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/session') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'test-session-token',
          expires: new Date(Date.now() + 3_600_000).toISOString(),
        }),
      });
      return;
    }

    if (url.pathname === '/backend-api/conversations') {
      conversationAuth = route.request().headers()['authorization'] ?? null;
      const items = conversations.filter((item) => !deletedConversationIds.has(item.id));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, total: items.length }),
      });
      return;
    }
    if (
      route.request().method() === 'DELETE' &&
      url.pathname.startsWith('/backend-api/conversation/id/')
    ) {
      deletedConversationIds.add(decodeURIComponent(url.pathname.split('/').pop() ?? ''));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    if (route.request().method() === 'DELETE' && url.pathname.startsWith('/backend-api/')) {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Method Not Allowed' }),
      });
      return;
    }
    if (url.pathname === '/backend-api/conversation/conv-anexo-1') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'conv-anexo-1',
          title: 'Designing a local-first bookmark system',
          create_time: '2026-10-01T09:12:00.000Z',
          update_time: '2026-10-23T18:40:00.000Z',
          current_node: 'a2',
          mapping: {
            a1: {
              id: 'a1',
              parent: null,
              children: ['a2'],
              message: {
                id: 'msg-user-1',
                author: { role: 'user' },
                content: { parts: ['How should I design bookmarks that survive DOM changes?'] },
              },
            },
            a2: {
              id: 'a2',
              parent: 'a1',
              children: [],
              message: {
                id: 'msg-assistant-1',
                author: { role: 'assistant' },
                content: {
                  parts: [
                    'Anchor to stable identifiers.\n\nStore a conversation ID plus a stable message ID.',
                  ],
                },
              },
            },
          },
        }),
      });
      return;
    }
    if (url.pathname === '/backend-api/conversation/conv-anexo-2') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'conv-anexo-2',
          title: 'Chrome MV3 service worker notes',
          current_node: 'b1',
          mapping: {
            b1: {
              id: 'b1',
              parent: null,
              children: [],
              message: {
                id: 'msg-user-2',
                author: { role: 'user' },
                content: { parts: ['How do I keep a service worker alive?'] },
              },
            },
          },
        }),
      });
      return;
    }
    if (url.pathname.startsWith('/backend-api/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: fixtureHtml,
    });
  });
}

async function openSidebar(page: Page): Promise<void> {
  const panel = page.locator('#anexo-sidebar-host .ax-sidebar');
  if (!(await panel.isVisible().catch(() => false))) {
    await page.locator('#anexo-sidebar-host .ax-sidebar-launcher').click();
  }
  await expect(panel).toBeVisible({ timeout: 20_000 });
}

async function newChatGptPage(options: { openSidebar?: boolean } = {}): Promise<Page> {
  const page = await context.newPage();
  await page.goto('https://chatgpt.com/c/conv-anexo-1?theme=dark&clean=1', {
    waitUntil: 'domcontentloaded',
  });
  if (options.openSidebar !== false) await openSidebar(page);
  return page;
}

async function openCommandCenter(page: Page): Promise<void> {
  const railPanel = page.locator('#anexo-rail-host .ax-rail__panel');
  if (!(await railPanel.isVisible().catch(() => false))) {
    await page.locator('#anexo-rail-host .ax-whisker-tab').first().click();
  }
  const railButton = page
    .locator('#anexo-rail-host .ax-rail__footer')
    .getByRole('button', { name: 'Open Command Center' });
  if (await railButton.isVisible().catch(() => false)) {
    await railButton.click();
  } else {
    await page
      .locator('#anexo-sidebar-host .ax-sidebar')
      .getByRole('button', { name: 'Open Command Center' })
      .click();
  }
  await expect(page.locator('#anexo-overlay-host .ax-command')).toBeVisible();
}

async function setProviderModel(extensionId: string, model: string): Promise<void> {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'load' });
  await expect(options.getByRole('heading', { name: 'Anexo settings' })).toBeVisible();
  await options.getByPlaceholder('gpt-5', { exact: true }).fill(model);
  await options.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(options.locator('.ax-badge').filter({ hasText: 'Saved' })).toBeVisible();
  await options.close();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userDataDir = resolve(process.cwd(), 'test-results', `anexo-profile-${Date.now()}`);
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  await installRoutes(context);

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20_000 });
  expect(worker.url()).toMatch(/^chrome-extension:\/\//);
});

test.afterAll(async () => {
  await context.close();
});

test('renders the three surfaces without console errors', async () => {
  const page = await newChatGptPage();
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#anexo-rail-host .ax-rail')).toBeVisible();
  await expect(page.locator('#anexo-overlay-host')).toHaveCount(1);
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toContainText('Anexo');

  await page.screenshot({ path: resolve(process.cwd(), 'test-results/anexo-surfaces.png') });

  expect(errors.filter((text) => !/favicon|ERR_FAILED/i.test(text))).toEqual([]);
  await page.close();
});

test('persists a settings toggle through the Command Center', async () => {
  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });

  await openCommandCenter(page);
  const sidebarRow = page
    .locator('#anexo-overlay-host .ax-setting-row')
    .filter({ hasText: 'Conversation organizer' })
    .first();
  const toggle = sidebarRow.getByRole('switch');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#anexo-sidebar-host')).toBeHidden();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#anexo-overlay-host')).toHaveCount(1);
  await expect(page.locator('#anexo-sidebar-host')).toBeHidden();

  await openCommandCenter(page);
  const restored = page
    .locator('#anexo-overlay-host .ax-setting-row')
    .filter({ hasText: 'Conversation organizer' })
    .first()
    .getByRole('switch');
  await expect(restored).toHaveAttribute('aria-checked', 'false');
  await restored.click();

  const launcher = page.locator('#anexo-sidebar-host .ax-sidebar-launcher');
  await expect(launcher).toBeVisible();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#anexo-overlay-host .ax-command')).toBeHidden();
  await launcher.click();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible();

  await page.close();
});

test('opens the organizer from the leaf launcher and closes it on an outside click', async () => {
  const page = await newChatGptPage({ openSidebar: false });
  const launcher = page.locator('#anexo-sidebar-host .ax-sidebar-launcher');
  const panel = page.locator('#anexo-sidebar-host .ax-sidebar');

  await expect(launcher).toBeVisible({ timeout: 20_000 });
  await expect(panel).toBeHidden();
  await expect(launcher).toHaveAttribute('aria-expanded', 'false');

  await launcher.click();
  await expect(panel).toBeVisible();
  await expect(launcher).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.locator('.ax-sidebar__search')).toBeVisible();

  await page.locator('.main__header').click();
  await expect(panel).toBeHidden();

  await launcher.click();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();

  await page.close();
});

test('lists conversations and assigns them to a folder', async () => {
  const page = await newChatGptPage();
  const sidebar = page.locator('#anexo-sidebar-host');
  await expect(sidebar.locator('.ax-conv-row__link')).toHaveCount(2, { timeout: 20_000 });
  expect(conversationAuth).toBe('Bearer test-session-token');

  await sidebar.locator('.ax-sidebar__new').click();
  await sidebar.locator('.ax-folder-form input').fill('QA Folder');
  await expect(sidebar.locator('.ax-folder-form .ax-folder-swatch')).toHaveCount(8);
  await sidebar.locator('.ax-folder-form').getByRole('button', { name: 'Clay' }).click();
  await expect(
    sidebar.locator('.ax-folder-form').getByRole('button', { name: 'Clay' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await sidebar.locator('.ax-folder-form button[type="submit"]').click();
  const folderRow = sidebar.locator('.ax-folder-row').filter({ hasText: 'QA Folder' });
  await expect(folderRow).toBeVisible();
  await expect(folderRow.locator('.ax-folder-dot')).toHaveCSS(
    'background-color',
    'rgb(176, 137, 104)',
  );

  await sidebar.locator('.ax-folder-row').filter({ hasText: 'All chats' }).click();
  const firstRow = sidebar.locator('.ax-conv-row').first();
  await firstRow.hover();
  await firstRow.locator('.ax-conv-row__menu-btn').click();
  await sidebar.locator('.ax-conv-menu__folders button').filter({ hasText: 'QA Folder' }).click();

  await folderRow.click();
  await expect(sidebar.locator('.ax-conv-row__link')).toHaveCount(1);
  await expect(sidebar.locator('.ax-conv-row__link').first()).toContainText(
    'Designing a local-first bookmark system',
  );

  await sidebar.locator('.ax-sidebar__search').fill('zzzz');
  await expect(sidebar.getByText('No conversations match your filters.')).toBeVisible();

  await page.close();
});

test('opens the right rail and reports capabilities', async () => {
  const page = await newChatGptPage();
  await expect(page.locator('#anexo-rail-host .ax-rail')).toBeVisible({ timeout: 20_000 });

  const rootHeight = await page.evaluate(() => {
    const host = document.querySelector('#anexo-rail-host')?.getBoundingClientRect().height ?? 0;
    const root =
      document
        .querySelector('#anexo-rail-host')
        ?.shadowRoot?.querySelector<HTMLElement>('.ax-root')
        ?.getBoundingClientRect().height ?? 0;
    return { host, root };
  });
  expect(rootHeight.root).toBeCloseTo(rootHeight.host, 0);

  await page.locator('#anexo-rail-host .ax-whisker-tab').nth(1).click();
  await expect(page.locator('#anexo-rail-host .ax-rail__panel')).toBeVisible();
  await expect(page.locator('#anexo-rail-host .ax-rail__title')).toContainText('Bookmarks');

  const rail = await page.evaluate(() => {
    const hostEl = document.querySelector('#anexo-rail-host');
    const host = hostEl?.getBoundingClientRect();
    const root = hostEl?.shadowRoot
      ?.querySelector<HTMLElement>('.ax-root')
      ?.getBoundingClientRect();
    const panel = hostEl?.shadowRoot
      ?.querySelector<HTMLElement>('.ax-rail__panel')
      ?.getBoundingClientRect();
    return {
      hostHeight: host?.height ?? 0,
      hostTop: host?.top ?? 0,
      hostBottom: host?.bottom ?? 0,
      rootHeight: root?.height ?? 0,
      panelHeight: panel?.height ?? 0,
      panelBottom: panel?.bottom ?? 0,
      maxHost: window.innerHeight * 0.72 + 1,
    };
  });
  expect(rail.rootHeight).toBeCloseTo(rail.hostHeight, 0);
  expect(rail.panelHeight).toBeGreaterThan(180);
  expect(rail.panelHeight).toBeLessThanOrEqual(rail.hostHeight + 1);
  expect(rail.panelBottom).toBeCloseTo(rail.hostBottom, 0);
  expect(rail.hostHeight).toBeLessThanOrEqual(rail.maxHost);
  expect(rail.hostTop).toBeGreaterThanOrEqual(0);

  await page.close();
});

test('closes the right rail when clicking elsewhere', async () => {
  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });

  const panel = page.locator('#anexo-rail-host .ax-rail__panel');
  if (!(await panel.isVisible().catch(() => false))) {
    await page.locator('#anexo-rail-host .ax-whisker-tab').nth(1).click();
  }
  await expect(panel).toBeVisible();

  await page.locator('.main__header').click();
  await expect(panel).toHaveCount(0, { timeout: 5_000 });

  await page.close();
});

test('runs the ChatGPT adapter diagnostics check', async () => {
  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });

  await openCommandCenter(page);
  await page.locator('#anexo-overlay-host .ax-nav-item').last().click();
  const adapterCard = page.locator('#anexo-overlay-host .ax-card').last();
  await expect(adapterCard).toContainText('ChatGPT');
  await adapterCard.getByRole('button').click();
  await expect(adapterCard).toContainText('ok', { timeout: 10_000 });

  await page.close();
});

test('renders popup, welcome and options without an account', async () => {
  const [worker] = context.serviceWorkers();
  expect(worker).toBeDefined();
  const extensionId = new URL(worker!.url()).host;

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'load' });
  await expect(popup.getByRole('heading', { name: 'Anexo' })).toBeVisible();
  await expect(popup.getByText('Open ChatGPT')).toBeVisible();
  await expect(popup.getByText('No account · Local data', { exact: true })).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Command Center' })).toBeVisible();
  await expect(popup.getByRole('switch', { name: 'Minimap' })).toHaveCount(0);
  await popup.close();

  const welcome = await context.newPage();
  await welcome.goto(`chrome-extension://${extensionId}/welcome.html`, { waitUntil: 'load' });
  await expect(welcome.getByText('Language', { exact: true }).first()).toBeVisible();
  await expect(welcome.getByText('简体中文', { exact: true })).toBeVisible();
  await welcome.close();

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'load' });
  await expect(options.getByRole('heading', { name: 'Anexo settings' })).toBeVisible();
  await expect(options.getByPlaceholder(/Paste an API key/i)).toBeEnabled();
  await expect(options.getByRole('button', { name: 'Test connection' })).toBeEnabled();
  await options.close();
});

test('configures BYOK and streams the optimizer and side chat', async () => {
  test.slow();
  const [worker] = context.serviceWorkers();
  const extensionId = new URL(worker!.url()).host;

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'load' });
  await expect(options.getByRole('heading', { name: 'Anexo settings' })).toBeVisible();

  await options.getByPlaceholder('https://api.openai.com/v1').fill('http://127.0.0.1:11435/v1');
  await options.getByPlaceholder('gpt-5', { exact: true }).fill('mock-optimizer');
  await options.locator('select').nth(1).selectOption('max');
  await options.locator('input[type="password"]').fill('test-key');

  await options.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(options.locator('.ax-badge').filter({ hasText: 'Saved' })).toBeVisible();

  await options.getByRole('button', { name: 'Test connection' }).click();
  await expect(options.getByText(/Connected in \d+ ms/)).toBeVisible({ timeout: 20_000 });

  // The raw key must never be written to chrome.storage.local (the DB file).
  const stored = await options.evaluate(async () => {
    const chromeApi = (
      globalThis as unknown as {
        chrome: { storage: { local: { get: (keys: null) => Promise<Record<string, unknown>> } } };
      }
    ).chrome;
    return JSON.stringify(await chromeApi.storage.local.get(null));
  });
  expect(stored).not.toContain('test-key');
  await options.close();

  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });

  const chip = page.locator('#anexo-overlay-host .ax-optimize-chip');
  await expect(chip).toHaveCount(0);

  const composer = page.locator('#prompt-textarea');
  await composer.click();
  await page.keyboard.type('write about cats');

  await expect(chip).toBeVisible({ timeout: 20_000 });

  const pageLeak = await page.evaluate(
    () =>
      document.documentElement.innerHTML.includes('test-key') ||
      JSON.stringify(localStorage).includes('test-key'),
  );
  expect(pageLeak).toBe(false);

  await chip.click();
  const dialog = page.locator('#anexo-overlay-host .ax-optimizer');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.ax-optimizer__output')).toContainText(
    'Rewrite this as a clear, detailed prompt',
    { timeout: 20_000 },
  );

  const lastRequest = (await (await fetch('http://127.0.0.1:11435/v1/_last')).json()) as Record<
    string,
    unknown
  >;
  expect(lastRequest).toMatchObject({
    model: 'mock-optimizer',
    stream: true,
    reasoning_effort: 'max',
    firstRole: 'system',
    messageCount: 2,
    hasAuth: true,
  });
  expect(lastRequest.max_tokens).toBe(700);

  await dialog.getByRole('button', { name: 'Use prompt' }).click();
  await expect(dialog).toBeHidden();
  await expect(composer).toContainText('Rewrite this as a clear, detailed prompt');

  await page.locator('#anexo-rail-host .ax-whisker-tab').nth(3).click();
  const sideInput = page.locator('#anexo-rail-host .ax-sidechat__input');
  await expect(sideInput).toBeVisible();
  await sideInput.fill('What is this chat about?');
  await sideInput.press('Enter');

  await expect(page.locator('#anexo-rail-host .ax-sidechat__msg--user').last()).toContainText(
    'What is this chat about?',
  );
  await expect(page.locator('#anexo-rail-host .ax-sidechat__msg--assistant').last()).toContainText(
    'Rewrite this as a clear',
    { timeout: 20_000 },
  );

  await page.close();
});

test('optimizes a new prompt with AI in the library', async () => {
  const page = await newChatGptPage();
  await openCommandCenter(page);
  await page.locator('#anexo-overlay-host .ax-nav-item').filter({ hasText: 'Library' }).click();

  const card = page.locator('#anexo-overlay-host .ax-prompt-library .ax-card');
  const content = card.getByPlaceholder(/Write the prompt/);
  await card.getByPlaceholder('e.g. Code review').fill('AI optimized prompt');
  await content.fill('write about cats');

  const optimize = card.getByRole('button', { name: 'AI optimize' });
  await expect(optimize).toBeEnabled();
  await optimize.click();
  await expect(content).toHaveValue(/Rewrite this as a clear, detailed prompt/, {
    timeout: 20_000,
  });
  await expect(
    page
      .locator('#anexo-overlay-host .ax-prompt-library')
      .getByText('AI optimized the draft. Review it before saving.'),
  ).toBeVisible();

  await card.getByRole('button', { name: 'Add prompt' }).click();
  await expect(
    page.locator('#anexo-overlay-host .ax-prompt-row').filter({ hasText: 'AI optimized prompt' }),
  ).toBeVisible();

  await page.close();
});

test('suggests follow-ups with the configured provider', async () => {
  const [worker] = context.serviceWorkers();
  const extensionId = new URL(worker!.url()).host;

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'load' });
  await expect(options.getByRole('heading', { name: 'Anexo settings' })).toBeVisible();
  await options.getByPlaceholder('gpt-5', { exact: true }).fill('mock-followups');
  await options.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(options.locator('.ax-badge').filter({ hasText: 'Saved' })).toBeVisible();

  await options.evaluate(async () => {
    const chromeApi = (
      globalThis as unknown as {
        chrome: { runtime: { sendMessage: (message: unknown) => Promise<unknown> } };
      }
    ).chrome;
    await chromeApi.runtime.sendMessage({
      type: 'db:command',
      command: { kind: 'settings/patch', patch: { features: { followUps: 'ai' } } },
    });
  });
  await options.close();

  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });

  await page.locator('#anexo-rail-host .ax-whisker-tab').nth(4).click();
  const panel = page.locator('#anexo-rail-host .ax-followups');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Suggest follow-ups' }).click();
  await expect(panel.locator('.ax-followups__item')).toHaveCount(3, { timeout: 20_000 });
  await expect(panel.locator('.ax-followups__item').first()).toHaveText('Tell me more');

  await panel.locator('.ax-followups__item').nth(1).click();
  await expect(page.locator('#prompt-textarea')).toContainText('Show me an example');

  const lastRequest = (await (await fetch('http://127.0.0.1:11435/v1/_last')).json()) as Record<
    string,
    unknown
  >;
  expect(lastRequest).toMatchObject({
    model: 'mock-followups',
    firstRole: 'system',
    messageCount: 2,
    hasAuth: true,
  });
  expect(lastRequest.max_tokens).toBe(900);

  await page.close();
});

test('surfaces provider authentication and rate-limit errors', async () => {
  const [worker] = context.serviceWorkers();
  const extensionId = new URL(worker!.url()).host;

  await setProviderModel(extensionId, 'mock-401');

  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });
  await page.locator('#prompt-textarea').click();
  await page.keyboard.type('rewrite this prompt');

  const chip = page.locator('#anexo-overlay-host .ax-optimize-chip');
  await expect(chip).toBeVisible({ timeout: 20_000 });
  await chip.click();

  const dialog = page.locator('#anexo-overlay-host .ax-optimizer');
  await expect(dialog.locator('.ax-optimizer__error')).toContainText('Invalid API key', {
    timeout: 10_000,
  });
  await dialog.locator('.ax-optimizer__header .ax-icon-btn').click();

  await setProviderModel(extensionId, 'mock-429');
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(dialog.locator('.ax-optimizer__error')).toContainText('Rate limit reached', {
    timeout: 10_000,
  });
  await dialog.locator('.ax-optimizer__header .ax-icon-btn').click();

  await page.close();
});

test('stops an in-flight side chat stream', async () => {
  const [worker] = context.serviceWorkers();
  const extensionId = new URL(worker!.url()).host;

  await setProviderModel(extensionId, 'mock-abort');

  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });

  const railTab = page.locator('#anexo-rail-host .ax-whisker-tab').nth(3);
  const sideInput = page.locator('#anexo-rail-host .ax-sidechat__input');
  await railTab.click();
  if (!(await sideInput.isVisible().catch(() => false))) await railTab.click();
  await expect(sideInput).toBeVisible();

  await sideInput.fill('Start a stream that never ends');
  await sideInput.press('Enter');

  const streamed = page.locator('#anexo-rail-host .ax-sidechat__msg--assistant').last();
  await expect(streamed).toContainText('This stream will never finish.', { timeout: 10_000 });

  const stop = page.locator('#anexo-rail-host .ax-sidechat__send svg.lucide-square');
  await expect(stop).toBeVisible();
  await stop.click();

  await expect(stop).toHaveCount(0);
  await expect(page.locator('#anexo-rail-host .ax-sidechat__msg--assistant').last()).toContainText(
    'This stream will never finish.',
  );

  await page.close();
});

test('builds the minimap and creates bookmarks and notes', async () => {
  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });

  const minimapTab = page.locator('#anexo-rail-host .ax-whisker-tab').nth(0);
  const minimap = page.locator('#anexo-rail-host .ax-minimap');
  await minimapTab.click();
  await page.waitForTimeout(1_000);
  if (!(await minimap.isVisible().catch(() => false))) await minimapTab.click();
  await expect(minimap).toBeVisible();
  // The default depth is "prompts", so only the user message is listed first.
  await expect(page.locator('#anexo-rail-host .ax-outline-row')).toHaveCount(1, {
    timeout: 15_000,
  });
  await minimap.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('#anexo-rail-host .ax-outline-row')).toHaveCount(2);

  const first = page.locator('#anexo-rail-host .ax-minimap .ax-outline-row').first();
  await first.locator('.ax-outline-row__main').click();
  await expect(page.locator('[data-user-message-bubble="true"]').first()).toHaveCSS(
    'outline-color',
    'rgb(139, 157, 119)',
  );

  const second = page.locator('#anexo-rail-host .ax-minimap .ax-outline-row').nth(1);
  await second.locator('.ax-outline-row__main').click();
  await expect(page.locator('[data-chatgpt-selection-message-id="msg-assistant-1"]')).toHaveCSS(
    'outline-color',
    'rgb(139, 157, 119)',
  );

  await first.getByRole('button', { name: 'Bookmark message' }).click();

  await page.locator('#anexo-rail-host .ax-whisker-tab').nth(1).click();
  await expect(page.locator('#anexo-rail-host .ax-bookmarks .ax-outline-row')).toHaveCount(1);

  await page.locator('#anexo-rail-host .ax-whisker-tab').nth(0).click();
  await expect(minimap).toBeVisible();
  await page
    .locator('#anexo-rail-host .ax-minimap .ax-outline-row')
    .first()
    .getByRole('button', { name: 'Add note' })
    .click();

  const notes = page.locator('#anexo-rail-host .ax-notes');
  await expect(notes).toBeVisible();
  await notes.locator('.ax-note-editor__input').fill('A note anchored to the user message.');
  await notes.getByRole('button', { name: 'Add note' }).click();
  await expect(notes.locator('.ax-note-row')).toHaveCount(1);

  await page.close();
});

test('adds a prompt and inserts it from the palette', async () => {
  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });

  await openCommandCenter(page);
  await page.locator('#anexo-overlay-host .ax-nav-item').filter({ hasText: 'Library' }).click();

  const library = page.locator('#anexo-overlay-host .ax-prompt-library');
  await expect(library).toBeVisible();
  await library.getByPlaceholder('e.g. Code review').fill('Review prompt');
  await library
    .getByPlaceholder(/Write the prompt/)
    .fill('Review this code for bugs and edge cases.');
  await library.getByRole('button', { name: 'Add prompt' }).click();
  await expect(
    library.locator('.ax-prompt-row').filter({ hasText: 'Review prompt' }),
  ).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#anexo-overlay-host .ax-command')).toBeHidden();

  await expect(page.locator('#anexo-overlay-host .ax-prompt-chip')).toHaveCount(0);

  await page.locator('#prompt-textarea').fill('//');
  const palette = page.locator('#anexo-overlay-host .ax-prompt-palette');
  await expect(palette).toBeVisible();
  await palette.locator('.ax-prompt-palette__item').filter({ hasText: 'Review prompt' }).click();
  await expect(page.locator('#prompt-textarea')).toContainText(
    'Review this code for bugs and edge cases.',
  );

  await page.close();
});

test('exports a conversation as Markdown', async () => {
  const page = await newChatGptPage();
  await expect(page.locator('#anexo-sidebar-host .ax-sidebar')).toBeVisible({ timeout: 20_000 });

  const firstRow = page.locator('#anexo-sidebar-host .ax-conv-row').first();
  await firstRow.hover();
  await firstRow.locator('.ax-conv-row__menu-btn').click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page
      .locator('#anexo-sidebar-host .ax-conv-menu button')
      .filter({ hasText: 'Export Markdown' })
      .click(),
  ]);

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const text = await readFile(downloadPath!, 'utf8');
  expect(text).toContain('# Designing a local-first bookmark system');
  expect(text).toContain('How should I design bookmarks that survive DOM changes?');
  expect(download.suggestedFilename()).toMatch(/\.md$/);

  await page.close();
});

test('selects multiple conversations for bulk actions', async () => {
  const page = await newChatGptPage();
  const sidebar = page.locator('#anexo-sidebar-host');
  await expect(sidebar.locator('.ax-conv-row__link')).toHaveCount(2, { timeout: 20_000 });

  await sidebar.locator('button[title="Select"]').click();
  await expect(sidebar.locator('.ax-conv-check input')).toHaveCount(2);
  await sidebar.locator('.ax-conv-check input').first().check();
  await expect(sidebar.locator('.ax-bulk-bar')).toContainText('1 selected');

  await sidebar.locator('.ax-bulk-bar').getByRole('button', { name: 'Star', exact: true }).click();
  await expect(sidebar.locator('.ax-bulk-bar')).toContainText('0 selected');

  await sidebar.locator('.ax-conv-check input').nth(0).check();
  await sidebar.locator('.ax-conv-check input').nth(1).check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    sidebar.locator('.ax-bulk-bar').getByRole('button', { name: 'Export ZIP' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const files = unzipSync(new Uint8Array(await readFile(downloadPath!)));
  expect(Object.keys(files).filter((name) => name.endsWith('.md'))).toHaveLength(2);
  expect(Object.keys(files).filter((name) => name.endsWith('.html'))).toHaveLength(2);
  expect(Object.keys(files)).toContain('README.txt');

  await page.close();
});

test('drags a folder to nest it and to reorder siblings', async () => {
  const page = await newChatGptPage();
  const sidebar = page.locator('#anexo-sidebar-host');
  await expect(sidebar.locator('.ax-conv-row__link')).toHaveCount(2, { timeout: 20_000 });

  for (const name of ['Drag A', 'Drag B', 'Drag C']) {
    await sidebar.locator('.ax-sidebar__new').click();
    await sidebar.locator('.ax-folder-form input').fill(name);
    await sidebar.locator('.ax-folder-form button[type="submit"]').click();
    await expect(sidebar.locator('.ax-folder-row').filter({ hasText: name })).toBeVisible();
  }

  const rowA = sidebar.locator('.ax-folder-row').filter({ hasText: 'Drag A' });
  const rowB = sidebar.locator('.ax-folder-row').filter({ hasText: 'Drag B' });
  const rowC = sidebar.locator('.ax-folder-row').filter({ hasText: 'Drag C' });

  await rowA.dragTo(rowB);
  await expect.poll(async () => rowA.evaluate((element) => element.style.paddingLeft)).toBe('18px');

  await rowC.dragTo(rowB, { targetPosition: { x: 20, y: 2 } });
  const cBox = await rowC.boundingBox();
  const bBox = await rowB.boundingBox();
  expect(cBox).toBeTruthy();
  expect(bBox).toBeTruthy();
  expect(cBox!.y).toBeLessThan(bBox!.y);

  await page.close();
});

test('deletes conversations on ChatGPT as well as locally', async () => {
  deletedConversationIds.clear();
  const page = await newChatGptPage();
  const sidebar = page.locator('#anexo-sidebar-host');
  await expect(sidebar.locator('.ax-conv-row__link')).toHaveCount(2, { timeout: 20_000 });

  const firstRow = sidebar
    .locator('.ax-conv-row')
    .filter({ hasText: 'Designing a local-first bookmark system' });
  await firstRow.hover();
  await firstRow.locator('.ax-conv-row__menu-btn').click();
  const menu = sidebar.locator('.ax-conv-menu');
  await menu.getByRole('button', { name: 'Delete chat' }).click();
  await menu
    .locator('.ax-conv-menu__confirm')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();

  await expect(sidebar.locator('.ax-conv-row__link')).toHaveCount(1);
  await expect.poll(() => deletedConversationIds.has('conv-anexo-1')).toBe(true);

  await sidebar.locator('button[title="Select"]').click();
  await sidebar.locator('.ax-conv-check input').check();
  const bulk = sidebar.locator('.ax-bulk-bar');
  await bulk.getByRole('button', { name: 'Delete', exact: true }).click();
  await bulk.getByRole('button', { name: 'Confirm', exact: true }).click();

  await expect(sidebar.locator('.ax-conv-row__link')).toHaveCount(0);
  await expect.poll(() => deletedConversationIds.has('conv-anexo-2')).toBe(true);
  await expect(sidebar.getByText('No conversations yet.')).toBeVisible();

  await page.close();
});
