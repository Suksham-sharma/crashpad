import { create } from 'zustand';

type UiState = {
  lastCreatedProjectId: string | null;
  setLastCreatedProjectId: (id: string | null) => void;
};

export const useUiStore = create<UiState>((set) => ({
  lastCreatedProjectId: null,
  setLastCreatedProjectId: (id) => set({ lastCreatedProjectId: id }),
}));
