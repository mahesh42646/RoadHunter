"use client";

import { useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { io } from "socket.io-client";
import Peer from "simple-peer";

import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";
import useCallStore from "@/store/useCallStore";
import CallView from "@/components/CallView";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

export default function FriendCallPage() {
  const params = useParams();
  const router = useRouter();
  const friendId = params.friendId;
  const token = useAuthStore((state) => state.token);
  
  const {
    callStatus,
    friend,
    isCaller,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    setCallStatus,
    setFriend,
    setLocalStream,
    setRemoteStream,
    setIsCaller,
    setIsMicEnabled,
    setIsVideoEnabled,
  } = useCallStore();

  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Load friend data and initialize call
  useEffect(() => {
    if (!friendId) return;

    const initializeCall = async () => {
      try {
        const response = await apiClient.get(`/friends/profile/${friendId}`);
        const friendData = response.data.user;
        setFriend(friendData);

        // Connect socket first
        connectSocket();

        // Wait a bit for socket to connect
        await new Promise(resolve => setTimeout(resolve, 100));

        // If call is not already started, initialize it
        if (callStatus === "idle" || callStatus === "ended" || !callStatus) {
          startCall(friendId, friendData, true);
          setCallStatus("calling");
          // Emit call initiation event
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("friend:call:initiate", { friendId });
          } else {
            // Wait for socket to connect
            socketRef.current?.on("connect", () => {
              socketRef.current.emit("friend:call:initiate", { friendId });
            });
          }
          // Start peer connection
          await startPeerConnection(true);
        } else if (callStatus === "ringing") {
          // Call was already received, wait for accept
          // Peer connection will be started when call is accepted
        } else if (callStatus === "connected") {
          // Call is already connected, restore peer connection if needed
          if (!peerRef.current) {
            if (isCaller) {
              await startPeerConnection(true);
            } else {
              await startPeerConnection(false);
            }
          }
        } else if (callStatus === "calling") {
          // Call is in progress, ensure peer connection is started
          if (!peerRef.current) {
            await startPeerConnection(true);
          }
          // Also ensure socket event is emitted
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit("friend:call:initiate", { friendId });
          }
        }
      } catch (error) {
        console.error("Failed to load friend:", error);
        alert("Friend not found");
        router.push("/dashboard/friends");
      }
    };

    initializeCall();

    return () => {
      // Don't cleanup streams here - let CallManager handle it
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
      }
    };
  }, [friendId]);

  // Connect socket for WebRTC signaling
  const connectSocket = () => {
    if (!token) return;
    
    // Reuse existing socket if available
    if (socketRef.current && socketRef.current.connected) {
      return;
    }

    // Disconnect old socket if exists
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("user:join");
    });

    socket.on("friend:call:accepted", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        setCallStatus("connected");
        if (isCaller && !peerRef.current) {
          startPeerConnection(true);
        } else if (!isCaller && !peerRef.current) {
          startPeerConnection(false);
        }
      }
    });

    socket.on("friend:call:rejected", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        endCall();
        alert("Call rejected");
        router.push("/dashboard/friends");
      }
    });

    socket.on("friend:call:ended", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        endCall();
        router.push("/dashboard/friends");
      }
    });

    socket.on("friend:webrtc:signal", (data) => {
      if (data.fromUserId === friendId && peerRef.current) {
        peerRef.current.signal(data.signal);
      }
    });

    socketRef.current = socket;
  };

  // Start peer connection
  const startPeerConnection = async (initiator) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      streamRef.current = stream;
      setLocalStream(stream);

      const peer = new Peer({
        initiator,
        trickle: false,
        stream,
      });

      peer.on("signal", (signal) => {
        socketRef.current?.emit("friend:webrtc:signal", {
          friendId,
          signal,
        });
      });

      peer.on("stream", (remoteStreamData) => {
        setRemoteStream(remoteStreamData);
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
      });

      peerRef.current = peer;
    } catch (error) {
      console.error("Error starting peer connection:", error);
      alert("Failed to access camera/microphone");
      endCall();
      router.push("/dashboard/friends");
    }
  };

  // Handle accept call (if ringing)
  useEffect(() => {
    if (callStatus === "ringing" && !peerRef.current && socketRef.current) {
      const handleAccept = async () => {
        setCallStatus("connected");
        socketRef.current.emit("friend:call:accept", { friendId });
        await startPeerConnection(false);
      };
      handleAccept();
    }
  }, [callStatus, friendId]);

  // Update video refs when streams change
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Streams are managed by CallManager
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, []);

  // Show CallView component which handles the UI
  // CallView is now managed globally by CallManager, so we don't need to render it here
  // Just ensure we're on the right page for navigation purposes
  return null;
}
