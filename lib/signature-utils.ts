import { parseHtmlSafely, sanitizeSignatureHtml } from '@/lib/email-sanitization';

type SignatureSource = {
  textSignature?: string;
  htmlSignature?: string;
};

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'div',
  'footer',
  'header',
  'li',
  'nav',
  'p',
  'section',
  'tr',
]);

function normalizeSignatureLineBreaks(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToPlainText(html: string): string {
  const document = parseHtmlSafely(html);
  const chunks: string[] = [];

  const appendText = (value: string) => {
    if (!value) return;
    const normalized = value.replace(/\s+/g, ' ');
    if (!normalized.trim()) return;
    const previous = chunks[chunks.length - 1];
    if (previous && !previous.endsWith('\n') && !previous.endsWith(' ')) {
      chunks.push(' ');
    }
    chunks.push(normalized);
  };

  const appendNewline = () => {
    const previous = chunks[chunks.length - 1];
    if (previous === '\n') return;
    if (previous?.endsWith('\n')) return;
    chunks.push('\n');
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.textContent || '');
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'br') {
      appendNewline();
      return;
    }

    if (tagName === 'a') {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
      const href = element.getAttribute('href')?.trim() || '';
      const normalizedHref = href.replace(/^mailto:/i, '');
      if (text && normalizedHref && text === normalizedHref) {
        appendText(text);
        return;
      }
      if (text && href && text !== href) {
        appendText(`${text} <${href}>`);
        return;
      }
    }

    if (BLOCK_TAGS.has(tagName) && chunks.length > 0) {
      appendNewline();
    }

    Array.from(element.childNodes).forEach(walk);

    if (BLOCK_TAGS.has(tagName)) {
      appendNewline();
    }
  };

  Array.from(document.body.childNodes).forEach(walk);
  return normalizeSignatureLineBreaks(chunks.join(''));
}

export function getPlainTextSignature(signature?: SignatureSource | null): string {
  if (signature?.textSignature?.trim()) {
    return normalizeSignatureLineBreaks(signature.textSignature);
  }

  if (signature?.htmlSignature?.trim()) {
    return htmlToPlainText(sanitizeSignatureHtml(signature.htmlSignature));
  }

  return '';
}

export function appendPlainTextSignature(
  body: string,
  signature?: SignatureSource | null,
  options: { separator?: boolean } = {},
): string {
  const plainTextSignature = getPlainTextSignature(signature);
  if (!plainTextSignature) {
    return body;
  }

  const sep = options.separator === false ? '\n\n' : '\n\n-- \n';
  return `${body}${sep}${plainTextSignature}`;
}

export function hasMeaningfulHtmlBody(html: string): boolean {
  if (!html.trim()) return false;

  const document = parseHtmlSafely(html);
  const richSelector = [
    'table',
    'img',
    'style',
    'b',
    'strong',
    'i',
    'em',
    'u',
    'font',
    'a[href]',
    'div[style]',
    'span[style]',
    'p[style]',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'blockquote',
    'br',
  ].join(', ');

  if (document.querySelector(richSelector)) {
    return true;
  }

  const blockElements = document.body.querySelectorAll('p, div, blockquote, li');
  return blockElements.length > 1;
}