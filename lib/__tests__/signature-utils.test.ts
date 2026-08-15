import { describe, expect, it } from 'vitest';

import {
  appendHtmlSignature,
  appendPlainTextSignature,
  getPlainTextSignature,
  hasMeaningfulHtmlBody,
  plainTextBodyHasSignature,
} from '../signature-utils';

describe('signature-utils', () => {
  describe('getPlainTextSignature', () => {
    it('prefers text signatures when present', () => {
      expect(getPlainTextSignature({ textSignature: 'Regards,\nAlice', htmlSignature: '<p>Ignored</p>' })).toBe('Regards,\nAlice');
    });

    it('converts html-only signatures into plain text', () => {
      expect(getPlainTextSignature({ htmlSignature: '<p>Alice Example<br><a href="mailto:alice@example.com">alice@example.com</a></p>' })).toBe('Alice Example\nalice@example.com');
    });
  });

  describe('appendPlainTextSignature', () => {
    it('appends a converted html signature to the text body', () => {
      expect(appendPlainTextSignature('Hello there', { htmlSignature: '<p>Alice<br>Engineering</p>' })).toBe('Hello there\n\n-- \nAlice\nEngineering');
    });

    it('leaves the body untouched when no signature exists', () => {
      expect(appendPlainTextSignature('Hello there', {})).toBe('Hello there');
    });
  });

  describe('plainTextBodyHasSignature', () => {
    const identity = { textSignature: 'Regards,\nAlice' };

    it('detects a signature the draft path already appended', () => {
      const saved = appendPlainTextSignature('Hello there', identity);
      expect(plainTextBodyHasSignature(saved, identity)).toBe(true);
    });

    it('still matches after a CRLF round-trip through the server', () => {
      const saved = appendPlainTextSignature('Hello there', identity).replace(/\n/g, '\r\n');
      expect(plainTextBodyHasSignature(saved, identity)).toBe(true);
    });

    it('returns false for a body without the signature', () => {
      expect(plainTextBodyHasSignature('Hello there', identity)).toBe(false);
    });

    it('returns false when the signature only appears mid-body', () => {
      expect(plainTextBodyHasSignature('Regards,\nAlice\n\nactually one more thing', identity)).toBe(false);
    });

    it('returns false when the identity has no signature', () => {
      expect(plainTextBodyHasSignature('Hello there', {})).toBe(false);
    });
  });

  describe('appendHtmlSignature', () => {
    it('appends a sanitized html signature, preserving formatting', () => {
      expect(appendHtmlSignature('<div>Hello</div>', { htmlSignature: '<strong>Alice</strong>' }))
        .toBe('<div>Hello</div><br><br>-- <br><strong>Alice</strong>');
    });

    it('escapes and appends a text signature when no html signature exists', () => {
      expect(appendHtmlSignature('<div>Hello</div>', { textSignature: 'Alice\nEng' }))
        .toBe('<div>Hello</div><br><br>-- <br>Alice<br>Eng');
    });

    it('omits the separator marker when disabled', () => {
      expect(appendHtmlSignature('<div>Hi</div>', { htmlSignature: '<strong>A</strong>' }, { separator: false }))
        .toBe('<div>Hi</div><br><br><strong>A</strong>');
    });

    it('leaves the body untouched when no signature exists', () => {
      expect(appendHtmlSignature('<div>Hi</div>', {})).toBe('<div>Hi</div>');
    });
  });

  describe('hasMeaningfulHtmlBody', () => {
    it('prefers html bodies that preserve signature formatting', () => {
      expect(hasMeaningfulHtmlBody('<div>Hello</div><br><p>Alice</p>')).toBe(true);
    });

    it('ignores minimal wrapper html with a single block', () => {
      expect(hasMeaningfulHtmlBody('<div>Hello world</div>')).toBe(false);
    });
  });
});