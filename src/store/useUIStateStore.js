import { create } from "zustand";
import { persist } from "zustand/middleware";

const useUIStateStore = create(
  persist(
    (set, get) => ({
      // Party room UI state
      partyRoomState: {
        activeBottomNav: "chat",
        showTransferModal: false,
        showParticipantMenu: null,
        hostMicEnabled: false,
        hostCameraEnabled: false,
      },
      
      // Video call state
      videoCallState: {
        micEnabled: false,
        cameraEnabled: false,
        audioVolume: 1,
      },
      
      // Chat state
      chatState: {
        lastMessage: "",
      },
      
      // Game state
      gameState: {
        activeTab: null,
        selectedCar: null,
        betAmount: null,
      },
      
      // Settings/Modal states (keyed by page/component)
      modalStates: {},
      
      // Update party room state
      updatePartyRoomState: (updates) =>
        set((state) => ({
          partyRoomState: { ...state.partyRoomState, ...updates },
        })),
      
      // Update video call state
      updateVideoCallState: (updates) =>
        set((state) => ({
          videoCallState: { ...state.videoCallState, ...updates },
        })),
      
      // Update chat state
      updateChatState: (updates) =>
        set((state) => ({
          chatState: { ...state.chatState, ...updates },
        })),
      
      // Update game state
      updateGameState: (updates) =>
        set((state) => ({
          gameState: { ...state.gameState, ...updates },
        })),
      
      // Set modal state for a specific key
      setModalState: (key, isOpen) =>
        set((state) => ({
          modalStates: { ...state.modalStates, [key]: isOpen },
        })),
      
      // Get modal state for a specific key
      getModalState: (key) => get().modalStates[key] || false,
      
      // Clear all UI state
      clearUIState: () =>
        set({
          partyRoomState: {
            activeBottomNav: "chat",
            showTransferModal: false,
            showParticipantMenu: null,
            hostMicEnabled: false,
            hostCameraEnabled: false,
          },
          videoCallState: {
            micEnabled: false,
            cameraEnabled: false,
            audioVolume: 1,
          },
          chatState: {
            lastMessage: "",
          },
          gameState: {
            activeTab: null,
            selectedCar: null,
            betAmount: null,
          },
          modalStates: {},
        }),
      
      // Clear state for a specific party (when leaving)
      clearPartyState: () =>
        set((state) => ({
          partyRoomState: {
            activeBottomNav: "chat",
            showTransferModal: false,
            showParticipantMenu: null,
            hostMicEnabled: false,
            hostCameraEnabled: false,
          },
        })),
    }),
    {
      name: "ui-state-store",
      partialize: (state) => ({
        partyRoomState: state.partyRoomState,
        videoCallState: state.videoCallState,
        chatState: state.chatState,
        gameState: state.gameState,
        modalStates: state.modalStates,
      }),
    }
  )
);

export default useUIStateStore;
