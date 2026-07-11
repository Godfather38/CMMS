import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const ONBOARDING_TOTAL_STEPS = 5;

interface OnboardingState {
  currentStep: number;
  completed: boolean;
  folderId: string | null;
  firstDocCreated: boolean;

  nextStep: () => void;
  prevStep: () => void;
  setFolderId: (id: string | null) => void;
  setFirstDocCreated: (val: boolean) => void;
  markCompleted: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 1,
      completed: false,
      folderId: null,
      firstDocCreated: false,

      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(state.currentStep + 1, ONBOARDING_TOTAL_STEPS),
        })),
      prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
      setFolderId: (id) => set({ folderId: id }),
      setFirstDocCreated: (val) => set({ firstDocCreated: val }),
      markCompleted: () => set({ completed: true }),
      reset: () => set({ currentStep: 1, completed: false, folderId: null, firstDocCreated: false }),
    }),
    { name: 'cmms-onboarding' }
  )
);
