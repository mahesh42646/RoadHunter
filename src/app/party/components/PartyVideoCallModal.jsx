"use client";

import { useEffect, useRef, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { BsCameraVideo, BsCameraVideoOff, BsMic, BsMicMute, BsX, BsTelephone } from "react-icons/bs";
import { getImageUrl, getInitials } from "@/lib/imageUtils";
import Peer from "simple-peer";

export default function PartyVideoCallModal({
  show,
  onClose,
  otherUser,
  isCaller,
  socket,
  partyId,
  userId,
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callStatus, setCallStatus] = useState(isCaller ? "calling" : "ringing");
  const [error, setError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize peer connection for caller immediately
  useEffect(() => {
    if (!show || !socket || !otherUser || !isCaller) return;

    const initializeCall = async () => {
      try {
        // Get user media with optimized settings
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: "user",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 2,
          },
        });
        
        streamRef.current = stream;
        setLocalStream(stream);

        // Set local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection with optimized settings
        const peer = new Peer({
          initiator: isCaller,
          trickle: false,
          stream: stream,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });

        peer.on("signal", (signal) => {
          // Send signal to other user via socket
          const targetUserId = otherUser._id || otherUser.userId;
          socket.emit("party:call:signal", {
            partyId,
            toUserId: targetUserId,
            signal: JSON.stringify(signal),
          });
        });

        peer.on("stream", (remoteStream) => {
          console.log("[Call] Received remote stream");
          setRemoteStream(remoteStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
          // Only update status if we're in calling/ringing state
          if (callStatus === "ringing" || callStatus === "calling") {
            setCallStatus("connected");
          }
        });

        peer.on("error", (err) => {
          console.error("[Call] Peer error:", err);
          setError(err.message || "Connection error");
          // Don't auto-end on error, let user decide
        });

        peer.on("close", () => {
          console.log("[Call] Peer connection closed");
          // Only end if not already ended
          if (callStatus !== "ended") {
            endCall();
          }
        });

        peer.on("connect", () => {
          console.log("[Call] Peer connected");
        });

        peerRef.current = peer;

        // If caller, set status to calling
        if (isCaller) {
          setCallStatus("calling");
        }
      } catch (err) {
        console.error("[Call] Error initializing call:", err);
        setError(err.message || "Failed to access camera/microphone");
        // Don't auto-close on error
      }
    };

    initializeCall();

    // Listen for incoming signals
    const handleSignal = (data) => {
      const otherUserId = otherUser._id || otherUser.userId;
      const currentUserId = userId;
      
      // Only process signals meant for us (from the other user)
      if (data.fromUserId === otherUserId && data.toUserId === currentUserId && peerRef.current) {
        try {
          const signal = JSON.parse(data.signal);
          peerRef.current.signal(signal);
        } catch (err) {
          console.error("Error parsing signal:", err);
        }
      }
    };

    // Listen for call accepted
    const handleCallAccepted = (data) => {
      if (data.fromUserId === (otherUser._id || otherUser.userId)) {
        setCallStatus("connected");
      }
    };

    // Listen for call rejected
    const handleCallRejected = (data) => {
      if (data.fromUserId === (otherUser._id || otherUser.userId)) {
        setError("Call rejected");
        setTimeout(() => {
          endCall();
          onClose();
        }, 2000);
      }
    };

    // Listen for call ended
    const handleCallEnded = (data) => {
      const otherUserId = otherUser._id || otherUser.userId;
      const currentUserId = userId;
      
      // If the other user ended the call
      if (data.fromUserId === otherUserId || (data.toUserId === currentUserId && data.fromUserId === otherUserId)) {
        console.log("[Call] Other user ended the call");
        setError("Call ended by other user");
        setTimeout(() => {
          endCall();
          onClose();
        }, 1000);
      }
    };

    socket.on("party:call:signal", handleSignal);
    socket.on("party:call:accepted", handleCallAccepted);
    socket.on("party:call:rejected", handleCallRejected);
    socket.on("party:call:ended", handleCallEnded);

    return () => {
      socket.off("party:call:signal", handleSignal);
      socket.off("party:call:accepted", handleCallAccepted);
      socket.off("party:call:rejected", handleCallRejected);
      socket.off("party:call:ended", handleCallEnded);
      
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      }
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (err) {
          console.error("[Call] Error destroying peer on unmount:", err);
        }
        peerRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, [show, socket, otherUser, isCaller, partyId, callStatus, userId]);

  const endCall = () => {
    console.log("[Call] Ending call, cleaning up...");
    
    // Stop all local media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
        console.log("[Call] Stopped track:", track.kind);
      });
      streamRef.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Destroy peer connection
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (err) {
        console.error("[Call] Error destroying peer:", err);
      }
      peerRef.current = null;
    }

    // Notify other user
    if (socket && otherUser && callStatus !== "ended") {
      socket.emit("party:call:end", {
        partyId,
        toUserId: otherUser._id || otherUser.userId,
      });
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("ended");
    setError(null);
  };

  const handleClose = () => {
    console.log("[Call] Modal closed by user");
    endCall();
    // Small delay to ensure cleanup completes
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !isMicEnabled;
      });
      setIsMicEnabled(!isMicEnabled);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const acceptCall = () => {
    console.log("[Call] Accepting call...");
    setCallStatus("connected");
    
    if (socket && otherUser) {
      socket.emit("party:call:accept", {
        partyId,
        toUserId: otherUser._id || otherUser.userId,
      });
    }
    // Peer connection will be initialized by the useEffect when callStatus becomes "connected"
  };

  const rejectCall = () => {
    if (socket && otherUser) {
      socket.emit("party:call:reject", {
        partyId,
        toUserId: otherUser._id || otherUser.userId,
      });
    }
    endCall();
    onClose();
  };

  const otherUserName = otherUser?.account?.displayName || otherUser?.username || "User";
  const otherUserAvatar = otherUser?.account?.photoUrl || otherUser?.avatarUrl;

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      backdrop="static"
      keyboard={false}
      size="lg"
      contentClassName="bg-dark border-secondary"
    >
      <Modal.Header className="bg-dark border-secondary">
        <Modal.Title className="text-white d-flex align-items-center gap-2">
          <BsTelephone className="text-success" />
          {callStatus === "ringing" && !isCaller && "Incoming Call"}
          {callStatus === "calling" && isCaller && "Calling..."}
          {callStatus === "connected" && "Video Call"}
          {callStatus === "ended" && "Call Ended"}
        </Modal.Title>
        <Button variant="link" onClick={handleClose} className="text-white ms-auto p-0">
          <BsX size={24} />
        </Button>
      </Modal.Header>
      <Modal.Body className="bg-dark text-white p-0">
        <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "#000" }}>
          {/* Remote video */}
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            >
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  background: otherUserAvatar && getImageUrl(otherUserAvatar)
                    ? `url(${getImageUrl(otherUserAvatar)}) center/cover`
                    : "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "3rem",
                  color: "white",
                  fontWeight: "bold",
                  marginBottom: "1rem",
                }}
              >
                {(!otherUserAvatar || !getImageUrl(otherUserAvatar)) && getInitials(otherUserName)}
              </div>
              <h4 className="text-white mb-0">{otherUserName}</h4>
              {callStatus === "ringing" && !isCaller && (
                <p className="text-white-50 mt-2">Incoming video call...</p>
              )}
              {callStatus === "calling" && isCaller && (
                <p className="text-white-50 mt-2">Calling...</p>
              )}
            </div>
          )}

          {/* Local video (picture-in-picture) */}
          {localStream && (
            <div
              style={{
                position: "absolute",
                bottom: "80px",
                right: "20px",
                width: "150px",
                height: "100px",
                borderRadius: "8px",
                overflow: "hidden",
                border: "2px solid white",
                background: "#000",
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(255, 0, 0, 0.8)",
                color: "white",
                padding: "10px 20px",
                borderRadius: "8px",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Controls */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(0, 0, 0, 0.8)",
            padding: "20px",
            display: "flex",
            justifyContent: "center",
            gap: "15px",
            alignItems: "center",
          }}
        >
          {callStatus === "ringing" && !isCaller ? (
            <>
              <Button
                variant="danger"
                size="lg"
                onClick={rejectCall}
                style={{ borderRadius: "50%", width: "60px", height: "60px" }}
              >
                <BsX size={24} />
              </Button>
              <Button
                variant="success"
                size="lg"
                onClick={acceptCall}
                style={{ borderRadius: "50%", width: "60px", height: "60px" }}
              >
                <BsTelephone size={24} />
              </Button>
            </>
          ) : callStatus === "connected" ? (
            <>
              <Button
                variant={isMicEnabled ? "secondary" : "danger"}
                size="lg"
                onClick={toggleMic}
                style={{ borderRadius: "50%", width: "60px", height: "60px" }}
              >
                {isMicEnabled ? <BsMic size={24} /> : <BsMicMute size={24} />}
              </Button>
              <Button
                variant={isVideoEnabled ? "secondary" : "danger"}
                size="lg"
                onClick={toggleVideo}
                style={{ borderRadius: "50%", width: "60px", height: "60px" }}
              >
                {isVideoEnabled ? <BsCameraVideo size={24} /> : <BsCameraVideoOff size={24} />}
              </Button>
              <Button
                variant="danger"
                size="lg"
                onClick={handleClose}
                style={{ borderRadius: "50%", width: "60px", height: "60px" }}
              >
                <BsX size={24} />
              </Button>
            </>
          ) : (
            <Button
              variant="danger"
              size="lg"
              onClick={handleClose}
              style={{ borderRadius: "50%", width: "60px", height: "60px" }}
            >
              <BsX size={24} />
            </Button>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}

