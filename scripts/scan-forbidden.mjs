import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Brand/endpoint strings that must not ship. Documentation may mention the original project for
 * provenance, so only executable source, assets, and the built manifest are scanned.
 */
const FORBIDDEN = [
  'api.gptmaster.app',
  'gptmaster',
  'gpt-master',
  'google-analytics.com',
  'googletagmanager.com',
  'stripe.com',
  'checkout.stripe',
  'review_prompt',
  'upsell',
];

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.wxt',
  'coverage',
  'playwright-report',
  'test-results',
  'reference-local',
]);
const SKIP_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2']);
const SCAN_ROOTS = ['src', 'scripts', 'tests', 'public'];
const SCAN_FILES = ['wxt.config.ts', 'package.json'];

const manifestForbiddenPermissions = new Set([
  'identity',
  'cookies',
  'notifications',
  'webRequest',
  'webRequestBlocking',
  'tabs',
  'unlimitedStorage',
]);

function isSelf(file) {
  return file.endsWith(join('scripts', 'scan-forbidden.mjs'));
}

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
      continue;
    }
    if (SKIP_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    yield full;
  }
}

const files = [];

for (const root of SCAN_ROOTS) {
  for await (const file of walk(join(ROOT, root))) {
    if (!isSelf(file)) files.push(file);
  }
}
for (const file of SCAN_FILES) {
  files.push(join(ROOT, file));
}

const builtManifest = join(ROOT, '.output', 'chrome-mv3', 'manifest.json');
try {
  await readFile(builtManifest);
  files.push(builtManifest);
} catch {
  // Build has not run yet; source scan still applies.
}

const findings = [];

for (const file of files) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    continue;
  }
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const lower = text.toLowerCase();
  for (const needle of FORBIDDEN) {
    if (lower.includes(needle)) findings.push(`${rel}: contains "${needle}"`);
  }
}

try {
  const manifest = JSON.parse(await readFile(builtManifest, 'utf8'));
  for (const permission of manifest.permissions ?? []) {
    if (manifestForbiddenPermissions.has(permission)) {
      findings.push(`.output/chrome-mv3/manifest.json: forbidden permission "${permission}"`);
    }
  }
  for (const entry of manifest.host_permissions ?? []) {
    if (entry === '<all_urls>' || entry === 'https://*/*' || entry === 'http://*/*') {
      findings.push(`.output/chrome-mv3/manifest.json: broad required host permission "${entry}"`);
    }
  }
} catch {
  // No built manifest.
}

if (findings.length > 0) {
  console.error('Forbidden-string scan failed:\n');
  for (const finding of findings) console.error(`  - ${finding}`);
  process.exit(1);
}

console.log(`Forbidden-string scan passed (${files.length} files).`);
