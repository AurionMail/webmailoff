import { create } from 'zustand';
import type { IJMAPClient } from '@/lib/jmap/client-interface';
import type { FilterRule, SieveCapabilities, VacationSieveConfig } from '@/lib/jmap/sieve-types';
import { parseScript } from '@/lib/sieve/parser';
import { generateScript } from '@/lib/sieve/generator';
import { filterHooks } from '@/lib/plugin-hooks';
import { debug } from '@/lib/debug';

interface SieveAccount {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface FilterStore {
  rules: FilterRule[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isSupported: boolean;
  sieveCapabilities: SieveCapabilities | null;
  activeScriptId: string | null;
  isOpaque: boolean;
  rawScript: string;
  vacationSettings: VacationSieveConfig | null;
  externalRequires: string[];
  availableAccounts: SieveAccount[];
  selectedAccountId: string | null;

  setSupported: (supported: boolean) => void;
  fetchFilters: (client: IJMAPClient, accountId?: string) => Promise<void>;
  selectAccount: (client: IJMAPClient, accountId: string) => Promise<void>;
  saveFilters: (client: IJMAPClient) => Promise<void>;
  validateScript: (client: IJMAPClient, content: string) => Promise<{ isValid: boolean; errors?: string[] }>;
  addRule: (rule: FilterRule) => void;
  updateRule: (ruleId: string, updates: Partial<FilterRule>) => void;
  deleteRule: (ruleId: string) => void;
  reorderRules: (ruleIds: string[]) => void;
  toggleRule: (ruleId: string) => void;
  setRawScript: (content: string) => void;
  resetToVisualBuilder: () => void;
  clearState: () => void;
}

export const useFilterStore = create<FilterStore>()((set, get) => ({
  rules: [],
  isLoading: false,
  isSaving: false,
  error: null,
  isSupported: false,
  sieveCapabilities: null,
  activeScriptId: null,
  isOpaque: false,
  rawScript: '',
  vacationSettings: null,
  externalRequires: [],
  availableAccounts: [],
  selectedAccountId: null,

  setSupported: (supported) => set({ isSupported: supported }),

  fetchFilters: async (client, accountId) => {
    set({ isLoading: true, error: null });
    try {
      const accounts = client.getSieveAccounts();
      const resolvedId =
        accountId || get().selectedAccountId || client.getSieveAccountId();
      set({ availableAccounts: accounts, selectedAccountId: resolvedId });

      const capabilities = client.getSieveCapabilities(resolvedId);
      set({ sieveCapabilities: capabilities });

      const allScripts = await client.getSieveScripts(resolvedId);
      debug.log('filters', 'Sieve scripts fetched:', allScripts.length);

      // Skip the server-managed 'vacation' script (RFC 9661 §4) - it can only
      // be modified via VacationResponse/set, not SieveScript/set.
      const scripts = allScripts.filter(s => s.name !== 'vacation');

      const activeScript = scripts.find(s => s.isActive) || scripts[0];
      if (!activeScript) {
        set({ isLoading: false, rules: [], activeScriptId: null, rawScript: '', isOpaque: false });
        return;
      }

      set({ activeScriptId: activeScript.id });

      const content = await client.getSieveScriptContent(activeScript.blobId, resolvedId);
      set({ rawScript: content });

      const result = parseScript(content);

      if (result.isOpaque) {
        debug.log('filters', 'Sieve script is opaque (hand-edited)');
        set({
          isLoading: false,
          isOpaque: true,
          rules: [],
          vacationSettings: result.vacation || null,
          externalRequires: result.externalRequires,
        });
      } else {
        debug.log('filters', 'Parsed', result.rules.length, 'filter rules');
        set({
          isLoading: false,
          isOpaque: false,
          rules: result.rules,
          vacationSettings: result.vacation || null,
          externalRequires: result.externalRequires,
        });
      }
    } catch (error) {
      debug.error('Failed to fetch filters:', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch filters',
      });
    }
  },

  selectAccount: async (client, accountId) => {
    // Reset parsed state so one account's rules/script never leak into another
    // before the re-fetch populates the new account's data.
    set({
      selectedAccountId: accountId,
      rules: [],
      rawScript: '',
      activeScriptId: null,
      isOpaque: false,
      vacationSettings: null,
      externalRequires: [],
    });
    await get().fetchFilters(client, accountId);
  },

  saveFilters: async (client) => {
    set({ isSaving: true, error: null });
    try {
      const { isOpaque, rawScript, rules, activeScriptId, vacationSettings, externalRequires, selectedAccountId } = get();

      let content: string;
      if (isOpaque) {
        content = rawScript;
      } else {
        content = generateScript(rules, vacationSettings || undefined, { externalRequires });
      }

      // Let plugins graft their managed sections (e.g. an inbox-category
      // classifier) into the script before it becomes the active one. A
      // handler returning a non-string is ignored to keep the upload valid.
      const transformed = await filterHooks.onSieveScriptGenerate.transform(content, {
        accountId: selectedAccountId || null,
      });
      if (typeof transformed === 'string' && transformed.trim().length > 0) {
        content = transformed;
      }

      if (activeScriptId) {
        await client.updateSieveScript(activeScriptId, content, true, selectedAccountId || undefined);
      } else {
        const script = await client.createSieveScript('filters', content, true, selectedAccountId || undefined);
        set({ activeScriptId: script.id });
      }

      set({ isSaving: false, rawScript: content });
      debug.log('filters', 'Filters saved successfully');
      void filterHooks.onFiltersSave.emit({ accountId: selectedAccountId || null });
      void filterHooks.onSieveScriptChange.emit({ accountId: selectedAccountId || null, script: content });
    } catch (error) {
      debug.error('Failed to save filters:', error);
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to save filters',
      });
      throw error;
    }
  },

  validateScript: async (client, content) => {
    return client.validateSieveScript(content, get().selectedAccountId || undefined);
  },

  addRule: (rule) => {
    // Insert new bulwark rules before external/opaque rules so Bulwark's
    // managed section stays contiguous.
    set((state) => {
      const bulwark = state.rules.filter(r => !r.origin || r.origin === 'bulwark');
      const external = state.rules.filter(r => r.origin === 'external' || r.origin === 'opaque');
      return { rules: [...bulwark, rule, ...external] };
    });
  },

  updateRule: (ruleId, updates) => {
    set((state) => ({
      rules: state.rules.map(r => {
        if (r.id !== ruleId) return r;
        if (r.origin === 'external' || r.origin === 'opaque') return r; // read-only
        return { ...r, ...updates };
      }),
    }));
  },

  deleteRule: (ruleId) => {
    set((state) => ({
      rules: state.rules.filter(r => {
        if (r.id !== ruleId) return true;
        return r.origin === 'external' || r.origin === 'opaque';
      }),
    }));
  },

  reorderRules: (ruleIds) => {
    // Only reorder bulwark rules; external rules always stay at the end in
    // their original order.
    set((state) => {
      const bulwarkMap = new Map(
        state.rules.filter(r => !r.origin || r.origin === 'bulwark').map(r => [r.id, r]),
      );
      const external = state.rules.filter(r => r.origin === 'external' || r.origin === 'opaque');
      const reordered = ruleIds.map(id => bulwarkMap.get(id)).filter(Boolean) as FilterRule[];
      return { rules: [...reordered, ...external] };
    });
  },

  toggleRule: (ruleId) => {
    set((state) => ({
      rules: state.rules.map(r => {
        if (r.id !== ruleId) return r;
        if (r.origin === 'external' || r.origin === 'opaque') return r; // read-only
        return { ...r, enabled: !r.enabled };
      }),
    }));
  },

  setRawScript: (content) => set({ rawScript: content }),

  resetToVisualBuilder: () => set({ isOpaque: false, rawScript: '', rules: [], externalRequires: [] }),

  clearState: () => set({
    rules: [],
    isLoading: false,
    isSaving: false,
    error: null,
    isSupported: false,
    sieveCapabilities: null,
    activeScriptId: null,
    isOpaque: false,
    rawScript: '',
    vacationSettings: null,
    externalRequires: [],
    availableAccounts: [],
    selectedAccountId: null,
  }),
}));
