import DOMPurify from 'dompurify';

/**
 * Unified DOMPurify configuration for email content
 * Blocks all script execution vectors while preserving formatting
 * NOTE: <style> tags are forbidden to prevent global CSS injection
 * Inline style attributes are still allowed for element-specific styling
 */
export const EMAIL_SANITIZE_CONFIG = {
  ADD_TAGS: [],
  ADD_ATTR: ['target', 'rel', 'style', 'class', 'width', 'height', 'align', 'valign', 'bgcolor', 'color'],
  ALLOW_DATA_ATTR: false,
  FORCE_BODY: true,
  // Allow blob: URIs so authenticated inline images (CID) are not stripped.
  // data: is restricted to a fixed set of raster image types. SVG (image/svg+xml)
  // is excluded because DOMPurify cannot inspect bytes inside a data: URI, so an
  // SVG payload can carry <script>/<foreignObject> that the surrounding sanitizer
  // never sees. The `(?=[;,])` anchor prevents prefix matches like image/png-evil.
  // eslint-disable-next-line no-useless-escape
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob):|data:image\/(?:png|jpe?g|gif|webp|bmp|avif|x-icon|vnd\.microsoft\.icon)(?=[;,])|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: [
    'script', 'iframe', 'object', 'embed', 'form',
    'input', 'button', 'meta', 'link', 'base',
    'svg', 'math', 'style'
  ],
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'onmouseover',
    'onfocus', 'onblur', 'onchange', 'onsubmit',
    'onkeydown', 'onkeyup', 'onmousedown', 'onmouseup'
  ],
};

/**
 * Sanitize email HTML content
 * @param html - Raw HTML content from email
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, EMAIL_SANITIZE_CONFIG);
}

/**
 * Sanitize config for emails rendered inside a sandboxed iframe.
 * Allows <style> tags because CSS is scoped to the iframe document and
 * cannot leak into the host app. Scripts are still blocked by the sandbox
 * attribute (no allow-scripts). Use ONLY for iframe-rendered content –
 * never for content rendered into the main DOM.
 */
export const EMAIL_IFRAME_SANITIZE_CONFIG = {
  ...EMAIL_SANITIZE_CONFIG,
  FORBID_TAGS: EMAIL_SANITIZE_CONFIG.FORBID_TAGS.filter((t) => t !== 'style'),
};

/**
 * Sanitize email HTML for rendering inside a sandboxed iframe.
 * Preserves <style> tags so the email's own CSS is applied.
 */
export function sanitizeEmailHtmlForIframe(html: string): string {
  return DOMPurify.sanitize(html, EMAIL_IFRAME_SANITIZE_CONFIG);
}

/**
 * Sanitize HTML signature with stricter rules
 * Allows basic formatting plus <img> for company logos, plus table-based
 * layouts (the de-facto standard for email signatures).
 */
export const SIGNATURE_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'span', 'div', 'img',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  ],
  ALLOWED_ATTR: [
    'href', 'style', 'class', 'src', 'alt', 'width', 'height', 'title',
    'cellpadding', 'cellspacing', 'border', 'valign', 'align', 'bgcolor',
    'colspan', 'rowspan',
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'video', 'audio'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

/**
 * Sanitize HTML signature for storage and display.
 * img src is restricted to https: or base64-embedded raster data: URIs
 * (png/jpeg/gif/webp). SVG is excluded because DOMPurify cannot inspect
 * bytes inside a data: URI. Images with a disallowed src are removed
 * entirely so they don't render as broken-image icons.
 * @param html - User-provided HTML signature
 * @returns Sanitized signature (no scripts, no external resources)
 */
export function sanitizeSignatureHtml(html: string): string {
  if (!html?.trim()) return '';
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'IMG') return;
    const src = node.getAttribute('src');
    if (!src || !/^(?:https:\/\/|data:image\/(?:png|jpe?g|gif|webp);base64,)/i.test(src)) {
      node.remove();
    }
  });
  try {
    return DOMPurify.sanitize(html, SIGNATURE_SANITIZE_CONFIG);
  } finally {
    DOMPurify.removeAllHooks();
  }
}

/**
 * Sanitizer for translation strings that contain inline markup (e.g. a
 * documentation link). The translation catalog is trusted today, but using
 * dangerouslySetInnerHTML on a translation makes that trust permanent and
 * implicit; this allowlist limits the blast radius if a translation ever
 * becomes attacker-influenced (community PR, crowdsourced service).
 */
const I18N_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['a', 'b', 'strong', 'i', 'em', 'u', 'span', 'br', 'code'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/|#)/i,
};

export function sanitizeI18nHtml(html: string): string {
  return DOMPurify.sanitize(html, I18N_SANITIZE_CONFIG);
}

/**
 * Sanitizer for the non-iframe branch of email rendering (plain-text bodies,
 * S/MIME plain-text, TNEF text, no-body fallbacks). The producer
 * (`plainTextToSafeHtml`) already escapes text and emits only safe <a> tags,
 * so this is defense-in-depth: it ensures the render site is safe even if a
 * future code path passes raw HTML in by mistake.
 */
const PLAIN_TEXT_RENDERED_CONFIG = {
  ALLOWED_TAGS: ['a', 'br', 'p', 'div', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|cid:|#)/i,
};

export function sanitizePlainTextRenderedHtml(html: string): string {
  return DOMPurify.sanitize(html, PLAIN_TEXT_RENDERED_CONFIG);
}

/**
 * Safe HTML parsing without execution
 * Use instead of innerHTML for detection/parsing
 */
export function parseHtmlSafely(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/**
 * Detect if HTML content has rich formatting
 * Safe alternative to innerHTML parsing
 */
export function hasRichFormatting(html: string): boolean {
  const doc = parseHtmlSafely(html);
  return !!doc.querySelector(
    'table, img, style, b, strong, i, em, u, font, ' +
    'div[style], span[style], p[style], ' +
    'h1, h2, h3, h4, h5, h6, ul, ol, blockquote'
  );
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Render a plain-text email body as HTML, HTML-escaping all content and
 * linkifying http(s) URLs. URLs terminate at whitespace or any character that
 * would break an attribute (`"`, `'`, `<`, `>`), so attribute-escaping is
 * enforced even if escaping has bugs.
 */
export function plainTextToSafeHtml(text: string, linkClass = ''): string {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const classAttr = linkClass ? ` class="${escapeHtml(linkClass)}"` : '';
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    const url = escapeHtml(match[0]);
    result += `<a href="${url}" target="_blank" rel="noopener noreferrer"${classAttr}>${url}</a>`;
    lastIndex = match.index + match[0].length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

/**
 * Collapse empty containers left behind when external images are blocked.
 * Walks up from each blocked img to find the nearest table cell or wrapper div
 * and hides it if it contains no meaningful visible content.
 */
export function collapseBlockedImageContainers(html: string): string {
  const doc = parseHtmlSafely(html);
  const blockedImages = doc.querySelectorAll('img[data-blocked-src]');

  blockedImages.forEach((img) => {
    let el: HTMLElement | null = img.parentElement;
    while (el && el !== doc.body) {
      if (el.tagName === 'TD' || el.tagName === 'TH' || (el.tagName === 'DIV' && el.parentElement?.tagName === 'TD')) {
        const hasVisibleText = el.textContent?.replace(/[\s\u00A0]+/g, '').trim();
        const hasVisibleMedia = el.querySelector('img:not([data-blocked-src]), video, canvas');
        const hasLinks = el.querySelector('a[href]');
        if (!hasVisibleText && !hasVisibleMedia && !hasLinks) {
          el.setAttribute('data-blocked-collapsed-style', el.style.cssText);
          el.style.display = 'none';
          el.style.height = '0';
          el.style.padding = '0';
          el.style.overflow = 'hidden';
        }
        break;
      }
      if (el.tagName === 'TABLE' || el.tagName === 'TR') break;
      el = el.parentElement;
    }
  });

  return doc.body.innerHTML;
}
