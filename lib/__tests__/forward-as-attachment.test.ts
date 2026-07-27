import { describe, it, expect } from 'vitest';
import { buildForwardAsAttachmentPayload } from '@/lib/forward-as-attachment';
import type { Email } from '@/lib/jmap/types';

function makeEmail(overrides: Partial<Email> = {}): Email {
  return {
    id: 'e1',
    threadId: 't1',
    mailboxIds: { inbox: true },
    keywords: {},
    size: 12345,
    receivedAt: '2026-07-26T22:25:22Z',
    subject: 'Your waste service day is changing',
    hasAttachment: false,
    blobId: 'blob123',
    ...overrides,
  };
}

describe('buildForwardAsAttachmentPayload', () => {
  it('returns null when the email has no blobId', () => {
    const email = makeEmail({ blobId: undefined });
    expect(buildForwardAsAttachmentPayload(email, 'Fwd:')).toBeNull();
  });

  it('prefixes the subject using the given forward prefix', () => {
    const email = makeEmail({ subject: 'Missed spam example' });
    const payload = buildForwardAsAttachmentPayload(email, 'Fwd:');
    expect(payload?.subject).toBe('Fwd: Missed spam example');
  });

  it('builds a message/rfc822 attachment referencing the email\'s own blobId, not a new upload', () => {
    const email = makeEmail({ blobId: 'the-real-blob-id', size: 26489 });
    const payload = buildForwardAsAttachmentPayload(email, 'Fwd:');
    expect(payload?.attachment).toEqual({
      blobId: 'the-real-blob-id',
      name: expect.stringMatching(/\.eml$/),
      type: 'message/rfc822',
      size: 26489,
    });
  });

  it('is idempotent - repeated forwarding does not stack prefixes', () => {
    const email = makeEmail({ subject: 'Fwd: already forwarded once' });
    const payload = buildForwardAsAttachmentPayload(email, 'Fwd:');
    expect(payload?.subject).toBe('Fwd: already forwarded once');
  });
});
