import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { registerAiPort, testAiConnection } from '@/ai/background';
import { dispatchCommand, getDb, initDb } from '@/data/db-service';
import { log } from '@/platform/logger';
import { registerRequestHandler } from '@/platform/messaging';

export default defineBackground(() => {
  void initDb().catch((error) => log.error('Failed to initialize Anexo data', error));
  registerAiPort();

  browser.runtime.onInstalled.addListener(async (details) => {
    try {
      await initDb();
    } catch (error) {
      log.error('Failed to initialize Anexo data on install', error);
    }

    if (details.reason === 'install') {
      await browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
    }
  });

  registerRequestHandler(async (message) => {
    switch (message.type) {
      case 'db:snapshot':
        return getDb();
      case 'db:command':
        return dispatchCommand(message.command);
      case 'ai:test':
        return testAiConnection();
      case 'ui:openOptions':
        await browser.runtime.openOptionsPage();
        return true;
      case 'ui:openCommandCenter':
        return true;
    }
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== 'open-command-center') return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await browser.tabs.sendMessage(tab.id, { type: 'ui:openCommandCenter' }).catch(() => {
      // The active tab is not a ChatGPT page.
    });
  });
});
