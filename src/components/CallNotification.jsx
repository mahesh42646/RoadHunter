"use client";

import { useEffect, useState, useRef } from "react";
import { Button, Card } from "react-bootstrap";
import { FaPhone, FaPhoneSlash, FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash } from "react-icons/fa";
import { useRouter } from "next/navigation";

import useCallStore from "@/store/useCallStore";
import Avatar from "@/components/Avatar";

export default function CallNotification() {
  const router = useRouter();
  const { 
    callStatus, 
    friend, 
    friendId, 
    acceptCall, 
    rejectCall, 
    isMicEnabled,
    isVideoEnabled,
    setIsMicEnabled,
    setIsVideoEnabled,
  } = useCallStore();
  const [isVisible, setIsVisible] = useState(false);
  const [audio, setAudio] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const pipRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 350 : 0, y: 20 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    console.log("[CallNotification] Status check - callStatus:", callStatus, "friend:", friend ? friend.account?.displayName : "null");
    
    if (callStatus === 'ringing' && friend) {
      console.log("[CallNotification] Showing notification for:", friend.account?.displayName);
      setIsVisible(true);
      // Play ringtone
      try {
        const ringtone = new Audio('/ringtone.mp3');
        ringtone.loop = true;
        ringtone.play().catch((err) => {
          console.error("[CallNotification] Failed to play ringtone:", err);
        });
        setAudio(ringtone);
      } catch (error) {
        console.error("[CallNotification] Error creating ringtone:", error);
      }
    } else {
      setIsVisible(false);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        setAudio(null);
      }
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [callStatus, friend]);

  // Handle dragging
  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return; // Don't drag when clicking buttons
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 320, newX)),
        y: Math.max(0, Math.min(window.innerHeight - 400, newY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position]);

  // Debug logging
  useEffect(() => {
    console.log("[CallNotification] Render check - isVisible:", isVisible, "friend:", friend ? friend.account?.displayName : "null", "callStatus:", callStatus);
  }, [isVisible, friend, callStatus]);

  if (!isVisible || !friend) {
    console.log("[CallNotification] Not rendering - isVisible:", isVisible, "friend:", friend ? "exists" : "null");
    return null;
  }

  const handleAccept = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    // Set mic and video state before accepting
    setIsMicEnabled(micEnabled);
    setIsVideoEnabled(videoEnabled);
    acceptCall();
    router.push(`/dashboard/friends/call/${friendId}`);
  };

  const handleReject = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    rejectCall();
  };

  const toggleMic = () => {
    setMicEnabled(!micEnabled);
  };

  const toggleVideo = () => {
    setVideoEnabled(!videoEnabled);
  };

  return (
    <div
      ref={pipRef}
      className="position-fixed bg-dark border border-light rounded shadow-lg"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: "320px",
        zIndex: 10000,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
    >
      <Card className="bg-dark border-0 m-0">
        <Card.Body className="p-3">
          <div className="text-center mb-3">
            <Avatar
              photoUrl={friend.account?.photoUrl}
              name={friend.account?.displayName}
              email={friend.account?.email}
              size={80}
              showBorder={true}
            />
            <h5 className="text-light mt-2 mb-1">{friend.account?.displayName || friend.account?.email}</h5>
            <p className="text-muted small mb-3">Incoming call...</p>
          </div>

          {/* Mic and Video toggles */}
          <div className="d-flex gap-2 justify-content-center mb-3">
            <Button
              variant={micEnabled ? "light" : "secondary"}
              size="sm"
              className="rounded-circle"
              style={{ width: "40px", height: "40px" }}
              onClick={toggleMic}
            >
              {micEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
            </Button>
            <Button
              variant={videoEnabled ? "light" : "secondary"}
              size="sm"
              className="rounded-circle"
              style={{ width: "40px", height: "40px" }}
              onClick={toggleVideo}
            >
              {videoEnabled ? <FaVideo /> : <FaVideoSlash />}
            </Button>
          </div>

          {/* Accept/Reject buttons */}
          <div className="d-flex gap-3 justify-content-center">
            <Button
              variant="danger"
              size="lg"
              className="rounded-circle"
              style={{ width: "50px", height: "50px" }}
              onClick={handleReject}
            >
              <FaPhoneSlash />
            </Button>
            <Button
              variant="success"
              size="lg"
              className="rounded-circle"
              style={{ width: "50px", height: "50px" }}
              onClick={handleAccept}
            >
              <FaPhone />
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
