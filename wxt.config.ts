import { defineConfig } from 'wxt';

const isE2E = process.env.E2E === '1';

// Playwright drives an unpacked build; pre-granting the local mock origin keeps
// the optional-permission prompt (a native dialog) out of automated runs.
const hostPermissions = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];
if (isE2E) hostPermissions.push('http://127.0.0.1/*');

/**
 * Keep the extension surface minimal:
 * - no identity/cookies/tabs/webRequest
 * - ChatGPT hosts only for content scripts
 * - AI providers are opt-in optional host permissions
 */
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: {
    name: 'Anexo',
    short_name: 'Anexo',
    description:
      'Local-first ChatGPT companion: folders, bookmarks, notes, minimap, exports, and BYOK AI.',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    permissions: ['storage'],
    host_permissions: hostPermissions,
    optional_host_permissions: [
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://openrouter.ai/*',
      'https://api.groq.com/*',
      'https://*/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ],
    commands: {
      'open-command-center': {
        suggested_key: {
          default: 'Ctrl+Shift+Comma',
          mac: 'Command+Shift+Comma',
        },
        description: 'Open Anexo Command Center',
      },
    },
    action: {
      default_title: 'Anexo',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },
  vite: () => ({
    define: {
      __ANEXO_E2E__: JSON.stringify(isE2E),
    },
  }),
});
