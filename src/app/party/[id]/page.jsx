"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Button,
  Card,
  Form,
  Badge,
  Modal,
  Dropdown,
  ListGroup,
} from "react-bootstrap";
import {
  BsChatDots,
  BsController,
  BsGift,
  BsX,
  BsPersonCheck,
  BsPersonX,
  BsThreeDotsVertical,
  BsStarFill,
  BsCoin,
  BsPeople,
  BsLock,
  BsUnlock,
  BsArrowLeft,
  BsMic,
  BsMicMute,
  BsCameraVideo,
  BsCameraVideoOff,
  BsVolumeUp,
  BsVolumeMute,
} from "react-icons/bs";
import { HiSparkles } from "react-icons/hi";

import apiClient from "@/lib/apiClient";
import { getImageUrl, getInitials } from "@/lib/imageUtils";
import useAuthStore, { selectIsAuthenticated } from "@/store/useAuthStore";
import usePartyStore from "@/store/usePartyStore";
import useUIStateStore from "@/store/useUIStateStore";
import usePartySocket from "@/hooks/usePartySocket";
import useWebRTC from "@/hooks/useWebRTC";
import GiftSelector from "../components/GiftSelector";
import PredictionRaceGame from "../components/PredictionRaceGame";

export default function PartyRoomPage() {
  const router = useRouter();
  const params = useParams();
  const partyId = params.id;
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((state) => state.user);
  const setCurrentParty = usePartyStore((state) => state.setCurrentParty);
  const clearCurrentParty = usePartyStore((state) => state.clearCurrentParty);
  const currentPartyId = usePartyStore((state) => state.currentPartyId);
  
  // UI State from persisted store
  const partyRoomState = useUIStateStore((state) => state.partyRoomState);
  const updatePartyRoomState = useUIStateStore((state) => state.updatePartyRoomState);
  const clearPartyState = useUIStateStore((state) => state.clearPartyState);
  
  const [party, setParty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(partyRoomState.showTransferModal || false);
  const [showParticipantMenu, setShowParticipantMenu] = useState(partyRoomState.showParticipantMenu || null);
  const [activeBottomNav, setActiveBottomNav] = useState(partyRoomState.activeBottomNav || "games");
  const [wallet, setWallet] = useState(null);
  const [giftAnimations, setGiftAnimations] = useState([]);
  const [participantRelationship, setParticipantRelationship] = useState(null);
  const [showGiftSelector, setShowGiftSelector] = useState(false);
  const [giftRecipientId, setGiftRecipientId] = useState(null);
  const chatEndRef = useRef(null);
  const handleLeaveRef = useRef(null);
  const handleEndPartyRef = useRef(null);
  const [hostMicEnabled, setHostMicEnabled] = useState(partyRoomState.hostMicEnabled || false);
  const [hostCameraEnabled, setHostCameraEnabled] = useState(partyRoomState.hostCameraEnabled || false);
  const offlineTimerRef = useRef(null);
  const removeTimerRef = useRef(null);
  const isTabVisibleRef = useRef(true);
  const isTabClosingRef = useRef(false);

  const currentParticipant = party?.participants?.find(
    (p) => p.userId?.toString() === user?._id?.toString()
  );
  const isHost = party && user && party.hostId?.toString() === user._id?.toString();
  const isParticipant = !!currentParticipant && (currentParticipant.status === "active" || currentParticipant.status === "muted" || currentParticipant.status === "offline");
  const isMuted = currentParticipant?.status === "muted";

  const participants = party?.participants || [];
  const hostParticipant = participants.find((p) => p.role === "host") || {
    username: party?.hostUsername,
    avatarUrl: party?.hostAvatarUrl,
    userId: party?.hostId,
  };
  const otherParticipants = participants.filter((p) => p.role !== "host");
  const topParticipants = [...(hostParticipant ? [hostParticipant] : []), ...otherParticipants].slice(0, 12);
  const chatMessages = party?.chatMessages || [];
  const recentMessages = chatMessages.slice(-50);

  // Restore UI state from persisted store, but always default to games when joining
  useEffect(() => {
    // Always start with games when joining a party (ignore persisted state)
    setActiveBottomNav("games");
    updatePartyRoomState({ activeBottomNav: "games" });
    if (partyRoomState.hostMicEnabled !== undefined) {
      setHostMicEnabled(partyRoomState.hostMicEnabled);
    }
    if (partyRoomState.hostCameraEnabled !== undefined) {
      setHostCameraEnabled(partyRoomState.hostCameraEnabled);
    }
  }, []);

  // Persist UI state changes
  useEffect(() => {
    updatePartyRoomState({
      activeBottomNav,
      showTransferModal,
      showParticipantMenu,
      hostMicEnabled,
      hostCameraEnabled,
    });
  }, [activeBottomNav, showTransferModal, showParticipantMenu, hostMicEnabled, hostCameraEnabled, updatePartyRoomState]);

  useEffect(() => {
    // Wait for auth store to hydrate
    if (!hydrated) {
      return;
    }

    if (!isAuthenticated) {
      // Redirect to home (party list) if not authenticated
      router.replace("/");
      return;
    }

    // If user was in a different party, redirect to that party
    if (currentPartyId && currentPartyId !== partyId) {
      router.replace(`/party/${currentPartyId}`);
      return;
    }

    // If user was in this party, restore state
    if (currentPartyId === partyId) {
      // Set current party to ensure it's persisted
      const isUserHost = party?.hostId?.toString() === user?._id?.toString();
      if (party) {
        setCurrentParty(partyId, isUserHost);
      }
    }

    loadParty();
    loadWallet();
    
    // Add body class to prevent scroll
    document.body.classList.add("party-page");
    return () => {
      document.body.classList.remove("party-page");
    };
  }, [hydrated, isAuthenticated, router, partyId, currentPartyId, party, user, setCurrentParty]);

  const loadWallet = async () => {
    try {
      const response = await apiClient.get("/wallet/balance");
      setWallet(response.data);
    } catch (error) {
      console.error("Failed to load wallet", error);
    }
  };

  // Track tab visibility and handle offline timer for non-host users
  useEffect(() => {
    if (!isParticipant) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden - start 30 second timer to mark as offline and remove
        isTabVisibleRef.current = false;
        offlineTimerRef.current = setTimeout(async () => {
          // After 30 seconds, mark user as offline and remove from party
          try {
            await apiClient.post(`/parties/${partyId}/mark-offline`);
            // Immediately remove from party after 30 seconds offline
            try {
              await apiClient.post(`/parties/${partyId}/leave`);
              clearCurrentParty();
              router.push("/");
            } catch (error) {
              console.error("Failed to leave party after offline timer", error);
              // Still redirect even if API call fails
              clearCurrentParty();
              router.push("/");
            }
          } catch (error) {
            console.error("Failed to mark as offline", error);
            // Still redirect even if API call fails
            clearCurrentParty();
            router.push("/");
          }
        }, 30000); // 30 seconds
      } else {
        // Tab became visible again - clear timers and mark as active
        isTabVisibleRef.current = true;
        
        // Clear offline timer
        if (offlineTimerRef.current) {
          clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = null;
        }
        
        // Clear remove timer
        if (removeTimerRef.current) {
          clearTimeout(removeTimerRef.current);
          removeTimerRef.current = null;
        }
        
        // Mark as active if was offline (check current participant status)
        const participant = party?.participants?.find(
          (p) => p.userId?.toString() === user?._id?.toString()
        );
        if (participant?.status === 'offline') {
          apiClient.post(`/parties/${partyId}/mark-active`).catch(error => {
            console.error("Failed to mark as active", error);
          });
        }
      }
    };

    // Track actual tab close vs tab switch - ask confirmation for all users
    const handleBeforeUnload = (e) => {
      isTabClosingRef.current = true;
      e.preventDefault();
      e.returnValue = "Are you sure you want to exit the party room?";
      return e.returnValue;
    };

    // Handle browser back/forward - ask confirmation for all users
    let isHandlingPopState = false; // Prevent infinite loops
    const handlePopState = async (e) => {
      // Prevent infinite loops from pushState triggering popstate
      if (isHandlingPopState) {
        return;
      }
      
      if (isParticipant) {
        isHandlingPopState = true;
        const confirmed = confirm("Are you sure you want to exit the party room? You will leave the room.");
        if (confirmed) {
          try {
            if (isHost) {
              // Host needs to transfer or end party
              const action = confirm(
                "You are the host. Click OK to end party, or Cancel to transfer host."
              );
              if (action) {
                await handleEndPartyRef.current();
              } else {
                setShowTransferModal(true);
                // Use setTimeout to prevent immediate re-trigger
                setTimeout(() => {
                  window.history.pushState(null, "", window.location.pathname);
                  isHandlingPopState = false;
                }, 100);
                return;
              }
            } else {
              await apiClient.post(`/parties/${partyId}/leave`);
              clearCurrentParty();
              router.push("/");
            }
          } catch (error) {
            console.error("Failed to leave party", error);
            clearCurrentParty();
            router.push("/");
          }
        } else {
          // User cancelled - prevent navigation by pushing state back
          // Use setTimeout to prevent immediate re-trigger
          setTimeout(() => {
            window.history.pushState(null, "", window.location.pathname);
            isHandlingPopState = false;
          }, 100);
          return;
        }
        isHandlingPopState = false;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    // Only push state once on mount, not repeatedly
    if (window.history.state === null) {
      window.history.pushState({ preventBack: true }, "", window.location.pathname);
    }
    
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
      }
      if (removeTimerRef.current) {
        clearTimeout(removeTimerRef.current);
      }
    };
  }, [isParticipant, isHost, partyId, router, clearCurrentParty, party, user]);

  const loadParty = async () => {
    try {
      const response = await apiClient.get(`/parties/${partyId}`);
      const partyData = response.data.party;
      
      if (!partyData.isActive) {
        clearCurrentParty();
        clearPartyState();
        setLoading(false);
        router.replace("/");
        return;
      }

      setParty(partyData);
      
      const isUserHost = partyData.hostId?.toString() === user?._id?.toString();
      
      // Always set current party when party is loaded (for refresh persistence)
      setCurrentParty(partyId, isUserHost);
      
      // Check if user is already a participant
      const currentParticipant = partyData.participants?.find(
        (p) => p.userId?.toString() === user?._id?.toString()
      );
      
      // If user is host, auto-join them (even if offline)
      if (isUserHost) {
        if (!currentParticipant || currentParticipant.status === 'offline' || currentParticipant.status === 'left') {
          try {
            const joinResponse = await apiClient.post(`/parties/${partyId}/join`);
            if (joinResponse.data.party) {
              setParty(joinResponse.data.party);
              setCurrentParty(partyId, true);
            }
          } catch (joinError) {
            console.error("Failed to rejoin party as host", joinError);
            // Even if join fails, set current party if user is host
            setCurrentParty(partyId, true);
          }
        } else {
          // User is already an active participant, ensure current party is set
          setCurrentParty(partyId, true);
        }
      } else if (currentParticipant) {
        // Non-host participant
        if (currentParticipant.status === 'active' || currentParticipant.status === 'muted') {
          setCurrentParty(partyId, false);
        } else if (currentParticipant.status === 'offline' || currentParticipant.status === 'left') {
          // Try to rejoin if offline or left
          try {
            const joinResponse = await apiClient.post(`/parties/${partyId}/join`);
            if (joinResponse.data.party) {
              setParty(joinResponse.data.party);
              setCurrentParty(partyId, false);
            }
          } catch (joinError) {
            console.error("Failed to rejoin party", joinError);
            // If rejoin fails and user is not in party, clear store
            if (joinError.response?.status === 404 || joinError.response?.status === 403) {
              clearCurrentParty();
              clearPartyState();
            }
          }
        }
      } else {
        // User is not a participant but party exists
        // Redirect to home page to see party list - no manual join button
        clearCurrentParty();
        clearPartyState();
        router.replace("/");
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to load party", error);
      // Only redirect if it's a 404 or party doesn't exist
      if (error.response?.status === 404) {
        clearCurrentParty();
        clearPartyState();
        router.replace("/");
        return;
      }
      // For other errors, still set loading to false and try to keep user on page
      // if they were in the party (might be temporary network issue)
      if (currentPartyId === partyId) {
        // User was in this party, keep them here even if load fails
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleJoin = async () => {
    if (joining) return; // Prevent double-click
    setJoining(true);
    try {
      const response = await apiClient.post(`/parties/${partyId}/join`);
      if (response.data.request) {
        alert("Join request sent! Waiting for host approval...");
      } else {
        setParty(response.data.party);
        await loadParty(); // Wait for party data to reload
        // Set current party after joining
        const isUserHost = response.data.party?.hostId?.toString() === user?._id?.toString();
        setCurrentParty(partyId, isUserHost);
      }
    } catch (error) {
      alert(error.response?.data?.error || "Failed to join party");
    } finally {
      setJoining(false);
    }
  };

  // Set current party when joining
  useEffect(() => {
    if (isParticipant && partyId) {
      setCurrentParty(partyId, isHost);
    }
  }, [isParticipant, partyId, isHost, setCurrentParty]);

  const handleLeave = async () => {
    // If host, show transfer/end options
    if (isHost) {
      const action = confirm(
        "You are the host. You must transfer host to someone else or end the party.\n\nClick OK to end party, or Cancel to transfer host."
      );
      if (action) {
        // End party
        await handleEndParty();
      } else {
        // Show transfer modal
        setShowTransferModal(true);
      }
      return;
    }

    // Non-host users leave directly
    try {
      await apiClient.post(`/parties/${partyId}/leave`);
      clearCurrentParty();
      clearPartyState(); // Clear party UI state
      router.push("/");
    } catch (error) {
      console.error("Failed to leave party", error);
      
      // If party not found or user not in party, clear store and allow navigation
      if (error.response?.status === 404 || error.response?.data?.message === 'Not in party') {
        clearCurrentParty();
        clearPartyState(); // Clear party UI state
        router.push("/");
        return;
      }

      const errorMsg = error.response?.data?.error || error.message || "Failed to leave party";
      alert(errorMsg);
      // Even on error, try to clear store and navigate
      clearCurrentParty();
      clearPartyState(); // Clear party UI state
      router.push("/");
    }
  };

  handleLeaveRef.current = handleLeave;

  const handleTransferHost = async (userId) => {
    try {
      await apiClient.post(`/parties/${partyId}/transfer-host/${userId}`);
      setShowTransferModal(false);
      loadParty();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to transfer host");
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!confirm("Are you sure you want to remove this user?")) return;
    try {
      await apiClient.post(`/parties/${partyId}/remove/${userId}`);
      loadParty();
      setShowParticipantMenu(null);
    } catch (error) {
      alert(error.response?.data?.error || "Failed to remove user");
    }
  };

  const handleMuteUser = async (userId) => {
    try {
      await apiClient.post(`/parties/${partyId}/mute/${userId}`);
      loadParty();
      setShowParticipantMenu(null);
    } catch (error) {
      alert(error.response?.data?.error || "Failed to mute/unmute user");
    }
  };

  const loadParticipantRelationship = async (userId) => {
    try {
      const response = await apiClient.get(`/friends/profile/${userId}`);
      setParticipantRelationship(response.data.user?.relationship || {});
    } catch (error) {
      console.error("Failed to load participant relationship:", error);
      setParticipantRelationship({});
    }
  };

  const handleFollowParticipant = async (userId) => {
    try {
      const participant = participants.find((p) => p.userId?.toString() === userId);
      if (!participant) return;

      const profilePrivacy = participantRelationship?.profilePrivacy || 'public';
      await apiClient.post(`/friends/request/${userId}`);
      
      // Refresh relationship
      await loadParticipantRelationship(userId);
      // Refresh user data
      const meResponse = await apiClient.get("/users/me");
      const { setSession } = useAuthStore.getState();
      const { token } = useAuthStore.getState();
      setSession({ token, user: meResponse.data.user });
      
      setShowParticipantMenu(null);
      alert("Followed successfully!");
    } catch (error) {
      alert(error.response?.data?.error || "Failed to follow user");
    }
  };

  const handleSendGiftToParticipant = async (userId) => {
    // Check if user is a friend first
    try {
      const response = await apiClient.get(`/friends/profile/${userId}`);
      const relationship = response.data.user?.relationship || {};
      const isFriend = relationship.isFriend || relationship.isFollowing || false;
      
      if (!isFriend) {
        alert("You can only send gifts to friends. Please follow this user first.");
        return;
      }
      
      setGiftRecipientId(userId);
      setShowGiftSelector(true);
      setShowParticipantMenu(null);
    } catch (error) {
      console.error("Failed to check relationship:", error);
      alert("Failed to check user relationship");
    }
  };

  const handleReportUser = async (userId) => {
    const reason = prompt("Please provide a reason for reporting this user:");
    if (!reason || !reason.trim()) return;

    try {
      await apiClient.post(`/users/report/${userId}`, { reason: reason.trim() });
      alert("User reported successfully. Thank you for keeping our community safe.");
      setShowParticipantMenu(null);
    } catch (error) {
      if (error.response?.status === 404) {
        // Endpoint doesn't exist yet, we'll create it
        alert("Report feature coming soon!");
      } else {
        alert(error.response?.data?.error || "Failed to report user");
      }
    }
  };

  const handleEndParty = async () => {
    if (!confirm("Are you sure you want to end this party?")) return;
    
    try {
      await apiClient.delete(`/parties/${partyId}`);
      clearCurrentParty();
      clearPartyState(); // Clear party UI state
      router.push("/");
    } catch (error) {
      alert(error.response?.data?.error || "Failed to end party");
      // Even on error, redirect to home
      clearCurrentParty();
      clearPartyState();
      router.push("/");
    }
  };

  useEffect(() => {
    handleEndPartyRef.current = handleEndParty;
  }, [handleEndParty, clearCurrentParty, partyId, router]);

  const handleToggleMic = async () => {
    if (!isHost) return;
    try {
      // Toggle mic using WebRTC first
      await webrtc.toggleMic();
      
      // Then update backend
      const response = await apiClient.post(`/parties/${partyId}/toggle-mic`);
      setParty(response.data.party);
      setHostMicEnabled(response.data.party.hostMicEnabled);
      
      // Notify participants via socket to start/stop receiving stream
      if (socket) {
        socket.emit("webrtc:host-stream-started", {
          partyId,
          audio: response.data.party.hostMicEnabled,
          video: hostCameraEnabled,
        });
      }
    } catch (error) {
      console.error("Error toggling mic:", error);
      // If permission denied, show user-friendly message
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        alert("Microphone permission denied. Please allow microphone access in your browser settings.");
      } else {
        alert(error.response?.data?.error || error.message || "Failed to toggle mic");
      }
    }
  };

  const handleToggleCamera = async () => {
    if (!isHost) return;
    try {
      // Toggle camera using WebRTC first
      await webrtc.toggleCamera();
      
      // Then update backend
      const response = await apiClient.post(`/parties/${partyId}/toggle-camera`);
      setParty(response.data.party);
      setHostCameraEnabled(response.data.party.hostCameraEnabled);
      
      // Notify participants via socket to start/stop receiving stream
      if (socket) {
        socket.emit("webrtc:host-stream-started", {
          partyId,
          audio: hostMicEnabled,
          video: response.data.party.hostCameraEnabled,
        });
      }
    } catch (error) {
      console.error("Error toggling camera:", error);
      // If permission denied, show user-friendly message
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        alert("Camera permission denied. Please allow camera access in your browser settings.");
      } else {
        alert(error.response?.data?.error || error.message || "Failed to toggle camera");
      }
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || sendingChat || isMuted) return;
    setSendingChat(true);
    try {
      await apiClient.post(`/parties/${partyId}/chat`, { message: chatMessage });
      setChatMessage("");
    } catch (error) {
      alert(error.response?.data?.error || "Failed to send message");
    } finally {
      setSendingChat(false);
    }
  };

  const socket = usePartySocket(partyId, {
    onParticipantJoined: (data) => {
      setParty((prev) => {
        const participants = prev.participants || [];
        // Check if participant already exists
        const existingIndex = participants.findIndex(
          (p) => p.userId?.toString() === data.participant.userId?.toString()
        );
        
        if (existingIndex !== -1) {
          // Update existing participant (e.g., status change from 'left' to 'active')
          const updated = [...participants];
          updated[existingIndex] = { ...updated[existingIndex], ...data.participant };
          return { ...prev, participants: updated };
        }
        
        // Add new participant
        return {
          ...prev,
          participants: [...participants, data.participant],
        };
      });
    },
    onParticipantLeft: (data) => {
      setParty((prev) => ({
        ...prev,
        participants: (prev.participants || []).filter(
          (p) => p.userId?.toString() !== data.userId
        ),
      }));
      if (data.userId === user?._id?.toString()) {
        clearCurrentParty();
        clearPartyState();
        router.push("/");
      }
    },
    onParticipantOffline: (data) => {
      setParty((prev) => {
        const participants = prev.participants || [];
        const index = participants.findIndex(
          (p) => p.userId?.toString() === data.userId?.toString()
        );
        
        if (index !== -1) {
          const updated = [...participants];
          updated[index] = {
            ...updated[index],
            status: 'offline',
          };
          return { ...prev, participants: updated };
        }
        
        return prev;
      });
    },
    onChatMessage: (data) => {
      setParty((prev) => ({
        ...prev,
        chatMessages: [...(prev.chatMessages || []), data.message],
      }));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onPartyEnded: () => {
      clearCurrentParty();
      clearPartyState();
      router.push("/");
    },
    onHostTransferred: (data) => {
      loadParty();
    },
    onParticipantRemoved: (data) => {
      if (data.userId === user?._id?.toString()) {
        clearCurrentParty();
        clearPartyState();
        router.push("/");
      } else {
        loadParty();
      }
    },
    onParticipantMuted: (data) => {
      if (data.userId === user?._id?.toString()) {
        setParty((prev) => ({
          ...prev,
          participants: (prev.participants || []).map((p) =>
            p.userId?.toString() === data.userId
              ? { ...p, status: data.muted ? "muted" : "active" }
              : p
          ),
        }));
      } else {
        loadParty();
      }
    },
    onGiftSent: (data) => {
      if (data.partyId === partyId) {
        setParty((prev) => ({
          ...prev,
          chatMessages: [...(prev.chatMessages || []), data.message],
        }));
        
        // Add gift animation
        setGiftAnimations((prev) => [
          ...prev,
          {
            id: Date.now(),
            gift: data.gift,
            recipients: data.gift.recipients,
          },
        ]);
        
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        
        // Remove animation after 3 seconds
        setTimeout(() => {
          setGiftAnimations((prev) => prev.slice(1));
        }, 3000);
      }
    },
    onWalletUpdated: (data) => {
      if (data.userId === user?._id?.toString()) {
        setWallet(data.wallet);
      }
    },
    onHostMicToggled: (data) => {
      setHostMicEnabled(data.enabled);
      setParty((prev) => ({ ...prev, hostMicEnabled: data.enabled }));
    },
    onHostCameraToggled: (data) => {
      setHostCameraEnabled(data.enabled);
      setParty((prev) => ({ ...prev, hostCameraEnabled: data.enabled }));
    },
    onStreamState: (data) => {
      // Update host stream state when joining/rejoining
      setHostMicEnabled(data.hostMicEnabled);
      setHostCameraEnabled(data.hostCameraEnabled);
      setParty((prev) => ({ 
        ...prev, 
        hostMicEnabled: data.hostMicEnabled,
        hostCameraEnabled: data.hostCameraEnabled 
      }));
      
      // Check if current user is the host
      const currentUserId = user?._id?.toString();
      const hostUserId = data.hostId?.toString();
      const amIHost = currentUserId && hostUserId && currentUserId === hostUserId;
      
      // If host has active stream and we're not the host, request connection
      if (!amIHost && (data.hostMicEnabled || data.hostCameraEnabled) && data.hostId && socket) {
        
        // Request stream with retry mechanism
        let retryCount = 0;
        const maxRetries = 3;
        const requestInterval = 1000; // 1 second between retries
        
        const requestStream = () => {
          if (socket && retryCount < maxRetries) {
            console.log(`[Party] 📞 Requesting stream (attempt ${retryCount + 1}/${maxRetries})`);
            socket.emit('webrtc:request-stream', {
              partyId,
              hostId: data.hostId,
            });
            retryCount++;
            
            // Retry if needed (will stop once connection is established)
            if (retryCount < maxRetries) {
              setTimeout(requestStream, requestInterval);
            }
          } else if (!socket) {
            // Cannot request stream - socket not available
          }
        };
        
        // Start requesting after short delay
        setTimeout(requestStream, 500);
      } else {
        // Skipping stream request
      }
    },
  });

  // Initialize WebRTC hook after socket is available
  const webrtc = useWebRTC(
    partyId,
    socket,
    isHost,
    hostMicEnabled,
    hostCameraEnabled,
    user?._id?.toString()
  );

  // Backup: Request stream when camera/mic state changes and we're not host
  useEffect(() => {
    if (!isHost && socket && party && (hostMicEnabled || hostCameraEnabled)) {
      const hostId = party.hostId?.toString();
      if (hostId && hostId !== user?._id?.toString()) {
        console.log("[Party] Backup stream request - mic:", hostMicEnabled, "cam:", hostCameraEnabled);
        setTimeout(() => {
          if (socket) {
            console.log("[Party] Emitting backup webrtc:request-stream");
            socket.emit('webrtc:request-stream', {
              partyId,
              hostId: hostId,
            });
          }
        }, 1000);
      }
    }
  }, [isHost, socket, party, hostMicEnabled, hostCameraEnabled, partyId, user?._id]);

  // Sync host mic/camera state from party data
  useEffect(() => {
    if (party) {
      setHostMicEnabled(party.hostMicEnabled || false);
      setHostCameraEnabled(party.hostCameraEnabled || false);
    }
  }, [party]);

  useEffect(() => {
    if (party?.chatMessages) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [party?.chatMessages]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <div className="spinner-border mb-3" style={{ color: "var(--accent)" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p style={{ color: "var(--text-muted)" }}>Loading party...</p>
        </div>
      </div>
    );
  }

  if (!party) return null;

  const otherParticipantsForTransfer = participants.filter(
    (p) => p.userId?.toString() !== user?._id?.toString() && p.role !== "host"
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "radial-gradient(ellipse at top, #0f1624 0%, #0a0e1a 50%, #050810 100%)",
      }}
    >
      {/* Top Section - Participants */}
      <div
        className="glass-card p-3"
        style={{
          flex: "0 0 25%",
          
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div className="d-flex justify-content-between align-items-start " style={{ gap: "0.5rem" }}>
          <div className="d-flex justify-content-between align-items-center" style={{ minWidth: 0 }}>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h6 className="fw-bold mb-0 text-truncate" style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                {party.name}
              </h6>
              {party.privacy === "public" ? (
                <BsUnlock style={{ color: "var(--accent-secondary)", fontSize: "0.8rem" }} />
              ) : (
                <BsLock style={{ color: "var(--accent-tertiary)", fontSize: "0.8rem" }} />
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge
                style={{
                  background: party.privacy === "public" ? "rgba(0, 245, 255, 0.2)" : "rgba(255, 122, 24, 0.2)",
                  color: party.privacy === "public" ? "var(--accent-secondary)" : "var(--accent-tertiary)",
                  border: party.privacy === "public" ? "1px solid rgba(0, 245, 255, 0.3)" : "1px solid rgba(255, 122, 24, 0.3)",
                  fontSize: "0.65rem",
                  padding: "0.2rem 0.4rem",
                }}
              >
               
              </Badge>
              <div className="d-flex align-items-center gap-1" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                <BsPeople style={{ fontSize: "0.75rem" }} />
                <span>{participants.length}/50</span>
              </div>
            </div>
          </div>
          <div className="d-flex gap-1  flex-shrink-0 align-items-center p-0">
            {isParticipant && (
              <>
                {isHost && (
                  <>
                    <Button
                      variant={hostMicEnabled ? "success" : "outline-secondary"}
                      size="sm"
                      onClick={handleToggleMic}
                      style={{ fontSize: "0.7rem",  minWidth: "36px" }}
                      title={hostMicEnabled ? "Turn off microphone" : "Turn on microphone"}
                    >
                      {hostMicEnabled ? <BsMic /> : <BsMicMute />}
                    </Button>
                    <Button
                      variant={hostCameraEnabled ? "success" : "outline-secondary"}
                      size="sm"
                      onClick={handleToggleCamera}
                      style={{ fontSize: "0.7rem",  minWidth: "36px" }}
                      title={hostCameraEnabled ? "Turn off camera" : "Turn on camera"}
                    >
                      {hostCameraEnabled ? <BsCameraVideo /> : <BsCameraVideoOff />}
                    </Button>
                    <Button className="border "  onClick={handleEndParty} >
                      End
                    </Button>
                  </>
                )}
                <Button className="border p-0 " onClick={handleLeave}  title="Leave Party">
                  <BsArrowLeft />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Hidden audio element for audio-only streams (participants) */}
        {!isHost && (
          <audio
            ref={(el) => {
              if (el && webrtc.remoteStream) {
                el.srcObject = webrtc.remoteStream;
                el.volume = webrtc.audioVolume;
                el.muted = !webrtc.audioEnabled;
                el.play().catch(err => {
                  console.error("[PARTICIPANT] Audio play failed:", err);
                });
              }
            }}
            autoPlay
            playsInline
            style={{ display: "none" }}
          />
        )}

        {/* Participants Cards Grid - Responsive */}
        <div
          className="participants-grid-responsive "
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            gap: "0.5rem",
            padding: "0.1rem",
            alignContent: "flex-start",
           
          }}
        >
          {topParticipants.map((participant, idx) => {
            const isParticipantHost = participant.role === "host";
            const isCurrentUser = participant.userId?.toString() === user?._id?.toString();
            const participantWallet = isCurrentUser && wallet ? wallet.partyCoins || 0 : null;
            
            return (
              <div
                key={idx}
                className=" rounded-3  p-1"
                style={{
                  position: "relative",
                  width: "100%",
                  cursor: !isCurrentUser ? "pointer" : "default",
                  border: isParticipantHost
                    ? "1px solid var(--accent)"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: isParticipantHost 
                    ? "0 4px 12px rgba(255, 45, 149, 0.3)" 
                    : "0 2px 8px rgba(0, 0, 0, 0.2)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  width: "auto",
                  aspectRatio: "1",
                }}
                onClick={async () => {
                  if (!isCurrentUser) {
                    const userId = participant.userId?.toString();
                    setShowParticipantMenu(userId);
                    await loadParticipantRelationship(userId);
                  }
                }}
                onMouseEnter={(e) => {
                  if (!isCurrentUser) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = isParticipantHost 
                      ? "0 6px 16px rgba(255, 45, 149, 0.4)" 
                      : "0 4px 12px rgba(0, 0, 0, 0.3)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = isParticipantHost 
                    ? "0 4px 12px rgba(255, 45, 149, 0.3)" 
                    : "0 2px 8px rgba(0, 0, 0, 0.2)";
                }}  >
                {/* Host Badge */}
                {isParticipantHost && (
                  <div
                    style={{
                      position: "absolute",
                      top: "0.5rem",
                      right: "0.5rem",
                      zIndex: 10,
                    }}
                  >
                    <Badge
                      className="host-badge"
                      style={{
                        color: "white",
                        border: "none",
                        fontSize: "clamp(0.5rem, 1.2vw, 0.6rem)",
                        display: "flex",
                        alignItems: "center",
                        gap: "clamp(0.15rem, 0.5vw, 0.25rem)",
                        fontWeight: "bold",
                        background: "var(--accent)",
                      }}
                    >
                      <BsStarFill style={{ fontSize: "clamp(0.5rem, 1.2vw, 0.65rem)" }} />
                     
                    </Badge>
                  </div>
                )}

                {/* Avatar/Video Container */}
                <div 
                  className="rounded-3 "
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1",
                    
                    overflow: "hidden",
                    // marginBottom: "0.5rem",
                
                    background: "rgba(0, 0, 0, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Host Video (for participants) or Host Local Video */}
                  {isParticipantHost ? (
                    <>
                      {isHost ? (
                        // Host sees their own local video
                        <video className="rounded-3 border"
                          ref={webrtc.localVideoRef}
                          autoPlay
                          playsInline
                          muted={true}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: hostCameraEnabled ? "block" : "none",
                          }}
                        />
                      ) : (
                        // Participants see host's remote video
                        <video className="rounded-3 border"
                          ref={webrtc.remoteVideoRef}
                          autoPlay
                          playsInline
                          muted={true}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onCanPlay={(e) => {
                            const video = e.target;
                            // DON'T unmute here - it causes video to pause due to autoplay policy
                            // Keep video muted, user can toggle audio via audio controls
                            video.volume = webrtc.audioVolume;
                            // Ensure video continues playing
                            if (video.paused) {
                              video.play().catch(() => {});
                            }
                          }}
                          onLoadedMetadata={() => {
                            
                            const reduceBuffer = () => {
                              if (video.buffered.length > 0) {
                                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                                const bufferSize = bufferedEnd - video.currentTime;
                                if (bufferSize > 0.05) {
                                  video.currentTime = bufferedEnd - 0.05;
                                }
                              }
                            };
                            reduceBuffer();
                            video.addEventListener('progress', reduceBuffer);
                            video.addEventListener('timeupdate', reduceBuffer);
                          }}
                        />
                      )}
                      {/* Fallback avatar if video not available */}
                      {(!hostCameraEnabled || (!isHost && !webrtc.remoteStream)) && (
                        <div className="rounded-3"
                          style={{
                            position: "absolute",
                            inset: 0,
                    background: participant.avatarUrl && getImageUrl(participant.avatarUrl)
                      ? `url(${getImageUrl(participant.avatarUrl)}) center/cover`
                      : "rgba(255, 45, 149, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: "bold",
                            fontSize: "2rem",
                  }}
                >
                  {(!participant.avatarUrl || !getImageUrl(participant.avatarUrl)) && getInitials(participant.username || "?")}
                </div>
                      )}
                    </>
                  ) : (
                    // Regular participant avatar
                    <div
                      className="-3"
                      style={{
                        width: "100%",
                        height: "100%",
                        background: participant.avatarUrl && getImageUrl(participant.avatarUrl)
                          ? `url(${getImageUrl(participant.avatarUrl)}) center/cover`
                          : "rgba(255, 45, 149, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "2rem",
                      }}
                    >
                      {(!participant.avatarUrl || !getImageUrl(participant.avatarUrl)) && getInitials(participant.username || "?")}
                    </div>
                  )}
                </div>

                {/* Participant Name */}
                <p
                  className=" fw-bold m-0 text-center p-1"
                  style={{ 
                    color: "var(--text-primary)", 
                    fontSize: "clamp(0.65rem, 2vw, 0.85rem)", 
                    
                  }}
                  title={participant.username}
                >
                  {participant.username}
                </p>

               

                {/* Status Badges */}
                <div className="d-flex align-items-center justify-content-center gap-1 participant-badges" style={{ flexWrap: "wrap", marginTop: "auto" }}>
                  {participant.status === "muted" && (
                    <Badge
                      style={{
                        background: "rgba(255, 122, 24, 0.2)",
                        color: "var(--accent-tertiary)",
                        border: "1px solid rgba(255, 122, 24, 0.3)",
                        fontSize: "clamp(0.5rem, 1.2vw, 0.6rem)",
                        padding: "0.1rem 0.25rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.15rem",
                      }}
                    >
                      <BsMicMute style={{ fontSize: "clamp(0.45rem, 1.2vw, 0.55rem)" }} />
                      <span className="d-none d-sm-inline">Muted</span>
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Section - Comments */}
      <div
        className="glass-card"
        style={{
          flex: "0 0 75%",
          
          // paddingBottom: isParticipant ? "33px" : "10px", // Account for bottom nav (60px) + spacing
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          minHeight: 0,
          padding: "0",
        }}
      >
        
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            // marginBottom: "0.5rem",
            display: "flex",
            flexDirection: "column",
            // gap: "0.4rem",
            paddingBottom: isParticipant && activeBottomNav === "chat" ? "30px" : "0px", // Extra space for fixed chat input
          }}
        >
            {recentMessages.map((msg, idx) => {
              const isMessageFromHost = msg.userId?.toString() === party.hostId?.toString();
              return (
                <div
                  key={idx}
                  className="d-flex align-items-start gap-2 p-2"
                  style={{
                    
                    background: "linear-gradient(90deg, rgba(58, 58, 58, 0.43) 0%, rgba(0, 0, 0, 0.1) 100%)",
                    
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                      background: msg.avatarUrl && getImageUrl(msg.avatarUrl)
                        ? `url(${getImageUrl(msg.avatarUrl)}) center/cover`
                        : "rgba(255, 45, 149, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "0.7rem",
                    }}
                    
                  >
                    {(!msg.avatarUrl || !getImageUrl(msg.avatarUrl)) && getInitials(msg.username || "?")}
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center gap-1 mb-1">
                      <span
                        className="small fw-semibold"
                        style={{ color: isMessageFromHost ? "var(--accent)" : "var(--accent-secondary)" }}
                      >
                        {msg.username}
                      </span>
                      <span
                      className="small px-3"
                      style={{ color: "var(--text-dim)", fontSize: "0.65rem" }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                      {isMessageFromHost && (
                        <Badge className="px-2 bg-transparent"
                          style={{
                            color: "var(--accent)",
                            fontSize: "0.6rem",
                            display: "flex",
                            gap: "0.3rem",
                          }}
                        >
                          <BsStarFill style={{ fontSize: "0.5rem" }} />
                          Host
                        </Badge>
                        
                      )}
                      
                    </div>
                    <span className="mb-0 small" style={{ 
                      color: msg.type === 'gift' ? "var(--accent)" : "var(--text-primary)", 
                      fontSize: "0.8rem",
                      fontWeight: msg.type === 'gift' ? "bold" : "normal",
                    }}>
                      {msg.type === 'gift' && (
                        <span style={{ fontSize: "1.2rem", marginRight: "0.25rem" }}>
                          {msg.giftType === 'lucky-kiss' ? '💋' :
                           msg.giftType === 'hugging-heart' ? '🤗❤️' :
                           msg.giftType === 'holding-hands' ? '🤝' :
                           msg.giftType === 'lucky-star' ? '⭐' :
                           msg.giftType === 'lollipop' ? '🍭' :
                           msg.giftType === 'kiss' ? '💋' :
                           msg.giftType === 'bouquet' ? '🌹' :
                           msg.giftType === 'love-car' ? '🚗💕' : '🎁'}
                        </span>
                      )}
                      {msg.message}
                    </span>
                   
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          {isParticipant && activeBottomNav === "chat" && (
            <div 
              className="chat-input-container"
              style={{ 
                position: "fixed",
                bottom: "65px", // Just above the bottom nav (60px + 5px spacing)
                left: "0.5rem",
                right: "0.5rem",
                paddingBottom: "10px", 
                zIndex: 1500,
                background: "rgba(15, 22, 36, 0.98)",
                backdropFilter: "blur(20px)",
                padding: "0.75rem",
                
                boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.3)",
              }}
            >
              <Form onSubmit={handleSendChat} className="d-flex gap-2">
                <Form.Control
                  type="text"
                  placeholder={isMuted ? "You are muted..." : "Type a comment..."}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  maxLength={500}
                  disabled={isMuted}
                  size="sm"
                  style={{ fontSize: "0.8rem" }}
                />
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="sm" 
                  disabled={sendingChat || !chatMessage.trim() || isMuted}
                  style={{ fontSize: "0.8rem", minWidth: "60px" }}
                >
                  {sendingChat ? "..." : "Send"}
                </Button>
              </Form>
            </div>
          )}
          {isParticipant && activeBottomNav === "gifts" && (
            <div style={{ 
              position: "relative", 
              zIndex: 1, 
              maxHeight: "calc(100% - 20px)", 
              overflowY: "auto",
              paddingBottom: "10px",
            }}>
              <GiftSelector
                show={true}
                onHide={() => setActiveBottomNav("games")}
                partyId={partyId}
                wallet={wallet}
                onGiftSent={() => {
                  loadWallet();
                  // Stay on gifts after sending, or go back to games
                  // setActiveBottomNav("games");
                }}
                participants={participants}
                hostId={party?.hostId}
              />
            </div>
          )}
          {isParticipant && activeBottomNav === "games" && (
            <div style={{ height: "100%", overflow: "auto", padding: "0px" }}>
              <PredictionRaceGame
                socket={socket}
                wallet={wallet}
                onClose={() => setActiveBottomNav("games")}
                partyId={partyId}
              />
            </div>
          )}
          {!isParticipant && (
            <div className="text-center p-3" style={{ color: "var(--text-muted)" }}>
              <p className="small mb-0">Join the party to comment</p>
            </div>
          )}
        </div>

      {/* Gift Animations Overlay */}
      {giftAnimations.map((anim) => (
        <div
          key={anim.id}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "none",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "4rem",
              animation: "giftFly 3s ease-out forwards",
            }}
          >
            {anim.gift.giftEmoji}
          </div>
        </div>
      ))}

      {/* Bottom Navigation */}
      {isParticipant && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "60px",
            background: "rgba(15, 22, 36, 0.95)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "0 1rem",
            zIndex: 2000,
            boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.3)",
          }}
        >
          <button
            onClick={() => setActiveBottomNav("chat")}
            style={{
              background: activeBottomNav === "chat" ? "rgba(255, 45, 149, 0.2)" : "transparent",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: activeBottomNav === "chat" ? "var(--accent)" : "var(--text-muted)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (activeBottomNav !== "chat") {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "scale(1.1)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeBottomNav !== "chat") {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
            title="Chat"
          >
            <BsChatDots style={{ fontSize: "1.1rem" }} />
          </button>
          <button
            onClick={() => setActiveBottomNav("games")}
            style={{
              background: activeBottomNav === "games" ? "rgba(255, 122, 24, 0.2)" : "transparent",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: activeBottomNav === "games" ? "var(--accent-tertiary)" : "var(--text-muted)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (activeBottomNav !== "games") {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "scale(1.1)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeBottomNav !== "games") {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
            title="Games"
          >
            <BsController style={{ fontSize: "1.1rem" }} />
          </button>
          <button
            onClick={() => setActiveBottomNav("gifts")}
            style={{
              background: activeBottomNav === "gifts" 
                ? "linear-gradient(135deg, rgba(255, 45, 149, 0.3) 0%, rgba(255, 122, 24, 0.3) 100%)"
                : "transparent",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: activeBottomNav === "gifts" ? "var(--accent)" : "var(--text-muted)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (activeBottomNav !== "gifts") {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "scale(1.1)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeBottomNav !== "gifts") {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
            title="Gifts"
          >
            <BsGift style={{ fontSize: "1.1rem" }} />
          </button>
      
     
          <button
            onClick={handleLeave}
            style={{
              background: "transparent",
              border: "none",
              borderRadius: "50%",
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-muted)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 107, 122, 0.2)";
              e.currentTarget.style.color = "#ff6b7a";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.transform = "scale(1)";
            }}
            title="Exit"
          >
            <BsX style={{ fontSize: "1.3rem" }} />
          </button>
        </div>
      )}

      {/* Wallet Balance Display */}
     

      {/* Participant Audio Controls */}
      {isParticipant && !isHost && (hostMicEnabled || hostCameraEnabled) && (
        <div
          className="audio-controls-container"
          style={{
            position: "fixed",
            top: "0.75rem",
            left: "0.5rem",
            right: "auto",
            maxWidth: "calc(100% - 120px)", // Leave space for wallet display
            background: "rgba(15, 22, 36, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "0.75rem",
            padding: "0.5rem 0.75rem",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            minWidth: "160px",
          }}
        >
          <button
            onClick={webrtc.toggleAudio}
            style={{
              background: webrtc.audioEnabled ? "rgba(0, 245, 255, 0.2)" : "rgba(255, 107, 122, 0.2)",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: webrtc.audioEnabled ? "var(--accent-secondary)" : "#ff6b7a",
              transition: "all 0.2s",
            }}
            title={webrtc.audioEnabled ? "Mute audio" : "Unmute audio"}
          >
            {webrtc.audioEnabled ? <BsVolumeUp style={{ fontSize: "1rem" }} /> : <BsVolumeMute style={{ fontSize: "1rem" }} />}
          </button>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={webrtc.audioVolume}
              onChange={(e) => webrtc.setVolume(parseFloat(e.target.value))}
              style={{
                flex: 1,
                height: "4px",
                background: "rgba(255, 255, 255, 0.2)",
                borderRadius: "2px",
                outline: "none",
                cursor: "pointer",
              }}
              title="Volume"
            />
            <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", minWidth: "35px" }}>
              {Math.round(webrtc.audioVolume * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Participant Menu Modal */}
      <Modal
        show={showParticipantMenu !== null}
        onHide={() => setShowParticipantMenu(null)}
        centered
        contentClassName="glass-card border-0"
        className="p-5"
      >
        <Modal.Header
          closeButton
          style={{
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Title style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
            Participant Options
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ color: "var(--text-primary)", padding: "0" }}>
          <ListGroup variant="flush">
            {(() => {
              const relationship = participantRelationship || {};
              const isFriend = relationship.isFriend || relationship.isFollowing || false;
              const participant = participants.find((p) => p.userId?.toString() === showParticipantMenu);
              
              return (
                <>
                  {/* Follow option - only show if not a friend */}
                  {!isFriend && (
                    <ListGroup.Item
                      className="d-flex align-items-center gap-2"
                      style={{
                        background: "transparent",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                      }}
                      onClick={() => handleFollowParticipant(showParticipantMenu)}
                    >
                      <BsPersonCheck style={{ color: "var(--accent-secondary)", fontSize: "1rem" }} />
                      <span>Follow</span>
                    </ListGroup.Item>
                  )}

                  {/* Send Gift - only show if friend */}
                  {isFriend && (
                    <ListGroup.Item
                      className="d-flex align-items-center gap-2"
                      style={{
                        background: "transparent",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                      }}
                      onClick={() => handleSendGiftToParticipant(showParticipantMenu)}
                    >
                      <BsGift style={{ color: "var(--accent)", fontSize: "1rem" }} />
                      <span>Send Gift</span>
                    </ListGroup.Item>
                  )}

                  {/* Report User - only show if friend */}
                  {isFriend && (
                    <ListGroup.Item
                      className="d-flex align-items-center gap-2"
                      style={{
                        background: "transparent",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        cursor: "pointer",
                        color: "#ff6b7a",
                      }}
                      onClick={() => handleReportUser(showParticipantMenu)}
                    >
                      <BsX style={{ fontSize: "1rem" }} />
                      <span>Report User</span>
                    </ListGroup.Item>
                  )}

                  {/* Host-only options */}
                  {isHost && (
                    <>
                      <ListGroup.Item
                        className="d-flex align-items-center gap-2"
                        style={{
                          background: "transparent",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          cursor: "pointer",
                          color: "var(--text-primary)",
                        }}
                        onClick={() => {
                          if (participant) {
                            handleTransferHost(participant.userId?.toString());
                          }
                        }}
                      >
                        <BsPersonCheck style={{ color: "var(--accent-tertiary)", fontSize: "1rem" }} />
                        <span>Transfer Host</span>
                      </ListGroup.Item>
                      <ListGroup.Item
                        className="d-flex align-items-center gap-2"
                        style={{
                          background: "transparent",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          cursor: "pointer",
                          color: "var(--text-primary)",
                        }}
                        onClick={() => {
                          handleMuteUser(showParticipantMenu);
                        }}
                      >
                        {participant?.status === "muted" ? (
                          <>
                            <BsMic style={{ color: "var(--accent-secondary)", fontSize: "1rem" }} />
                            <span>Unmute</span>
                          </>
                        ) : (
                          <>
                            <BsMicMute style={{ color: "var(--accent-tertiary)", fontSize: "1rem" }} />
                            <span>Mute</span>
                          </>
                        )}
                      </ListGroup.Item>
                      <ListGroup.Item
                        className="d-flex align-items-center gap-2"
                        style={{
                          background: "transparent",
                          cursor: "pointer",
                          color: "#ff6b7a",
                        }}
                        onClick={() => {
                          handleRemoveUser(showParticipantMenu);
                        }}
                      >
                        <BsPersonX style={{ fontSize: "1rem" }} />
                        <span>Remove</span>
                      </ListGroup.Item>
                    </>
                  )}
                </>
              );
            })()}
          </ListGroup>
        </Modal.Body>
      </Modal>

      {/* Gift Selector Modal for Individual User */}
      {showGiftSelector && giftRecipientId && (
        <Modal
          show={showGiftSelector}
          onHide={() => {
            setShowGiftSelector(false);
            setGiftRecipientId(null);
          }}
          centered
          contentClassName="glass-card border-0"
          size="lg"
        >
          <Modal.Header
            closeButton
            style={{
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              color: "var(--text-primary)",
            }}
          >
            <Modal.Title style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
              Send Gift
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <GiftSelector
              show={true}
              onHide={() => {
                setShowGiftSelector(false);
                setGiftRecipientId(null);
              }}
              wallet={wallet}
              friendId={giftRecipientId}
              onGiftSent={() => {
                loadWallet();
                setShowGiftSelector(false);
                setGiftRecipientId(null);
              }}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Transfer Host Modal */}
      <Modal
        show={showTransferModal}
        onHide={() => setShowTransferModal(false)}
        centered
        contentClassName="glass-card border-0"
      >
        <Modal.Header
          closeButton
          style={{
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            color: "var(--text-primary)",
          }}
        >
          <Modal.Title style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
            Transfer Host
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ color: "var(--text-primary)", padding: "0" }}>
          <ListGroup variant="flush">
            {otherParticipantsForTransfer.map((participant, idx) => (
              <ListGroup.Item
                key={idx}
                className="d-flex justify-content-between align-items-center p-3"
                style={{
                  background: "transparent",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  cursor: "pointer",
                }}
                onClick={() => handleTransferHost(participant.userId?.toString())}
              >
                <div className="d-flex align-items-center gap-2">
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: participant.avatarUrl && getImageUrl(participant.avatarUrl)
                        ? `url(${getImageUrl(participant.avatarUrl)}) center/cover`
                        : "rgba(255, 45, 149, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "0.9rem",
                    }}
                  >
                    {(!participant.avatarUrl || !getImageUrl(participant.avatarUrl)) && getInitials(participant.username || "?")}
                  </div>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{participant.username}</span>
                </div>
                <Button variant="primary" size="sm" style={{ fontSize: "0.8rem", padding: "0.25rem 0.75rem" }}>
                  <BsPersonCheck style={{ marginRight: "0.25rem" }} />
                  Transfer
                </Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Modal.Body>
      </Modal>
    </div>
  );
}
