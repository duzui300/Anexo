import { getComposer } from './selectors';

export function getComposerText(): string {
  const composer = getComposer();
  if (!composer) return '';
  if (composer instanceof HTMLTextAreaElement) return composer.value;
  return composer.innerText ?? composer.textContent ?? '';
}

export function setComposerText(text: string): boolean {
  const composer = getComposer();
  if (!composer) return false;

  composer.focus();

  if (composer instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(composer, text);
    else composer.value = text;
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (composer.isContentEditable) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composer);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const inserted =
      typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, text);

    if (!inserted) {
      composer.textContent = text;
      composer.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
      );
      const end = document.createRange();
      end.selectNodeContents(composer);
      end.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(end);
    }
    return true;
  }

  return false;
}
