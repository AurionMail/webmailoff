import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import {
  SignatureBlock,
  buildSignatureBlock,
  containsEmbeddedSignature,
  SIGNATURE_BLOCK_MARKER,
  SIGNATURE_RANGE_MARKER,
} from '../signature-block';
import { serializeEditorContent } from '../quoted-html';

describe('signature-block', () => {
  it('buildSignatureBlock wraps html in the marker div', () => {
    expect(buildSignatureBlock('<b>x</b>')).toBe(`<div ${SIGNATURE_BLOCK_MARKER}><b>x</b></div>`);
  });

  describe('containsEmbeddedSignature', () => {
    it('detects the bracketed signature range a saved draft carries', () => {
      const draftBody = `<p>Hi</p><p ${SIGNATURE_RANGE_MARKER}="separator">-- </p>`
        + `${buildSignatureBlock('<b>Alice</b>')}<p ${SIGNATURE_RANGE_MARKER}="end"></p>`;
      expect(containsEmbeddedSignature(draftBody)).toBe(true);
    });

    it('detects a bare signature atom whose marker paragraphs were dropped', () => {
      expect(containsEmbeddedSignature(`<p>Hi</p>${buildSignatureBlock('<b>Alice</b>')}`)).toBe(true);
    });

    it('returns false for a body with no signature', () => {
      expect(containsEmbeddedSignature('<p>Hi</p><blockquote>quoted</blockquote>')).toBe(false);
    });
  });

  it('survives a draft round-trip so the send path sees it as already embedded', () => {
    // What the composer saves for a "below quote" reply draft: body + the
    // marked-up signature. Re-opening parses it back and serialization must
    // still carry the markers, or the send path appends a second signature.
    const draftBody = `<p>Reply text</p><p ${SIGNATURE_RANGE_MARKER}="separator">-- </p>`
      + `${buildSignatureBlock('<b>Alice</b>')}<p ${SIGNATURE_RANGE_MARKER}="end"></p>`;
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, SignatureBlock],
      content: draftBody,
    });
    try {
      const out = serializeEditorContent(editor);
      expect(containsEmbeddedSignature(out)).toBe(true);
      expect(out).toContain('<b>Alice</b>');
      expect(out).toContain('Reply text');
      // Exactly one signature block - no duplication across the round-trip.
      expect(out.split(SIGNATURE_BLOCK_MARKER).length - 1).toBe(1);
    } finally {
      editor.destroy();
    }
  });

  it('preserves an inline-styled signature through parse + serialize (no schema flattening)', () => {
    const styled =
      '<table style="background:#0a0e16;border-radius:8px"><tbody><tr>' +
      '<td style="color:#c6f24e;font-family:\'Courier New\'">MV</td>' +
      '</tr></tbody></table>';
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, SignatureBlock],
      content: `<p>Hello</p>${buildSignatureBlock(styled)}`,
    });
    try {
      const out = serializeEditorContent(editor);
      // Original inline styling survives - it is NOT re-parsed into the schema.
      expect(out).toContain('background:#0a0e16');
      expect(out).toContain('border-radius:8px');
      expect(out).toContain('color:#c6f24e');
      expect(out).toContain(SIGNATURE_BLOCK_MARKER);
      // Surrounding body is preserved.
      expect(out).toContain('Hello');
      // The signature did not get the editor's generic table styling.
      expect(out).not.toContain('rgb(204, 204, 204)');
    } finally {
      editor.destroy();
    }
  });
});
