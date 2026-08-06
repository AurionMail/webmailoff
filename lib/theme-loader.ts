// Theme CSS injection and sanitization

import { DISALLOWED_CSS_PATTERNS } from './plugin-types';
import { syncThemeColorMeta } from './theme-color-meta';

const THEME_STYLE_ID = 'active-theme';
const THEME_SKIN_STYLE_ID = 'active-theme-skin';
const THEME_SKIN_BODY_ATTR = 'data-theme-skin';

/**
 * Sanitize theme CSS: strip dangerous patterns like @import, external url(),
 * JavaScript expressions, and -moz-binding. Returns cleaned CSS.
 */
export function sanitizeThemeCSS(css: string): { css: string; warnings: string[] } {
  const warnings: string[] = [];
  let cleaned = css;

  for (const pattern of DISALLOWED_CSS_PATTERNS) {
    if (pattern.test(cleaned)) {
      warnings.push(`Removed disallowed pattern: ${pattern.source}`);
      cleaned = cleaned.replace(new RegExp(pattern.source, 'gi'), '/* [removed] */');
    }
  }

  return { css: cleaned, warnings };
}

/**
 * Validate that theme CSS only targets :root and .dark selectors.
 * Returns warnings for any other selectors found.
 */
export function validateThemeSelectors(css: string): string[] {
  const warnings: string[] = [];

  // Remove comments
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Find selector blocks (text before { that isn't inside a value)
  const selectorRegex = /([^{}]+)\{/g;
  let match;
  while ((match = selectorRegex.exec(noComments)) !== null) {
    const selector = match[1].trim();
    // Allow :root, .dark, @font-face, @keyframes, @media
    if (
      selector === ':root' ||
      selector === '.dark' ||
      selector.startsWith('@font-face') ||
      selector.startsWith('@keyframes') ||
      selector.startsWith('@media') ||
      selector === ''
    ) {
      continue;
    }

    // Inside @media blocks, also allow :root and .dark
    if (selector === ':root' || selector === '.dark') continue;

    warnings.push(`Non-standard selector "${selector}" - themes should only use :root and .dark`);
  }

  return warnings;
}

/**
 * Inject theme CSS into the document head.
 * Inserted after globals.css so theme variables win specificity.
 */
export function injectThemeCSS(css: string): void {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = css;
  syncThemeColorMeta();
}

/**
 * Remove injected theme CSS, reverting to default.
 */
export function removeThemeCSS(): void {
  if (typeof document === 'undefined') return;

  const styleEl = document.getElementById(THEME_STYLE_ID);
  if (styleEl) {
    styleEl.remove();
  }
  syncThemeColorMeta();
}

/**
 * Inject a theme's *skin* CSS - component-level overrides shipped by Theme
 * API v2 themes via `skin.css`. Lives in a separate `<style>` tag so it can
 * be removed cleanly without touching the colour-token block, and is placed
 * AFTER the colour block so component rules win specificity.
 *
 * Also sets `body[data-theme-skin="<themeId>"]` so authors can scope their
 * own `:not(...)` overrides if they want belt-and-braces specificity.
 */
export function injectThemeSkinCSS(css: string, themeId: string): void {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById(THEME_SKIN_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = THEME_SKIN_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;

  if (document.body) {
    document.body.setAttribute(THEME_SKIN_BODY_ATTR, themeId);
  }
  syncThemeColorMeta();
}

export function removeThemeSkinCSS(): void {
  if (typeof document === 'undefined') return;

  const styleEl = document.getElementById(THEME_SKIN_STYLE_ID);
  if (styleEl) styleEl.remove();
  if (document.body) document.body.removeAttribute(THEME_SKIN_BODY_ATTR);
  syncThemeColorMeta();
}

/**
 * Sanitize a theme *skin* - looser than `sanitizeThemeCSS` because skins
 * intentionally target real component selectors (toolbars, lists, buttons),
 * not just `:root`/`.dark`. The same script-injection / external-resource
 * prohibitions still apply.
 */
export function sanitizeSkinCSS(css: string): { css: string; warnings: string[] } {
  const warnings: string[] = [];
  let cleaned = css;

  for (const pattern of DISALLOWED_CSS_PATTERNS) {
    if (pattern.test(cleaned)) {
      warnings.push(`Skin: removed disallowed pattern: ${pattern.source}`);
      cleaned = cleaned.replace(new RegExp(pattern.source, 'gi'), '/* [removed] */');
    }
  }

  // `@import` is already covered by DISALLOWED_CSS_PATTERNS, but skins also
  // get an explicit no-`@charset`/`@namespace` policy so they can't change
  // how the host stylesheet parses subsequent rules.
  cleaned = cleaned.replace(/@(charset|namespace)\b[^;]*;?/gi, () => {
    warnings.push('Skin: removed @charset/@namespace directive');
    return '/* [removed] */';
  });

  return { css: cleaned, warnings };
}

/**
 * Check if a theme CSS string is valid and safe.
 */
export function validateThemeCSSSafety(css: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!css.trim()) {
    errors.push('Theme CSS is empty');
    return { valid: false, errors };
  }

  // Check for dangerous patterns
  for (const pattern of DISALLOWED_CSS_PATTERNS) {
    if (pattern.test(css)) {
      errors.push(`Contains disallowed pattern: ${pattern.source}`);
    }
  }

  // Check the CSS actually sets some variables
  if (!css.includes('--color-')) {
    errors.push('Theme CSS should set at least one --color-* variable');
  }

  return { valid: errors.length === 0, errors };
}
