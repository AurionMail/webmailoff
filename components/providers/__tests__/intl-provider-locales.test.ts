import { describe, it, expect } from 'vitest';
import { ALL_MESSAGES } from '../intl-provider';
import { routing } from '@/i18n/routing';

/**
 * The client provider keeps its own build-time message map next to the ones in
 * i18n/routing.ts and i18n/request.ts. A locale wired into routing but absent
 * from the map falls back to `{}` and renders as English no matter what the
 * language picker says - exactly how Catalan shipped broken (#756) and
 * Mongolian arrived half-wired. Pin the map to the routing list so a new
 * locale cannot ship without its client messages again.
 */
describe('client message map', () => {
  it('carries messages for every supported locale', () => {
    for (const locale of routing.locales) {
      const messages = ALL_MESSAGES[locale as keyof typeof ALL_MESSAGES];
      expect(messages, `locale "${locale}" is missing from ALL_MESSAGES`).toBeTruthy();
      expect(Object.keys(messages).length, `locale "${locale}" has empty messages`).toBeGreaterThan(0);
    }
  });
});
