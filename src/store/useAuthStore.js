import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hasSessionExpired } from "@/app/user/lib/security";

let setPersistedState;

const useAuthStore = create(
  persist(
    (set, get) => {
      setPersistedState = set;
      return {
        token: null,
        user: null,
        lastActiveAt: null,
        hydrated: false,
        setSession: ({ token, user }) =>
          set({
            token,
            user,
            lastActiveAt: Date.now(),
          }),
        clearSession: () =>
          set({
            token: null,
            user: null,
            lastActiveAt: null,
          }),
        markActive: () => {
          const { token } = get();
          if (!token) return;
          set({ lastActiveAt: Date.now() });
        },
        setHydrated: (value) => set({ hydrated: value }),
        ensureFreshSession: () => {
          const expired = hasSessionExpired(get().lastActiveAt);
          if (expired) {
            get().clearSession();
            return false;
          }
          return true;
        },
        updateUser: (updates) => {
          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : updates,
          }));
        },
      };
    },
    {
      name: "auth-store",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        lastActiveAt: state.lastActiveAt,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Failed to rehydrate auth store", error);
        }
        setPersistedState?.({ hydrated: true });
      },
    },
  ),
);

export const selectIsAuthenticated = (state) =>
  Boolean(state.token) && !hasSessionExpired(state.lastActiveAt);

export default useAuthStore;

