import { strToU8, zipSync } from 'fflate';
import type { ConversationDetail } from '@/types/chatgpt';
import { conversationFileName, conversationToHtml, conversationToMarkdown } from './export-conversation';

export interface BulkExportResult {
  bytes: Uint8Array;
  conversations: number;
  files: number;
}

/** Builds a ZIP with Markdown and HTML files for each conversation. */
export function buildConversationZip(
  details: readonly ConversationDetail[],
  generatedAt = new Date(),
): BulkExportResult {
  const entries: Record<string, Uint8Array> = {};
  let files = 0;

  for (const detail of details) {
    const markdownName = conversationFileName(detail, 'md');
    const htmlName = conversationFileName(detail, 'html');
    entries[markdownName] = strToU8(conversationToMarkdown(detail));
    entries[htmlName] = strToU8(conversationToHtml(detail));
    files += 2;
  }

  entries['README.txt'] = strToU8(
    [
      `Anexo conversation export`,
      `Generated: ${generatedAt.toISOString()}`,
      `Conversations: ${details.length}`,
      '',
      'Each conversation includes a Markdown transcript and a self-contained HTML file.',
      'Anexo is an independent, MIT-licensed project and is not affiliated with OpenAI.',
      '',
    ].join('\n'),
  );
  files += 1;

  return {
    bytes: zipSync(entries, { level: 6 }),
    conversations: details.length,
    files,
  };
}
