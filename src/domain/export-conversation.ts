import type { ConversationDetail, ConversationMessage } from '@/types/chatgpt';

function messagesOf(detail: ConversationDetail): ConversationMessage[] {
  return detail.messages.filter(
    (message) => message.role === 'user' || message.role === 'assistant',
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9一-鿿]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'chat'
  );
}

function timestampLabel(value: number | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
}

export function conversationFileName(detail: ConversationDetail, extension: string): string {
  return `chatgpt-${slug(detail.title || 'untitled')}-${detail.id.slice(0, 8)}.${extension}`;
}

export function conversationToMarkdown(detail: ConversationDetail): string {
  const lines: string[] = [
    `# ${detail.title || 'Untitled'}`,
    '',
    `> Conversation: ${detail.id}`,
  ];
  if (detail.createTime) lines.push(`> Created: ${timestampLabel(detail.createTime)}`);

  for (const message of messagesOf(detail)) {
    lines.push('', '---', '');
    const label = message.role === 'user' ? '### 🧑 User' : '### 🤖 Assistant';
    lines.push(label, '', message.text);
  }

  lines.push('');
  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function conversationToHtml(detail: ConversationDetail): string {
  const title = escapeHtml(detail.title || 'Untitled');
  const blocks = messagesOf(detail)
    .map((message) => {
      const role = message.role === 'user' ? 'User' : 'Assistant';
      const paragraphs = message.text
        .split(/\n{2,}/)
        .map((chunk) => chunk.replace(/\n/g, '<br>'))
        .map((chunk) => `<p>${escapeHtml(chunk)}</p>`)
        .join('\n');
      return `<section class="message ${message.role}">\n<h2>${role}</h2>\n${paragraphs}\n</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ChatGPT export</title>
<style>
  :root { color-scheme: light; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
         max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; color: #0f172a;
         background: #fff; line-height: 1.6; }
  h1 { font-size: 22px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
  .message.user { border-left: 3px solid #10a37f; padding-left: 12px; }
  .message.assistant { border-left: 3px solid #0d9488; padding-left: 12px; }
  p { margin: 8px 0; overflow-wrap: anywhere; }
  footer { margin-top: 32px; color: #94a3b8; font-size: 12px; }
</style>
</head>
<body>
<h1>${title}</h1>
<p>Conversation: ${escapeHtml(detail.id)}</p>
${blocks}
<footer>Exported by Anexo (open source). Not affiliated with OpenAI.</footer>
</body>
</html>
`;
}