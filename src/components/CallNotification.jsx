"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "react-bootstrap";
import { FaPhone, FaPhoneSlash, FaVideo } from "react-icons/fa";
import { useRouter } from "next/navigation";
import Image from "next/image";

import useCallStore from "@/store/useCallStore";
import { getImageUrl, getInitials } from "@/lib/imageUtils";
import Avatar from "@/components/Avatar";

export default function CallNotification() {
  const router = useRouter();
  const { callStatus, friend, friendId, acceptCall, rejectCall, startCall } = useCallStore();
  const [isVisible, setIsVisible] = useState(false);
  const [audio, setAudio] = useState(null);

  useEffect(() => {
    if (callStatus === 'ringing' && friend) {
      setIsVisible(true);
      // Play ringtone
      const ringtone = new Audio('/ringtone.mp3');
      ringtone.loop = true;
      ringtone.play().catch(() => {});
      setAudio(ringtone);
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

  if (!isVisible || !friend) return null;

  const handleAccept = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
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

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        zIndex: 9999,
        backdropFilter: "blur(5px)",
      }}
    >
      <Card className="bg-dark border-light" style={{ maxWidth: "400px", width: "90%" }}>
        <Card.Body className="text-center p-4">
          <div className="mb-4">
            <Avatar
              photoUrl={friend.account?.photoUrl}
              name={friend.account?.displayName}
              email={friend.account?.email}
              size={120}
              showBorder={true}
            />
          </div>
          <h4 className="text-light mb-2">{friend.account?.displayName || friend.account?.email}</h4>
          <p className="text-muted mb-4">Incoming call...</p>
          <div className="d-flex gap-3 justify-content-center">
            <Button
              variant="danger"
              size="lg"
              className="rounded-circle"
              style={{ width: "60px", height: "60px" }}
              onClick={handleReject}
            >
              <FaPhoneSlash />
            </Button>
            <Button
              variant="success"
              size="lg"
              className="rounded-circle"
              style={{ width: "60px", height: "60px" }}
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
