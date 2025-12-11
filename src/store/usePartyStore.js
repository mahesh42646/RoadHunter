import { create } from "zustand";
import { persist } from "zustand/middleware";

const usePartyStore = create(
  persist(
    (set, get) => ({
      currentPartyId: null,
      isHost: false,
      joinedAt: null,
      setCurrentParty: (partyId, isHost) =>
        set({
          currentPartyId: partyId,
          isHost: isHost,
          joinedAt: Date.now(),
        }),
      clearCurrentParty: () =>
        set({
          currentPartyId: null,
          isHost: false,
          joinedAt: null,
        }),
      isInParty: () => Boolean(get().currentPartyId),
    }),
    {
      name: "party-store",
    }
  )
);

export default usePartyStore;

