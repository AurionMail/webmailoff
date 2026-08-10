import { test, expect } from '@playwright/test';
import { ACCOUNTS } from './helpers/config';
import { sendMail } from './helpers/smtp';
import { JmapClient } from './helpers/jmap';
import {
  login,
  expandSharedFolders,
  folderRow,
  openFolder,
  expectFolderCountsSynced,
  expectEmailVisible,
  expectEmailUnread,
  emailContextAction,
  emailItem,
  forceSync,
} from './helpers/app';

/**
 * Shared (delegated) folders. Alice shares a custom folder — plus her Trash and
 * Junk so delete/spam can route to the owner's system folders — with carol, who
 * then acts on the mail from her own session and checks the shared counters.
 *
 * carol is the grantee (not asserted on by other specs), so the shared-account
 * visibility this leaves in Stalwart's session cache doesn't leak elsewhere.
 */
const { alice, carol } = ACCOUNTS;
const SHARED = 'TeamShared';

let seq = 0;
const subj = (l: string) => `IT ${l} ${Date.now()}-${seq++}`;

test.describe('Shared folder actions', () => {
  let ja: JmapClient; // owner (alice)
  let sharedId: string;

  test.beforeEach(async () => {
    ja = await JmapClient.connect(alice.email, alice.password);
    const jc = await JmapClient.connect(carol.email, carol.password);
    await ja.reset();
    await jc.reset();
    // Delegate a custom folder + Trash + Junk to carol.
    sharedId = await ja.createSharedFolder(SHARED, carol.email);
    await ja.shareMailboxByRole('trash', carol.email);
    await ja.shareMailboxByRole('junk', carol.email);
  });

  async function seedIntoShared(subject: string): Promise<void> {
    await sendMail({ from: alice.email, authPass: alice.password, to: alice.email, subject, body: 'x' });
    const m = await ja.waitForEmail(subject);
    await ja.moveEmail(m.id, sharedId);
  }

  test('shared folder appears with its counter and message', async ({ page }) => {
    const s = subj('sh-show');
    await seedIntoShared(s);

    await login(page, carol);
    await expandSharedFolders(page, alice.email);

    await expect(folderRow(page, { name: SHARED, shared: true }).first()).toBeVisible();
    await expectFolderCountsSynced(page, { name: SHARED, shared: true }, { unread: 1 });

    await openFolder(page, { name: SHARED, shared: true });
    await forceSync(page);
    await expectEmailVisible(page, s);
  });

  test('mark read/unread in a shared folder updates its counter', async ({ page }) => {
    const s = subj('sh-read');
    await seedIntoShared(s);

    await login(page, carol);
    await expandSharedFolders(page, alice.email);
    await openFolder(page, { name: SHARED, shared: true });
    await expectFolderCountsSynced(page, { name: SHARED, shared: true }, { unread: 1 });

    await emailContextAction(page, s, 'ctx-mark-read');
    await expectEmailUnread(page, s, false);
    await expectFolderCountsSynced(page, { name: SHARED, shared: true }, { unread: 0 });

    await emailContextAction(page, s, 'ctx-mark-unread');
    await expectFolderCountsSynced(page, { name: SHARED, shared: true }, { unread: 1 });

    // Owner sees the same state on the server.
    const found = await ja.findEmailBySubject(s, sharedId);
    expect(found.keywords?.$seen).toBeFalsy();
  });

  test('delete in a shared folder moves the message to the shared Trash', async ({ page }) => {
    const s = subj('sh-del');
    await seedIntoShared(s);

    await login(page, carol);
    await expandSharedFolders(page, alice.email);
    await openFolder(page, { name: SHARED, shared: true });
    await expectFolderCountsSynced(page, { name: SHARED, shared: true }, { total: 1 });

    await emailContextAction(page, s, 'ctx-delete');

    // Source shared folder drains, and the message really is in the owner's
    // Trash on the server. (We assert the destination server-side rather than
    // the shared Trash badge to keep the check independent of sidebar layout.)
    await expectFolderCountsSynced(page, { name: SHARED, shared: true }, { total: 0 });
    const trash = await ja.mailboxByRole('trash');
    expect(await ja.findEmailBySubject(s, trash!.id), 'message in owner Trash').toBeTruthy();
  });

  test('mark as spam in a shared folder moves the message to the shared Junk', async ({ page }) => {
    const s = subj('sh-spam');
    await seedIntoShared(s);

    await login(page, carol);
    await expandSharedFolders(page, alice.email);
    await openFolder(page, { name: SHARED, shared: true });
    await expectFolderCountsSynced(page, { name: SHARED, shared: true }, { total: 1 });

    await emailContextAction(page, s, 'ctx-spam');

    // The message leaves the shared folder's list, and on the server it has
    // moved to the owner's Junk and out of the shared folder. (Unlike delete,
    // spam doesn't optimistically drain the source *counter*, and forceSync
    // can't reconcile a shared account — so we assert list + server state.)
    await expect(emailItem(page, s)).toHaveCount(0);
    const junk = await ja.mailboxByRole('junk');
    expect(await ja.findEmailBySubject(s, junk!.id), 'message in owner Junk').toBeTruthy();
    expect(await ja.findEmailBySubject(s, sharedId), 'message no longer in shared folder').toBeFalsy();
  });
});
