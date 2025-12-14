"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";

import useCallStore from "@/store/useCallStore";
import useAuthStore from "@/store/useAuthStore";
import CallNotification from "./CallNotification";
import CallView from "./CallView";
import apiClient from "@/lib/apiClient";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

export default function CallManager() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  
  const {
    callStatus,
    friendId,
    friend,
    isCaller,
    localStream,
    remoteStream,
    isMicEnabled,
    isVideoEnabled,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    setCallStatus,
    setFriend,
    setLocalStream,
    setRemoteStream,
    setIsCaller,
  } = useCallStore();

  // Initialize socket connection
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("user:join");
    });

    // Handle incoming call
    socket.on("friend:call:incoming", async (data) => {
      try {
        console.log("Incoming call from:", data.fromUserId);
        const response = await apiClient.get(`/friends/profile/${data.fromUserId}`);
        const callerFriend = response.data.user;
        
        startCall(data.fromUserId, callerFriend, false);
        setCallStatus("ringing");
      } catch (error) {
        console.error("Failed to load caller info:", error);
      }
    });

    // Handle call accepted
    socket.on("friend:call:accepted", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        setCallStatus("connected");
        // Start peer connection if not already started
        if (!peerRef.current) {
          if (isCaller) {
            startPeerConnection(true);
          } else {
            startPeerConnection(false);
          }
        }
      }
    });

    // Handle call rejected
    socket.on("friend:call:rejected", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        endCall();
        alert("Call rejected");
      }
    });

    // Handle call ended
    socket.on("friend:call:ended", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        endCall();
      }
    });

    // Handle WebRTC signaling
    socket.on("friend:webrtc:signal", (data) => {
      if (data.fromUserId === friendId && peerRef.current) {
        peerRef.current.signal(data.signal);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token, friendId, isCaller]);

  // Restore call state on mount and reconnect peer if needed
  useEffect(() => {
    if (callStatus === "connected" || callStatus === "calling" || callStatus === "ringing") {
      if (friendId && !friend) {
        // Restore friend data
        apiClient.get(`/friends/profile/${friendId}`)
          .then((response) => {
            setFriend(response.data.user);
          })
          .catch(console.error);
      }
      
      // If call is connected but no peer connection, restore it
      if (callStatus === "connected" && !peerRef.current && friendId) {
        if (isCaller) {
          startPeerConnection(true);
        } else {
          startPeerConnection(false);
        }
      }
    }
  }, [callStatus, friendId, friend, isCaller]);

  const startPeerConnection = async (initiator) => {
    try {
      // Don't start if peer already exists
      if (peerRef.current) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled !== false,
        audio: isMicEnabled !== false,
      });
      
      streamRef.current = stream;
      setLocalStream(stream);

      const Peer = (await import("simple-peer")).default;
      const peer = new Peer({
        initiator,
        trickle: false,
        stream,
      });

      peer.on("signal", (signal) => {
        if (socketRef.current && friendId) {
          socketRef.current.emit("friend:webrtc:signal", {
            friendId,
            signal,
          });
        }
      });

      peer.on("stream", (remoteStreamData) => {
        setRemoteStream(remoteStreamData);
      });

      peer.on("error", (err) => {
        console.error("Peer error:", err);
      });

      peer.on("close", () => {
        console.log("Peer connection closed");
        peerRef.current = null;
      });

      peerRef.current = peer;
    } catch (error) {
      console.error("Error starting peer connection:", error);
      alert("Failed to access camera/microphone");
      endCall();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  return (
    <>
      <CallNotification />
      {(callStatus === "connected" || callStatus === "calling" || callStatus === "ringing") && <CallView />}
    </>
  );
}
