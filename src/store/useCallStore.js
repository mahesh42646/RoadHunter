import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCallStore = create(
  persist(
    (set, get) => ({
      // Call state
      callStatus: 'idle', // idle, calling, ringing, connected, ended
      friendId: null,
      friend: null,
      isCaller: false,
      isMinimized: false,
      pipPosition: { x: typeof window !== 'undefined' ? window.innerWidth - 320 : 0, y: 20 },
      pipSize: { width: 300, height: 225 },
      isDragging: false,
      isResizing: false,
      
      // Media streams
      localStream: null,
      remoteStream: null,
      isMicEnabled: true,
      isVideoEnabled: true,
      
      // Actions
      setCallStatus: (status) => set({ callStatus: status }),
      setFriendId: (friendId) => set({ friendId }),
      setFriend: (friend) => set({ friend }),
      setIsCaller: (isCaller) => set({ isCaller }),
      setLocalStream: (stream) => {
        // Store stream reference, but don't persist it
        set({ localStream: stream });
      },
      setRemoteStream: (stream) => {
        // Store stream reference, but don't persist it
        set({ remoteStream: stream });
      },
      setIsMicEnabled: (enabled) => set({ isMicEnabled: enabled }),
      setIsVideoEnabled: (enabled) => set({ isVideoEnabled: enabled }),
      toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),
      setPipPosition: (position) => set({ pipPosition: position }),
      setPipSize: (size) => set({ pipSize: size }),
      setIsDragging: (dragging) => set({ isDragging: dragging }),
      setIsResizing: (resizing) => set({ isResizing: resizing }),
      toggleMic: () => set((state) => ({ isMicEnabled: !state.isMicEnabled })),
      toggleVideo: () => set((state) => ({ isVideoEnabled: !state.isVideoEnabled })),
      
      // Initialize call
      startCall: (friendId, friend, isCaller = true) => {
        set({
          callStatus: isCaller ? 'calling' : 'ringing',
          friendId,
          friend,
          isCaller,
          isMinimized: false,
        });
      },
      
      // End call
      endCall: () => {
        const state = get();
        if (state.localStream) {
          state.localStream.getTracks().forEach((track) => track.stop());
        }
        set({
          callStatus: 'idle',
          friendId: null,
          friend: null,
          isCaller: false,
          localStream: null,
          remoteStream: null,
          isMinimized: false,
        });
      },
      
      // Accept call
      acceptCall: () => {
        set({ callStatus: 'connected', isMinimized: false });
      },
      
      // Reject call
      rejectCall: () => {
        get().endCall();
      },
    }),
    {
      name: 'call-storage',
      partialize: (state) => ({
        // Only persist call metadata, not streams
        callStatus: state.callStatus,
        friendId: state.friendId,
        friend: state.friend,
        isCaller: state.isCaller,
        isMinimized: state.isMinimized,
        pipPosition: state.pipPosition,
        pipSize: state.pipSize,
        isMicEnabled: state.isMicEnabled,
        isVideoEnabled: state.isVideoEnabled,
      }),
    }
  )
);

export default useCallStore;
