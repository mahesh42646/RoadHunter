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
import useAuthStore, { selectIsAuthenticated } from "@/store/useAuthStore";
import usePartySocket from "@/hooks/usePartySocket";
import useWebRTC from "@/hooks/useWebRTC";
import GiftSelector from "../components/GiftSelector";
import PredictionRaceGame from "../components/PredictionRaceGame";

export default function PartyRoomPage() {
  const router = useRouter();
  const params = useParams();
  const partyId = params.id;
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [party, setParty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showParticipantMenu, setShowParticipantMenu] = useState(null);
  const [activeBottomNav, setActiveBottomNav] = useState("chat");
  const [wallet, setWallet] = useState(null);
  const [giftAnimations, setGiftAnimations] = useState([]);
  const chatEndRef = useRef(null);
  const handleLeaveRef = useRef(null);
  const [hostMicEnabled, setHostMicEnabled] = useState(false);
  const [hostCameraEnabled, setHostCameraEnabled] = useState(false);

  const currentParticipant = party?.participants?.find(
    (p) => p.userId?.toString() === user?._id?.toString()
  );
  const isHost = party && user && party.hostId?.toString() === user._id?.toString();
  const isParticipant = !!currentParticipant && (currentParticipant.status === "active" || currentParticipant.status === "muted");
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

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/user/login");
      return;
    }
    loadParty();
    loadWallet();
    
    // Add body class to prevent scroll
    document.body.classList.add("party-page");
    return () => {
      document.body.classList.remove("party-page");
    };
  }, [isAuthenticated, router, partyId]);

  const loadWallet = async () => {
    try {
      const response = await apiClient.get("/wallet/balance");
      setWallet(response.data);
    } catch (error) {
      console.error("Failed to load wallet", error);
    }
  };

  // Exit confirmation on page unload/refresh/route change
  useEffect(() => {
    if (!isParticipant) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "Are you sure you want to exit the party room?";
      return e.returnValue;
    };

    const handlePopState = async (e) => {
      if (isParticipant) {
        const confirmed = confirm("Are you sure you want to exit the party room? You will leave the room.");
        if (confirmed) {
          try {
            await apiClient.post(`/parties/${partyId}/leave`);
            router.push("/party");
          } catch (error) {
            console.error("Failed to leave party", error);
          }
        } else {
          window.history.pushState(null, "", window.location.pathname);
        }
      }
    };

    // Block route changes - handled by Next.js router events

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isParticipant, partyId, router]);

  const loadParty = async () => {
    try {
      const response = await apiClient.get(`/parties/${partyId}`);
      const partyData = response.data.party;
      
      if (!partyData.isActive) {
        router.replace("/party");
        return;
      }

      setParty(partyData);
      
      // Check if user is already a participant
      const wasParticipant = partyData.participants?.some(
        (p) => p.userId?.toString() === user?._id?.toString()
      );
      
      // If user was a participant but not in current list, rejoin automatically
      if (wasParticipant && !partyData.participants?.find(
        (p) => p.userId?.toString() === user?._id?.toString() && p.status === "active"
      )) {
        try {
          const joinResponse = await apiClient.post(`/parties/${partyId}/join`);
          if (joinResponse.data.party) {
            setParty(joinResponse.data.party);
          }
        } catch (joinError) {
          console.error("Failed to rejoin party", joinError);
        }
      }

    } catch (error) {
      console.error("Failed to load party", error);
      // Only redirect if it's a 404 or party doesn't exist
      if (error.response?.status === 404) {
        router.replace("/party");
      }
    } finally {
      setLoading(false);
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
      }
    } catch (error) {
      alert(error.response?.data?.error || "Failed to join party");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (isHost && party.participants.length > 1) {
      const action = confirm(
        "You are the host. You must transfer host or end party before leaving.\n\nClick OK to end party, or Cancel to transfer host."
      );
      if (action) {
        await handleEndParty();
      } else {
        setShowTransferModal(true);
      }
      return;
    }

    try {
      await apiClient.post(`/parties/${partyId}/leave`);
      router.push("/party");
    } catch (error) {
      if (error.response?.data?.requiresAction) {
        const action = confirm(
          "You are the host. You must transfer host or end party before leaving.\n\nClick OK to end party, or Cancel to transfer host."
        );
        if (action) {
          await handleEndParty();
        } else {
          setShowTransferModal(true);
        }
      } else {
        alert(error.response?.data?.error || "Failed to leave party");
      }
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

  const handleEndParty = async () => {
    if (!confirm("Are you sure you want to end this party?")) return;
    
    try {
      await apiClient.delete(`/parties/${partyId}`);
      router.push("/party");
    } catch (error) {
      alert(error.response?.data?.error || "Failed to end party");
    }
  };

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
        router.push("/party");
      }
    },
    onChatMessage: (data) => {
      setParty((prev) => ({
        ...prev,
        chatMessages: [...(prev.chatMessages || []), data.message],
      }));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onPartyEnded: () => {
      router.push("/party");
    },
    onHostTransferred: (data) => {
      loadParty();
    },
    onParticipantRemoved: (data) => {
      if (data.userId === user?._id?.toString()) {
        router.push("/party");
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
        className="glass-card"
        style={{
          flex: "0 0 40%",
          margin: "0.5rem",
          padding: "0.75rem",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div className="d-flex justify-content-between align-items-start mb-2" style={{ gap: "0.5rem" }}>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
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
                {party.privacy === "public" ? "Public" : "Private"}
              </Badge>
              <div className="d-flex align-items-center gap-1" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                <BsPeople style={{ fontSize: "0.75rem" }} />
                <span>{participants.length}/50</span>
              </div>
            </div>
          </div>
          <div className="d-flex gap-1 flex-shrink-0 align-items-center">
            {!isParticipant && (
              <Button variant="primary" size="sm" onClick={handleJoin} disabled={joining} style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>
                {joining ? "..." : "Join"}
              </Button>
            )}
            {isParticipant && (
              <>
                {isHost && (
                  <>
                    <Button
                      variant={hostMicEnabled ? "success" : "outline-secondary"}
                      size="sm"
                      onClick={handleToggleMic}
                      style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem", minWidth: "36px" }}
                      title={hostMicEnabled ? "Turn off microphone" : "Turn on microphone"}
                    >
                      {hostMicEnabled ? <BsMic /> : <BsMicMute />}
                    </Button>
                    <Button
                      variant={hostCameraEnabled ? "success" : "outline-secondary"}
                      size="sm"
                      onClick={handleToggleCamera}
                      style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem", minWidth: "36px" }}
                      title={hostCameraEnabled ? "Turn off camera" : "Turn on camera"}
                    >
                      {hostCameraEnabled ? <BsCameraVideo /> : <BsCameraVideoOff />}
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={handleEndParty} style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}>
                      End
                    </Button>
                  </>
                )}
                <Button variant="outline-light" size="sm" onClick={handleLeave} style={{ padding: "0.25rem 0.5rem", minWidth: "36px" }} title="Leave Party">
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
          className="participants-grid-responsive"
          style={{
            flex: 1,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)", // Mobile: 5 cards per row
            gap: "0.5rem",
            padding: "0.5rem",
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
                className="glass-card participant-card"
                style={{
                  position: "relative",
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  cursor: isHost && !isCurrentUser ? "pointer" : "default",
                  border: isParticipantHost
                    ? "2px solid var(--accent)"
                    : "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: isParticipantHost 
                    ? "0 4px 12px rgba(255, 45, 149, 0.3)" 
                    : "0 2px 8px rgba(0, 0, 0, 0.2)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                }}
                onClick={() => {
                  if (isHost && !isCurrentUser) {
                    setShowParticipantMenu(participant.userId?.toString());
                  }
                }}
                onMouseEnter={(e) => {
                  if (isHost && !isCurrentUser) {
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
                }}
              >
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
                        background: "rgba(255, 45, 149, 0.9)",
                        color: "white",
                        border: "none",
                        fontSize: "clamp(0.5rem, 1.2vw, 0.6rem)",
                        padding: "clamp(0.15rem, 0.5vw, 0.2rem) clamp(0.3rem, 0.8vw, 0.4rem)",
                        display: "flex",
                        alignItems: "center",
                        gap: "clamp(0.15rem, 0.5vw, 0.25rem)",
                        fontWeight: "bold",
                        boxShadow: "0 2px 6px rgba(255, 45, 149, 0.4)",
                      }}
                    >
                      <BsStarFill style={{ fontSize: "clamp(0.5rem, 1.2vw, 0.65rem)" }} />
                      <span className="host-badge-text">HOST</span>
                    </Badge>
                  </div>
                )}

                {/* Avatar/Video Container */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                    marginBottom: "0.5rem",
                    border: isParticipantHost
                      ? "2px solid var(--accent)"
                      : "1px solid rgba(255, 255, 255, 0.2)",
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
                        <video
                          ref={webrtc.localVideoRef}
                          autoPlay
                          playsInline
                          muted={true}
                          preload="none"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        // Participants see host's remote video
                        <video
                          ref={webrtc.remoteVideoRef}
                          autoPlay
                          playsInline
                          muted={!webrtc.audioEnabled}
                          preload="none"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onLoadedMetadata={(e) => {
                            const video = e.target;
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
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                    background: participant.avatarUrl
                      ? `url(${participant.avatarUrl}) center/cover`
                      : "rgba(255, 45, 149, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: "bold",
                            fontSize: "2rem",
                  }}
                >
                  {!participant.avatarUrl && (participant.username?.[0]?.toUpperCase() || "?")}
                </div>
                      )}
                    </>
                  ) : (
                    // Regular participant avatar
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background: participant.avatarUrl
                          ? `url(${participant.avatarUrl}) center/cover`
                          : "rgba(255, 45, 149, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "2rem",
                      }}
                    >
                      {!participant.avatarUrl && (participant.username?.[0]?.toUpperCase() || "?")}
                    </div>
                  )}
                </div>

                {/* Participant Name */}
                <p
                  className="mb-1 fw-bold text-truncate participant-name"
                  style={{ 
                    color: "var(--text-primary)", 
                    fontSize: "clamp(0.65rem, 2vw, 0.85rem)", 
                    lineHeight: "1.2",
                    marginBottom: "0.2rem",
                    marginTop: "auto",
                  }}
                  title={participant.username}
                >
                  {participant.username}
                </p>

                {/* Balance - Only show for current user */}
                {participantWallet !== null && (
                  <div 
                    className="d-flex align-items-center justify-content-center gap-1 participant-balance"
                      style={{
                      marginBottom: "0.2rem",
                      color: "var(--text-secondary)",
                      fontSize: "clamp(0.6rem, 1.5vw, 0.75rem)",
                    }}
                  >
                    <BsCoin style={{ fontSize: "clamp(0.6rem, 1.5vw, 0.8rem)", color: "var(--accent-secondary)" }} />
                    <span>{participantWallet.toLocaleString()}</span>
                  </div>
                )}

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
          flex: "0 0 60%",
          margin: "0.1rem",
          padding: "0.1rem",
          paddingBottom: "10px",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          minHeight: 0,
        }}
      >
        
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            marginBottom: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            paddingBottom: "10px",
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
                    borderRadius: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                      background: msg.avatarUrl
                        ? `url(${msg.avatarUrl}) center/cover`
                        : "rgba(255, 45, 149, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "0.7rem",
                    }}
                    
                  >
                    {!msg.avatarUrl && (msg.username?.[0]?.toUpperCase() || "?")}
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
            <div style={{ paddingBottom: "10px", position: "relative", zIndex: 1 }}>
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
                onHide={() => setActiveBottomNav("chat")}
                partyId={partyId}
                wallet={wallet}
                onGiftSent={() => {
                  loadWallet();
                  setActiveBottomNav("chat");
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
                onClose={() => setActiveBottomNav("chat")}
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
      {isParticipant && wallet && (
        <div
          style={{
            position: "fixed",
            top: "0.75rem",
            right: "0.75rem",
            background: "rgba(15, 22, 36, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "0.75rem",
            padding: "0.4rem 0.75rem",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          }}
        >
          <BsCoin style={{ color: "#FFD700", fontSize: "1rem" }} />
          <span style={{ color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: "bold" }}>
            {wallet.partyCoins?.toLocaleString() || 0}
          </span>
        </div>
      )}

      {/* Participant Audio Controls */}
      {isParticipant && !isHost && hostMicEnabled && (
        <div
          style={{
            position: "fixed",
            top: "0.75rem",
            left: "0.75rem",
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
            minWidth: "200px",
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
            <ListGroup.Item
              className="d-flex align-items-center gap-2"
              style={{
                background: "transparent",
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                cursor: "pointer",
                color: "var(--text-primary)",
              }}
              onClick={() => {
                const participant = participants.find((p) => p.userId?.toString() === showParticipantMenu);
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
              {participants.find((p) => p.userId?.toString() === showParticipantMenu)?.status === "muted" ? (
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
          </ListGroup>
        </Modal.Body>
      </Modal>

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
                      background: participant.avatarUrl
                        ? `url(${participant.avatarUrl}) center/cover`
                        : "rgba(255, 45, 149, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "0.9rem",
                    }}
                  >
                    {!participant.avatarUrl && (participant.username?.[0]?.toUpperCase() || "?")}
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
