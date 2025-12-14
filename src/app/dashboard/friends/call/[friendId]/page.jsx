"use client";

import { useEffect, useState, useRef } from "react";
import { Button, Card } from "react-bootstrap";
import { FaPhone, FaPhoneSlash, FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { useRouter, useParams } from "next/navigation";
import { io } from "socket.io-client";
import Peer from "simple-peer";

import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";
import { getImageUrl } from "@/lib/imageUtils";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

export default function FriendCallPage() {
  const params = useParams();
  const router = useRouter();
  const friendId = params.friendId;
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  const [friend, setFriend] = useState(null);
  const [callStatus, setCallStatus] = useState("idle"); // idle, calling, ringing, connected, ended
  const [isCaller, setIsCaller] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadFriend();
    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [friendId]);

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

  const connectSocket = () => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("user:join");
    });

    socket.on("friend:call:incoming", (data) => {
      if (data.fromUserId === friendId) {
        setCallStatus("ringing");
        setIsCaller(false);
      }
    });

    socket.on("friend:call:accepted", (data) => {
      if (data.fromUserId === friendId) {
        setCallStatus("connected");
        if (isCaller) {
          startPeer(true);
        }
      }
    });

    socket.on("friend:call:rejected", (data) => {
      if (data.fromUserId === friendId) {
        setCallStatus("ended");
        alert("Call rejected");
        endCall();
      }
    });

    socket.on("friend:call:ended", (data) => {
      if (data.fromUserId === friendId || data.friendId === friendId) {
        setCallStatus("ended");
        endCall();
      }
    });

    socket.on("friend:webrtc:signal", (data) => {
      if (data.fromUserId === friendId && peerRef.current) {
        peerRef.current.signal(data.signal);
      }
    });

    socketRef.current = socket;
  };

  const loadFriend = async () => {
    try {
      const response = await apiClient.get(`/friends/profile/${friendId}`);
      setFriend(response.data.user);
    } catch (error) {
      console.error("Failed to load friend:", error);
      alert("Friend not found");
      router.push("/dashboard/friends");
    }
  };

  const getMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled,
        audio: isMicEnabled,
      });
      streamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accessing media:", error);
      alert("Failed to access camera/microphone");
      return null;
    }
  };

  const startPeer = async (initiator) => {
    const stream = await getMediaStream();
    if (!stream) return;

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
  };

  const initiateCall = async () => {
    setCallStatus("calling");
    setIsCaller(true);
    socketRef.current?.emit("friend:call:initiate", { friendId });
    await startPeer(true);
  };

  const acceptCall = async () => {
    setCallStatus("connected");
    socketRef.current?.emit("friend:call:accept", { friendId });
    await startPeer(false);
  };

  const rejectCall = () => {
    socketRef.current?.emit("friend:call:reject", { friendId });
    setCallStatus("ended");
    endCall();
  };

  const endCall = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    socketRef.current?.emit("friend:call:end", { friendId });
    setCallStatus("idle");
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMicEnabled(!isMicEnabled);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  if (!friend) {
    return <div className="text-light">Loading...</div>;
  }

  return (
    <div className="text-light">
      <div className="mb-4">
        <h2 className="fw-bold">Video Call with {friend.account?.displayName || friend.account?.email}</h2>
      </div>

      <Card className="bg-transparent border-light">
        <Card.Body>
          <div className="position-relative" style={{ minHeight: "400px", backgroundColor: "#000" }}>
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-100 h-100"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div className="d-flex align-items-center justify-content-center h-100">
                <div className="text-center">
                  <img
                    src={getImageUrl(friend.account?.photoUrl) || "/default-avatar.png"}
                    alt={friend.account?.displayName}
                    className="rounded-circle mb-3"
                    style={{ width: "150px", height: "150px", objectFit: "cover" }}
                  />
                  <div className="h4">{friend.account?.displayName || friend.account?.email}</div>
                  {callStatus === "ringing" && <div className="text-muted">Incoming call...</div>}
                  {callStatus === "calling" && <div className="text-muted">Calling...</div>}
                </div>
              </div>
            )}

            {localStream && (
              <div
                className="position-absolute"
                style={{ bottom: "20px", right: "20px", width: "200px", height: "150px" }}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-100 h-100 rounded"
                  style={{ objectFit: "cover" }}
                />
              </div>
            )}
          </div>

          <div className="d-flex justify-content-center gap-3 mt-4">
            {callStatus === "idle" && (
              <Button variant="success" size="lg" onClick={initiateCall}>
                <FaPhone /> Start Call
              </Button>
            )}

            {callStatus === "ringing" && (
              <>
                <Button variant="success" size="lg" onClick={acceptCall}>
                  <FaPhone /> Accept
                </Button>
                <Button variant="danger" size="lg" onClick={rejectCall}>
                  <FaPhoneSlash /> Reject
                </Button>
              </>
            )}

            {callStatus === "connected" && (
              <>
                <Button variant={isMicEnabled ? "primary" : "secondary"} onClick={toggleMic}>
                  {isMicEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
                </Button>
                <Button variant={isVideoEnabled ? "primary" : "secondary"} onClick={toggleVideo}>
                  {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
                </Button>
                <Button variant="danger" size="lg" onClick={endCall}>
                  <FaPhoneSlash /> End Call
                </Button>
              </>
            )}

            {callStatus === "calling" && (
              <Button variant="danger" size="lg" onClick={endCall}>
                <FaPhoneSlash /> Cancel
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

