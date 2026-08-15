import { create } from 'zustand';
import type { IJMAPClient } from '@/lib/jmap/client-interface';

interface VacationStore {
  isEnabled: boolean;
  fromDate: string | null;
  toDate: string | null;
  subject: string;
  textBody: string;
  htmlBody: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isSupported: boolean;

  fetchVacationResponse: (client: IJMAPClient, accountId?: string) => Promise<void>;
  updateVacationResponse: (client: IJMAPClient, updates: {
    isEnabled?: boolean;
    fromDate?: string | null;
    toDate?: string | null;
    subject?: string;
    textBody?: string;
    htmlBody?: string | null;
  }, accountId?: string) => Promise<void>;
  setSupported: (supported: boolean) => void;
  clearState: () => void;
}

export const useVacationStore = create<VacationStore>()((set) => ({
  isEnabled: false,
  fromDate: null,
  toDate: null,
  subject: '',
  textBody: '',
  htmlBody: null,
  isLoading: false,
  isSaving: false,
  error: null,
  isSupported: false,

  fetchVacationResponse: async (client, accountId) => {
    set({ isLoading: true, error: null });
    try {
      const vacation = await client.getVacationResponse(accountId);
      set({
        isEnabled: vacation.isEnabled,
        fromDate: vacation.fromDate,
        toDate: vacation.toDate,
        subject: vacation.subject || '',
        textBody: vacation.textBody || '',
        htmlBody: vacation.htmlBody,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'fetch_error',
      });
    }
  },

  updateVacationResponse: async (client, updates, accountId) => {
    set({ isSaving: true, error: null });
    try {
      await client.setVacationResponse(updates, accountId);
      set((state) => ({
        ...state,
        ...updates,
        isSaving: false,
      }));
    } catch (error) {
      set({
        isSaving: false,
        error: error instanceof Error ? error.message : 'save_error',
      });
      throw error;
    }
  },

  setSupported: (supported) => set({ isSupported: supported }),

  clearState: () => set({
    isEnabled: false,
    fromDate: null,
    toDate: null,
    subject: '',
    textBody: '',
    htmlBody: null,
    isLoading: false,
    isSaving: false,
    error: null,
    isSupported: false,
  }),
}));
