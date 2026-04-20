import { create } from 'zustand';

export type RunActionsTab = 'diagnose' | 'cancel' | 'retry';

interface State {
  open: boolean;
  runId: string | null;
  source: string | null;
  tab: RunActionsTab;
  openModal: (runId: string, source: string, tab?: RunActionsTab) => void;
  closeModal: () => void;
  setTab: (tab: RunActionsTab) => void;
}

/**
 * 전역 RunActions 모달 상태 — LiveRunFeed / StalledBanner / RunHistoryTable 어디서든
 * openModal(runId, source, tab) 호출로 같은 모달을 띄운다.
 * 단일 모달 인스턴스는 layout.tsx 또는 monitor/page.tsx에서 한 번만 렌더.
 */
export const useRunActionsModal = create<State>((set) => ({
  open: false,
  runId: null,
  source: null,
  tab: 'diagnose',
  openModal: (runId, source, tab = 'diagnose') => set({ open: true, runId, source, tab }),
  closeModal: () => set({ open: false, runId: null, source: null }),
  setTab: (tab) => set({ tab }),
}));
