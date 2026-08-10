/**
 * Minimal JMAP client for test setup/inspection against Stalwart.
 *
 * Uses global fetch (Node 18+). Not a full JMAP implementation — just the
 * pieces the integration tests need: authenticate, read/reset mailboxes,
 * create folders, and poll for delivery. Assertions on *server* state (via
 * this client) are kept separate from assertions on *UI* state (via the page),
 * so a failing test can tell whether the bug is in delivery or in the webmail's
 * sync.
 */
import { JMAP_URL } from './config';

const CORE = 'urn:ietf:params:jmap:core';
const MAIL = 'urn:ietf:params:jmap:mail';
const PRINCIPALS = 'urn:ietf:params:jmap:principals';
const SUBMISSION = 'urn:ietf:params:jmap:submission';

/** Rights granted on a shared mailbox (JMAP ACL). */
export const FULL_MAILBOX_RIGHTS = {
  mayReadItems: true,
  mayAddItems: true,
  mayRemoveItems: true,
  maySetSeen: true,
  maySetKeywords: true,
  mayCreateChild: true,
  mayRename: false,
  mayDelete: false,
  maySubmit: false,
};

interface JmapMailbox {
  id: string;
  name: string;
  role: string | null;
  parentId: string | null;
  totalEmails: number;
  unreadEmails: number;
}

type MethodCall = [string, Record<string, unknown>, string];

export class JmapClient {
  private authHeader: string;
  private apiUrl: string;
  accountId = '';
  /** Every account visible in this user's session (own + shared/group),
   *  keyed by accountId -> account name (its email address). */
  accounts: Record<string, string> = {};

  private constructor(private email: string, password: string) {
    this.authHeader = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
    // Stalwart advertises apiUrl on its configured hostname (mail.example.org);
    // rewrite onto the reachable origin, exactly as the app client does.
    this.apiUrl = `${JMAP_URL}/jmap/`;
  }

  static async connect(email: string, password: string): Promise<JmapClient> {
    const c = new JmapClient(email, password);
    const res = await fetch(`${JMAP_URL}/jmap/session`, {
      headers: { Authorization: c.authHeader },
    });
    if (!res.ok) throw new Error(`JMAP session failed for ${email}: ${res.status}`);
    const session = await res.json();
    const primary = session.primaryAccounts?.[MAIL];
    if (!primary) throw new Error(`No mail account for ${email} in JMAP session`);
    c.accountId = primary;
    c.accounts = Object.fromEntries(
      Object.entries(session.accounts ?? {}).map(([id, a]) => [id, (a as { name: string }).name]),
    );
    return c;
  }

  /** Names (email addresses) of the shared/group accounts this user can access,
   *  i.e. everything in the session except the user's own primary account. */
  sharedAccountNames(): string[] {
    return Object.entries(this.accounts)
      .filter(([id]) => id !== this.accountId)
      .map(([, name]) => name);
  }

  async request(methodCalls: MethodCall[], using: string[] = [CORE, MAIL, SUBMISSION]): Promise<any> {
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ using, methodCalls }),
    });
    if (!res.ok) throw new Error(`JMAP request failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  /** All sending identities of this account. */
  async identities(): Promise<Array<{ id: string; name: string; email: string }>> {
    const r = await this.request([['Identity/get', { accountId: this.accountId }, '0']], [CORE, SUBMISSION]);
    return r.methodResponses[0][1].list;
  }

  /**
   * Ensure a second sending identity `name <email>` exists (idempotent by
   * name). Returns its id. Used to make the composer's From selector appear so
   * a changed sender can be exercised.
   */
  async ensureIdentity(name: string, email: string): Promise<string> {
    const existing = (await this.identities()).find((i) => i.name === name);
    if (existing) return existing.id;
    const r = await this.request(
      [['Identity/set', { accountId: this.accountId, create: { alt: { name, email, replyTo: null } } }, '0']],
      [CORE, SUBMISSION],
    );
    const created = r.methodResponses[0][1].created?.alt;
    if (!created) throw new Error(`Identity/set failed: ${JSON.stringify(r.methodResponses[0][1])}`);
    return created.id;
  }

  /** Resolve another user's principal id (needed as the key in `shareWith`). */
  async principalIdByEmail(email: string): Promise<string> {
    const r = await this.request(
      [
        ['Principal/query', { accountId: this.accountId, filter: { email } }, '0'],
        ['Principal/get', { accountId: this.accountId, '#ids': { resultOf: '0', name: 'Principal/query', path: '/ids' } }, '1'],
      ],
      [CORE, PRINCIPALS],
    );
    const list = r.methodResponses[1][1].list as Array<{ id: string; email?: string }>;
    const match = list.find((p) => p.email === email) ?? list[0];
    if (!match) throw new Error(`No principal found for ${email}`);
    return match.id;
  }

  /**
   * Create a folder in this account and share it with `granteeEmail`. Returns
   * the new mailbox id. The grantee then sees this account as a shared account
   * in their JMAP session.
   */
  async createSharedFolder(name: string, granteeEmail: string): Promise<string> {
    const principalId = await this.principalIdByEmail(granteeEmail);
    const r = await this.request([
      ['Mailbox/set', {
        accountId: this.accountId,
        create: { shared: { name, shareWith: { [principalId]: FULL_MAILBOX_RIGHTS } } },
      }, '0'],
    ]);
    const created = r.methodResponses[0][1].created?.shared;
    if (!created) throw new Error(`createSharedFolder failed: ${JSON.stringify(r.methodResponses[0][1])}`);
    return created.id;
  }

  /** Grant `granteeEmail` access to an existing mailbox of this account. */
  async shareMailbox(mailboxId: string, granteeEmail: string): Promise<void> {
    const principalId = await this.principalIdByEmail(granteeEmail);
    await this.request([
      ['Mailbox/set', {
        accountId: this.accountId,
        update: { [mailboxId]: { [`shareWith/${principalId}`]: FULL_MAILBOX_RIGHTS } },
      }, '0'],
    ]);
  }

  /** Grant `granteeEmail` access to a system folder (by role) of this account. */
  async shareMailboxByRole(role: string, granteeEmail: string): Promise<string> {
    const mb = await this.mailboxByRole(role);
    if (!mb) throw new Error(`No ${role} mailbox to share`);
    await this.shareMailbox(mb.id, granteeEmail);
    return mb.id;
  }

  async mailboxes(): Promise<JmapMailbox[]> {
    const r = await this.request([['Mailbox/get', { accountId: this.accountId }, '0']]);
    return r.methodResponses[0][1].list as JmapMailbox[];
  }

  async mailboxByRole(role: string): Promise<JmapMailbox | undefined> {
    return (await this.mailboxes()).find((m) => m.role === role);
  }

  async mailboxByName(name: string): Promise<JmapMailbox | undefined> {
    return (await this.mailboxes()).find((m) => m.name === name);
  }

  /** Create a folder (top-level) and return its id. Idempotent by name. */
  async createMailbox(name: string, parentId: string | null = null): Promise<string> {
    const existing = await this.mailboxByName(name);
    if (existing) return existing.id;
    const r = await this.request([
      ['Mailbox/set', { accountId: this.accountId, create: { new: { name, parentId } } }, '0'],
    ]);
    const created = r.methodResponses[0][1].created?.new;
    if (!created) throw new Error(`Mailbox/set create failed: ${JSON.stringify(r.methodResponses[0][1])}`);
    return created.id;
  }

  async deleteMailboxByName(name: string): Promise<void> {
    const mb = await this.mailboxByName(name);
    if (!mb) return;
    await this.request([
      ['Mailbox/set', { accountId: this.accountId, onDestroyRemoveEmails: true, destroy: [mb.id] }, '0'],
    ]);
  }

  private async allEmailIds(): Promise<string[]> {
    const r = await this.request([['Email/query', { accountId: this.accountId, limit: 5000 }, '0']]);
    return r.methodResponses[0][1].ids as string[];
  }

  /**
   * Reset a mailbox to a clean slate: destroy every message and delete any
   * non-system (custom) folder. System folders (Inbox/Sent/Trash/…) are kept.
   */
  async reset(): Promise<void> {
    const ids = await this.allEmailIds();
    if (ids.length) {
      await this.request([['Email/set', { accountId: this.accountId, destroy: ids }, '0']]);
    }
    const custom = (await this.mailboxes()).filter((m) => !m.role);
    if (custom.length) {
      await this.request([
        ['Mailbox/set', { accountId: this.accountId, onDestroyRemoveEmails: true, destroy: custom.map((m) => m.id) }, '0'],
      ]);
    }
  }

  /** Move an email so it lives solely in `toMailboxId`. */
  async moveEmail(emailId: string, toMailboxId: string): Promise<void> {
    await this.request([
      ['Email/set', { accountId: this.accountId, update: { [emailId]: { mailboxIds: { [toMailboxId]: true } } } }, '0'],
    ]);
  }

  /** Deliver-and-file: create/find a custom folder and drop a message id into it. */
  async moveEmailToFolder(emailId: string, folderName: string): Promise<string> {
    const id = await this.createMailbox(folderName);
    await this.moveEmail(emailId, id);
    return id;
  }

  /** Create a draft message (with the $draft keyword) in the Drafts folder. */
  async createDraft(subject: string, toEmail: string): Promise<string> {
    const drafts = await this.mailboxByRole('drafts');
    if (!drafts) throw new Error('No Drafts mailbox');
    const r = await this.request([
      ['Email/set', {
        accountId: this.accountId,
        create: {
          d: {
            mailboxIds: { [drafts.id]: true },
            keywords: { $draft: true },
            from: [{ email: this.email }],
            to: [{ email: toEmail }],
            subject,
            bodyValues: { b: { value: 'server-created draft body' } },
            textBody: [{ partId: 'b', type: 'text/plain' }],
          },
        },
      }, '0'],
    ]);
    const created = r.methodResponses[0][1].created?.d;
    if (!created) throw new Error(`createDraft failed: ${JSON.stringify(r.methodResponses[0][1])}`);
    return created.id;
  }

  /** Set or clear the $seen keyword on an email. */
  async setSeen(emailId: string, seen: boolean): Promise<void> {
    await this.request([
      ['Email/set', { accountId: this.accountId, update: { [emailId]: { [`keywords/$seen`]: seen ? true : null } } }, '0'],
    ]);
  }

  async setFlagged(emailId: string, flagged: boolean): Promise<void> {
    await this.request([
      ['Email/set', { accountId: this.accountId, update: { [emailId]: { [`keywords/$flagged`]: flagged ? true : null } } }, '0'],
    ]);
  }

  /** Look up an email id by subject within an optional mailbox. */
  async findEmailBySubject(subject: string, mailboxId?: string): Promise<any | undefined> {
    const filter: Record<string, unknown> = { subject };
    if (mailboxId) filter.inMailbox = mailboxId;
    const r = await this.request([
      ['Email/query', { accountId: this.accountId, filter }, '0'],
      ['Email/get', {
        accountId: this.accountId,
        '#ids': { resultOf: '0', name: 'Email/query', path: '/ids' },
        properties: ['id', 'subject', 'keywords', 'mailboxIds', 'from', 'to', 'preview'],
      }, '1'],
    ]);
    return r.methodResponses[1][1].list[0];
  }

  /** Poll until a message with `subject` is delivered (or throw on timeout). */
  async waitForEmail(subject: string, opts: { mailboxId?: string; timeoutMs?: number } = {}): Promise<any> {
    const deadline = Date.now() + (opts.timeoutMs ?? 15000);
    for (;;) {
      const found = await this.findEmailBySubject(subject, opts.mailboxId);
      if (found) return found;
      if (Date.now() > deadline) throw new Error(`Timed out waiting for email "${subject}" (${this.email})`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
