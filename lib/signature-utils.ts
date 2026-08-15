import { parseHtmlSafely, sanitizeSignatureHtml } from '@/lib/email-sanitization';
import { htmlToPlainText } from '@/lib/html-to-text';

type SignatureSource = {
  textSignature?: string;
  htmlSignature?: string;
};

function normalizeSignatureLineBreaks(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

/**
 * Append a signature to an HTML body, preserving rich formatting. Used by the
 * quick-reply path so an HTML signature keeps its markup instead of being
 * flattened to plain text. Mirrors the composer's send-time signature block
 * (`buildSignatureHtml` in email-composer.tsx).
 */
export function appendHtmlSignature(
  htmlBody: string,
  signature?: SignatureSource | null,
  options: { separator?: boolean } = {},
): string {
  const sep = options.separator === false ? '<br><br>' : '<br><br>-- <br>';

  if (signature?.htmlSignature?.trim()) {
    return `${htmlBody}${sep}${sanitizeSignatureHtml(signature.htmlSignature)}`;
  }

  if (signature?.textSignature?.trim()) {
    const escaped = signature.textSignature
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return `${htmlBody}${sep}${escaped}`;
  }

  return htmlBody;
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