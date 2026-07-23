import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useContactStore, getContactPhotoUri, normalizeContactPhotoUri } from '../contact-store';
import type { ContactCard } from '@/lib/jmap/types';

vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-0000-0000-000000000000' });

const makeContact = (overrides: Partial<ContactCard> = {}): ContactCard => ({
  id: 'contact-1',
  addressBookIds: { 'ab-1': true },
  name: { components: [{ kind: 'given', value: 'John' }, { kind: 'surname', value: 'Doe' }], isOrdered: true },
  emails: { e0: { address: 'john@example.com' } },
  ...overrides,
});

const makeGroup = (overrides: Partial<ContactCard> = {}): ContactCard => ({
  id: 'group-1',
  addressBookIds: {},
  kind: 'group',
  name: { components: [{ kind: 'given', value: 'Team' }], isOrdered: true },
  members: {},
  ...overrides,
});

const defaultState = {
  contacts: [],
  addressBooks: [],
  selectedContactId: null,
  searchQuery: '',
  isLoading: false,
  error: null,
  supportsSync: false,
  selectedContactIds: new Set<string>(),
  activeTab: 'all' as const,
  directoryPrincipals: [],
  directoryLoaded: false,
};

describe('contact-store', () => {
  beforeEach(() => {
    useContactStore.setState(defaultState);
  });

  describe('addLocalContact', () => {
    it('should append contact to array', () => {
      useContactStore.getState().addLocalContact(makeContact());
      expect(useContactStore.getState().contacts).toHaveLength(1);
      expect(useContactStore.getState().contacts[0].id).toBe('contact-1');
    });

    it('should preserve existing contacts', () => {
      useContactStore.getState().addLocalContact(makeContact({ id: 'c1' }));
      useContactStore.getState().addLocalContact(makeContact({ id: 'c2' }));
      expect(useContactStore.getState().contacts).toHaveLength(2);
    });
  });

  describe('updateLocalContact', () => {
    it('should update matching contact', () => {
      useContactStore.getState().addLocalContact(makeContact({ id: 'c1' }));
      useContactStore.getState().updateLocalContact('c1', {
        emails: { e0: { address: 'updated@example.com' } },
      });
      expect(useContactStore.getState().contacts[0].emails!.e0.address).toBe('updated@example.com');
    });

    it('should not modify other contacts', () => {
      useContactStore.getState().addLocalContact(makeContact({ id: 'c1' }));
      useContactStore.getState().addLocalContact(makeContact({ id: 'c2', emails: { e0: { address: 'c2@test.com' } } }));
      useContactStore.getState().updateLocalContact('c1', { emails: { e0: { address: 'new@test.com' } } });
      expect(useContactStore.getState().contacts[1].emails!.e0.address).toBe('c2@test.com');
    });

    it('should no-op for non-existent id', () => {
      useContactStore.getState().addLocalContact(makeContact());
      useContactStore.getState().updateLocalContact('nonexistent', { kind: 'org' });
      expect(useContactStore.getState().contacts).toHaveLength(1);
      expect(useContactStore.getState().contacts[0].kind).toBeUndefined();
    });
  });

  describe('deleteLocalContact', () => {
    it('should remove contact by id', () => {
      useContactStore.getState().addLocalContact(makeContact({ id: 'c1' }));
      useContactStore.getState().addLocalContact(makeContact({ id: 'c2' }));
      useContactStore.getState().deleteLocalContact('c1');
      expect(useContactStore.getState().contacts).toHaveLength(1);
      expect(useContactStore.getState().contacts[0].id).toBe('c2');
    });

    it('should clear selectedContactId when deleting selected', () => {
      useContactStore.getState().addLocalContact(makeContact({ id: 'c1' }));
      useContactStore.getState().setSelectedContact('c1');
      useContactStore.getState().deleteLocalContact('c1');
      expect(useContactStore.getState().selectedContactId).toBeNull();
    });

    it('should preserve selectedContactId when deleting other', () => {
      useContactStore.getState().addLocalContact(makeContact({ id: 'c1' }));
      useContactStore.getState().addLocalContact(makeContact({ id: 'c2' }));
      useContactStore.getState().setSelectedContact('c1');
      useContactStore.getState().deleteLocalContact('c2');
      expect(useContactStore.getState().selectedContactId).toBe('c1');
    });
  });

  describe('setSelectedContact', () => {
    it('should set selectedContactId', () => {
      useContactStore.getState().setSelectedContact('c1');
      expect(useContactStore.getState().selectedContactId).toBe('c1');
    });

    it('should allow null to deselect', () => {
      useContactStore.getState().setSelectedContact('c1');
      useContactStore.getState().setSelectedContact(null);
      expect(useContactStore.getState().selectedContactId).toBeNull();
    });
  });

  describe('setSearchQuery', () => {
    it('should set search query', () => {
      useContactStore.getState().setSearchQuery('john');
      expect(useContactStore.getState().searchQuery).toBe('john');
    });
  });

  describe('setSupportsSync', () => {
    it('should set supportsSync flag', () => {
      useContactStore.getState().setSupportsSync(true);
      expect(useContactStore.getState().supportsSync).toBe(true);
    });
  });

  describe('setActiveTab', () => {
    it('should set active tab', () => {
      useContactStore.getState().setActiveTab('groups');
      expect(useContactStore.getState().activeTab).toBe('groups');
    });
  });

  describe('clearContacts', () => {
    it('should reset all contact-related state', () => {
      useContactStore.setState({
        contacts: [makeContact()],
        addressBooks: [{ id: 'ab-1', name: 'Default', isDefault: true }],
        selectedContactId: 'c1',
        searchQuery: 'test',
        error: 'some error',
        selectedContactIds: new Set(['c1', 'c2']),
        activeTab: 'groups',
      });

      useContactStore.getState().clearContacts();
      const state = useContactStore.getState();
      expect(state.contacts).toEqual([]);
      expect(state.addressBooks).toEqual([]);
      expect(state.selectedContactId).toBeNull();
      expect(state.searchQuery).toBe('');
      expect(state.error).toBeNull();
      expect(state.selectedContactIds.size).toBe(0);
      expect(state.activeTab).toBe('all');
    });
  });

  describe('toggleContactSelection', () => {
    it('should add id to selection', () => {
      useContactStore.getState().toggleContactSelection('c1');
      expect(useContactStore.getState().selectedContactIds.has('c1')).toBe(true);
    });

    it('should remove id when already selected', () => {
      useContactStore.getState().toggleContactSelection('c1');
      useContactStore.getState().toggleContactSelection('c1');
      expect(useContactStore.getState().selectedContactIds.has('c1')).toBe(false);
    });

    it('should handle multiple selections independently', () => {
      useContactStore.getState().toggleContactSelection('c1');
      useContactStore.getState().toggleContactSelection('c2');
      expect(useContactStore.getState().selectedContactIds.size).toBe(2);
      useContactStore.getState().toggleContactSelection('c1');
      expect(useContactStore.getState().selectedContactIds.has('c1')).toBe(false);
      expect(useContactStore.getState().selectedContactIds.has('c2')).toBe(true);
    });
  });

  describe('selectAllContacts', () => {
    it('should set all provided ids', () => {
      useContactStore.getState().selectAllContacts(['c1', 'c2', 'c3']);
      expect(useContactStore.getState().selectedContactIds.size).toBe(3);
    });

    it('should replace previous selection', () => {
      useContactStore.getState().toggleContactSelection('c0');
      useContactStore.getState().selectAllContacts(['c1', 'c2']);
      expect(useContactStore.getState().selectedContactIds.has('c0')).toBe(false);
      expect(useContactStore.getState().selectedContactIds.size).toBe(2);
    });
  });

  describe('clearSelection', () => {
    it('should empty the selection set', () => {
      useContactStore.getState().selectAllContacts(['c1', 'c2']);
      useContactStore.getState().clearSelection();
      expect(useContactStore.getState().selectedContactIds.size).toBe(0);
    });
  });

  describe('getAutocomplete', () => {
    beforeEach(() => {
      useContactStore.setState({
        contacts: [
          makeContact({ id: 'c1' }),
          makeContact({ id: 'c2', name: { components: [{ kind: 'given', value: 'Jane' }, { kind: 'surname', value: 'Smith' }], isOrdered: true }, emails: { e0: { address: 'jane@example.com' } } }),
          makeContact({ id: 'c3', name: { components: [{ kind: 'given', value: 'Bob' }], isOrdered: true }, emails: { e0: { address: 'bob@test.org' } } }),
        ],
      });
    });

    it('should return empty for empty query', () => {
      expect(useContactStore.getState().getAutocomplete('')).toEqual([]);
    });

    it('should match by name', () => {
      const results = useContactStore.getState().getAutocomplete('john');
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('john@example.com');
    });

    it('should match by email address', () => {
      const results = useContactStore.getState().getAutocomplete('test.org');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bob');
    });

    it('should be case insensitive', () => {
      const results = useContactStore.getState().getAutocomplete('JANE');
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('jane@example.com');
    });

    it('should cap results at 10', () => {
      const manyContacts = Array.from({ length: 15 }, (_, i) =>
        makeContact({ id: `c${i}`, name: { components: [{ kind: 'given', value: `User${i}` }], isOrdered: true }, emails: { e0: { address: `user${i}@test.com` } } })
      );
      useContactStore.setState({ contacts: manyContacts });
      const results = useContactStore.getState().getAutocomplete('user');
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should suggest a matching group as a single entry with member count', () => {
      const member1 = makeContact({ id: 'm1', name: { components: [{ kind: 'given', value: 'Alice' }], isOrdered: true }, emails: { e0: { address: 'alice@test.com' } } });
      const member2 = makeContact({ id: 'm2', name: { components: [{ kind: 'given', value: 'Bob' }], isOrdered: true }, emails: { e0: { address: 'bob@test.com' } } });
      const group = makeGroup({ id: 'g1', members: { m1: true, m2: true } });
      useContactStore.setState({ contacts: [member1, member2, group] });

      const results = useContactStore.getState().getAutocomplete('Team');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ name: 'Team', email: '', group: { id: 'g1', memberCount: 2 } });
    });

    it('should not suggest a group with no addressable members', () => {
      const group = makeGroup({ id: 'g1' });
      useContactStore.setState({ contacts: [group] });
      const results = useContactStore.getState().getAutocomplete('Team');
      expect(results).toHaveLength(0);
    });

    it('should return contacts with multiple emails as separate results', () => {
      const multi = makeContact({
        id: 'multi',
        name: { components: [{ kind: 'given', value: 'Multi' }], isOrdered: true },
        emails: { e0: { address: 'a@test.com' }, e1: { address: 'b@test.com' } },
      });
      useContactStore.setState({ contacts: [multi] });
      const results = useContactStore.getState().getAutocomplete('Multi');
      expect(results).toHaveLength(2);
    });

    it('should augment results with directory principals', () => {
      useContactStore.setState({
        contacts: [],
        directoryPrincipals: [{ name: 'Dana Director', email: 'dana@example.com' }],
      });
      const results = useContactStore.getState().getAutocomplete('dana');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ name: 'Dana Director', email: 'dana@example.com' });
    });

    it('should not duplicate a directory principal already matched as a contact', () => {
      useContactStore.setState({
        contacts: [
          makeContact({ id: 'c1', name: { components: [{ kind: 'given', value: 'Jane' }], isOrdered: true }, emails: { e0: { address: 'jane@example.com' } } }),
        ],
        directoryPrincipals: [{ name: 'Jane From Directory', email: 'JANE@example.com' }],
      });
      const results = useContactStore.getState().getAutocomplete('jane');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Jane');
    });
  });

  describe('getGroups', () => {
    it('should return only group contacts', () => {
      useContactStore.setState({ contacts: [makeContact(), makeGroup()] });
      const groups = useContactStore.getState().getGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].kind).toBe('group');
    });

    it('should return empty when no groups', () => {
      useContactStore.setState({ contacts: [makeContact()] });
      expect(useContactStore.getState().getGroups()).toHaveLength(0);
    });
  });

  describe('getIndividuals', () => {
    it('should return non-group contacts', () => {
      useContactStore.setState({ contacts: [makeContact(), makeGroup()] });
      const individuals = useContactStore.getState().getIndividuals();
      expect(individuals).toHaveLength(1);
      expect(individuals[0].kind).not.toBe('group');
    });

    it('should include org and undefined kind', () => {
      useContactStore.setState({
        contacts: [
          makeContact({ id: 'c1' }),
          makeContact({ id: 'c2', kind: 'org' }),
          makeGroup(),
        ],
      });
      expect(useContactStore.getState().getIndividuals()).toHaveLength(2);
    });
  });

  describe('getGroupMembers', () => {
    it('should return contacts whose ids are in group members', () => {
      const m1 = makeContact({ id: 'm1' });
      const m2 = makeContact({ id: 'm2' });
      const nonMember = makeContact({ id: 'nm' });
      const group = makeGroup({ id: 'g1', members: { m1: true, m2: true } });
      useContactStore.setState({ contacts: [m1, m2, nonMember, group] });

      const members = useContactStore.getState().getGroupMembers('g1');
      expect(members).toHaveLength(2);
      expect(members.map(m => m.id).sort()).toEqual(['m1', 'm2']);
    });

    it('should return empty for group with no members', () => {
      useContactStore.setState({ contacts: [makeGroup({ id: 'g1', members: {} })] });
      expect(useContactStore.getState().getGroupMembers('g1')).toHaveLength(0);
    });

    it('should return empty for non-existent group', () => {
      expect(useContactStore.getState().getGroupMembers('nonexistent')).toHaveLength(0);
    });

    it('should match by uid as well as id', () => {
      const m1 = makeContact({ id: 'm1', uid: 'uid-m1' });
      const group = makeGroup({ id: 'g1', members: { 'uid-m1': true } });
      useContactStore.setState({ contacts: [m1, group] });
      expect(useContactStore.getState().getGroupMembers('g1')).toHaveLength(1);
    });

    it('should exclude members with false value', () => {
      const m1 = makeContact({ id: 'm1' });
      const m2 = makeContact({ id: 'm2' });
      const group = makeGroup({ id: 'g1', members: { m1: true, m2: false } });
      useContactStore.setState({ contacts: [m1, m2, group] });
      expect(useContactStore.getState().getGroupMembers('g1')).toHaveLength(1);
    });
  });

  describe('createGroup (local mode)', () => {
    it('should create group with local- prefix id', async () => {
      await useContactStore.getState().createGroup(null, 'Friends', ['c1', 'c2']);
      const contacts = useContactStore.getState().contacts;
      expect(contacts).toHaveLength(1);
      expect(contacts[0].id).toMatch(/^local-/);
      expect(contacts[0].kind).toBe('group');
    });

    it('should set members from provided ids', async () => {
      await useContactStore.getState().createGroup(null, 'Team', ['m1', 'm2']);
      const group = useContactStore.getState().contacts[0];
      expect(group.members).toEqual({ m1: true, m2: true });
    });

    it('should set group name', async () => {
      await useContactStore.getState().createGroup(null, 'Work', []);
      const group = useContactStore.getState().contacts[0];
      expect(group.name?.components?.[0]?.value).toBe('Work');
    });
  });

  describe('updateGroup (local mode)', () => {
    it('should update group name', async () => {
      await useContactStore.getState().createGroup(null, 'Old', []);
      const groupId = useContactStore.getState().contacts[0].id;
      await useContactStore.getState().updateGroup(null, groupId, 'New');
      expect(useContactStore.getState().contacts[0].name?.components?.[0]?.value).toBe('New');
    });

    it('should preserve group members when renaming', async () => {
      await useContactStore.getState().createGroup(null, 'Team', ['m1']);
      const groupId = useContactStore.getState().contacts[0].id;
      await useContactStore.getState().updateGroup(null, groupId, 'Renamed');
      expect(useContactStore.getState().contacts[0].members).toEqual({ m1: true });
    });
  });

  describe('addMembersToGroup (local mode)', () => {
    it('should add new members to group', async () => {
      await useContactStore.getState().createGroup(null, 'Team', ['m1']);
      const groupId = useContactStore.getState().contacts[0].id;
      await useContactStore.getState().addMembersToGroup(null, groupId, ['m2', 'm3']);
      const members = useContactStore.getState().contacts[0].members;
      expect(members).toEqual({ m1: true, m2: true, m3: true });
    });

    it('should no-op for non-existent group', async () => {
      await useContactStore.getState().addMembersToGroup(null, 'nonexistent', ['m1']);
      expect(useContactStore.getState().contacts).toHaveLength(0);
    });
  });

  describe('removeMembersFromGroup (local mode)', () => {
    it('should remove members from group', async () => {
      await useContactStore.getState().createGroup(null, 'Team', ['m1', 'm2', 'm3']);
      const groupId = useContactStore.getState().contacts[0].id;
      await useContactStore.getState().removeMembersFromGroup(null, groupId, ['m2']);
      const members = useContactStore.getState().contacts[0].members;
      expect(members).toEqual({ m1: true, m3: true });
    });

    it('should no-op for group without members', async () => {
      const group = makeGroup({ id: 'g1', members: undefined });
      useContactStore.setState({ contacts: [group] });
      await useContactStore.getState().removeMembersFromGroup(null, 'g1', ['m1']);
      expect(useContactStore.getState().contacts[0].members).toBeUndefined();
    });
  });

  describe('deleteGroup (local mode)', () => {
    it('should remove group from contacts', async () => {
      await useContactStore.getState().createGroup(null, 'Team', []);
      const groupId = useContactStore.getState().contacts[0].id;
      await useContactStore.getState().deleteGroup(null, groupId);
      expect(useContactStore.getState().contacts).toHaveLength(0);
    });

    it('should clear selectedContactId when deleting selected group', async () => {
      await useContactStore.getState().createGroup(null, 'Team', []);
      const groupId = useContactStore.getState().contacts[0].id;
      useContactStore.getState().setSelectedContact(groupId);
      await useContactStore.getState().deleteGroup(null, groupId);
      expect(useContactStore.getState().selectedContactId).toBeNull();
    });

    it('should preserve selectedContactId when deleting other group', async () => {
      useContactStore.getState().addLocalContact(makeContact({ id: 'c1' }));
      useContactStore.getState().setSelectedContact('c1');
      await useContactStore.getState().createGroup(null, 'Team', []);
      const groupId = useContactStore.getState().contacts[1].id;
      await useContactStore.getState().deleteGroup(null, groupId);
      expect(useContactStore.getState().selectedContactId).toBe('c1');
    });
  });

  describe('bulkDeleteContacts (local mode)', () => {
    it('should remove multiple contacts', async () => {
      useContactStore.setState({
        contacts: [makeContact({ id: 'c1' }), makeContact({ id: 'c2' }), makeContact({ id: 'c3' })],
      });
      await useContactStore.getState().bulkDeleteContacts(null, ['c1', 'c3']);
      expect(useContactStore.getState().contacts).toHaveLength(1);
      expect(useContactStore.getState().contacts[0].id).toBe('c2');
    });

    it('should clear selection after bulk delete', async () => {
      useContactStore.setState({
        contacts: [makeContact({ id: 'c1' })],
        selectedContactIds: new Set(['c1']),
      });
      await useContactStore.getState().bulkDeleteContacts(null, ['c1']);
      expect(useContactStore.getState().selectedContactIds.size).toBe(0);
    });

    it('should clear selectedContactId if deleted', async () => {
      useContactStore.setState({
        contacts: [makeContact({ id: 'c1' }), makeContact({ id: 'c2' })],
        selectedContactId: 'c1',
      });
      await useContactStore.getState().bulkDeleteContacts(null, ['c1']);
      expect(useContactStore.getState().selectedContactId).toBeNull();
    });
  });

  describe('bulkAddToGroup (local mode)', () => {
    it('should add contacts to group and clear selection', async () => {
      const m1 = makeContact({ id: 'm1' });
      const group = makeGroup({ id: 'g1', members: {} });
      useContactStore.setState({
        contacts: [m1, group],
        selectedContactIds: new Set(['m1']),
      });
      await useContactStore.getState().bulkAddToGroup(null, 'g1', ['m1']);
      expect(useContactStore.getState().contacts.find(c => c.id === 'g1')?.members).toEqual({ m1: true });
      expect(useContactStore.getState().selectedContactIds.size).toBe(0);
    });
  });

  describe('importContacts (local mode)', () => {
    it('should import contacts with local- prefix ids', async () => {
      const toImport = [makeContact({ id: 'orig-1' }), makeContact({ id: 'orig-2' })];
      const count = await useContactStore.getState().importContacts(null, toImport);
      expect(count).toBe(2);
      expect(useContactStore.getState().contacts).toHaveLength(2);
      expect(useContactStore.getState().contacts[0].id).toMatch(/^local-/);
    });
  });

  describe('normalizeContactPhotoUri', () => {
    it('rewrites malformed data:base64,... URIs using the media mediaType', () => {
      expect(normalizeContactPhotoUri('data:base64,AAAA', 'image/png'))
        .toBe('data:image/png;base64,AAAA');
    });

    it('rewrites data:;base64,... URIs using the media mediaType', () => {
      expect(normalizeContactPhotoUri('data:;base64,AAAA', 'image/gif'))
        .toBe('data:image/gif;base64,AAAA');
    });

    it('defaults to image/jpeg when no mediaType is available', () => {
      expect(normalizeContactPhotoUri('data:base64,AAAA'))
        .toBe('data:image/jpeg;base64,AAAA');
    });

    it('leaves well-formed data URIs unchanged', () => {
      const good = 'data:image/png;base64,AAAA';
      expect(normalizeContactPhotoUri(good)).toBe(good);
    });

    it('leaves http(s) URIs unchanged', () => {
      const url = 'https://example.com/photo.jpg';
      expect(normalizeContactPhotoUri(url)).toBe(url);
    });
  });

  describe('getContactPhotoUri', () => {
    it('returns a normalized data URI for malformed Stalwart photos (#307)', () => {
      const contact = makeContact({
        media: { m0: { kind: 'photo', uri: 'data:base64,AAAA', mediaType: 'image/png' } },
      });
      expect(getContactPhotoUri(contact)).toBe('data:image/png;base64,AAAA');
    });

    it('returns undefined when no photo media is present', () => {
      expect(getContactPhotoUri(makeContact())).toBeUndefined();
    });
  });

  describe('persistence/partialize', () => {
    it('should persist contacts when supportsSync is false', () => {
      const { partialize } = (useContactStore as unknown as { persist: { getOptions: () => { partialize: (state: Record<string, unknown>) => Record<string, unknown> } } }).persist.getOptions();
      const state = { contacts: [makeContact()], supportsSync: false };
      const persisted = partialize(state);
      expect(persisted.contacts).toHaveLength(1);
      expect(persisted.supportsSync).toBe(false);
    });

    it('should persist empty contacts array when supportsSync is true', () => {
      const { partialize } = (useContactStore as unknown as { persist: { getOptions: () => { partialize: (state: Record<string, unknown>) => Record<string, unknown> } } }).persist.getOptions();
      const state = { contacts: [makeContact()], supportsSync: true };
      const persisted = partialize(state);
      expect(persisted.contacts).toEqual([]);
      expect(persisted.supportsSync).toBe(true);
    });
  });
});
