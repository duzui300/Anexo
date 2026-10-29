import { defineContentScript } from 'wxt/utils/define-content-script';
import { boot } from '@/app/lifecycle';

const matches = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];

if (__ANEXO_E2E__) {
  matches.push('http://localhost:4173/*', 'http://127.0.0.1:4173/*');
}

export default defineContentScript({
  matches,
  runAt: 'document_start',
  allFrames: false,
  main() {
    void boot();
  },
});
