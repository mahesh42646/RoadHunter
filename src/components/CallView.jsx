"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "react-bootstrap";
import {
  FaPhoneSlash,
  FaVideo,
  FaVideoSlash,
  FaMicrophone,
  FaMicrophoneSlash,
  FaCompress,
  FaExpand,
  FaWindowMinimize,
} from "react-icons/fa";
import { useRouter } from "next/navigation";

import useCallStore from "@/store/useCallStore";
import Avatar from "@/components/Avatar";

export default function CallView() {
  const router = useRouter();
  const {
    callStatus,
    friend,
    friendId,
    isMinimized,
    pipPosition,
    pipSize,
    localStream,
    remoteStream,
    isMicEnabled,
    isVideoEnabled,
    endCall,
    toggleMinimize,
    setPipPosition,
    setPipSize,
    setIsDragging,
    setIsResizing,
    isDragging,
    isResizing,
    toggleMic,
    toggleVideo,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pipRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStartPos = useRef({ width: 0, height: 0, x: 0, y: 0 });

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

  // Handle dragging
  const handleMouseDown = (e) => {
    if (!isMinimized) return;
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - pipPosition.x,
      y: e.clientY - pipPosition.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      setPipPosition({
        x: Math.max(0, Math.min(window.innerWidth - pipSize.width, newX)),
        y: Math.max(0, Math.min(window.innerHeight - pipSize.height, newY)),
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
  }, [isDragging, pipPosition, pipSize, setPipPosition, setIsDragging]);

  // Handle resizing
  const handleResizeStart = (e) => {
    if (!isMinimized) return;
    e.stopPropagation();
    setIsResizing(true);
    resizeStartPos.current = {
      width: pipSize.width,
      height: pipSize.height,
      x: e.clientX,
      y: e.clientY,
    };
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;
      const newWidth = Math.max(200, Math.min(600, resizeStartPos.current.width + deltaX));
      const newHeight = Math.max(150, Math.min(450, resizeStartPos.current.height + deltaY));
      setPipSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, pipSize, setPipSize, setIsResizing]);

  if (callStatus === "idle" || callStatus === "ended" || !friend) return null;

  const handleToggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      const newState = !isMicEnabled;
      audioTracks.forEach((track) => {
        track.enabled = newState;
      });
      toggleMic();
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      const newState = !isVideoEnabled;
      videoTracks.forEach((track) => {
        track.enabled = newState;
      });
      toggleVideo();
    }
  };

  const handleEndCall = () => {
    endCall();
    // Don't force navigation - let user stay on current page
    // router.push("/dashboard/friends");
  };

  const handleMinimize = () => {
    toggleMinimize();
  };

  const handleMaximize = () => {
    toggleMinimize();
    // Navigate to call page if not already there
    if (typeof window !== 'undefined' && !window.location.pathname.includes(`/dashboard/friends/call/${friendId}`)) {
      router.push(`/dashboard/friends/call/${friendId}`);
    }
  };

  // Full screen view
  if (!isMinimized) {
    return (
      <div
        className="position-fixed top-0 start-0 w-100 h-100"
        style={{
          backgroundColor: "#000",
          zIndex: 9998,
        }}
      >
        <div className="position-relative w-100 h-100">
          {/* Remote video (main) */}
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-100 h-100"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className="d-flex align-items-center justify-content-center w-100 h-100">
              <div className="text-center text-light">
                <Avatar
                  photoUrl={friend.account?.photoUrl}
                  name={friend.account?.displayName}
                  email={friend.account?.email}
                  size={150}
                  showBorder={true}
                />
                <h4 className="mt-3">{friend.account?.displayName || friend.account?.email}</h4>
                <p className="text-muted">
                  {callStatus === "calling" ? "Calling..." : callStatus === "ringing" ? "Ringing..." : "Connecting..."}
                </p>
              </div>
            </div>
          )}

          {/* Local video (picture-in-picture) */}
          {localStream && (
            <div
              className="position-absolute"
              style={{
                bottom: "100px",
                right: "20px",
                width: "200px",
                height: "150px",
                borderRadius: "8px",
                overflow: "hidden",
                border: "2px solid #fff",
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-100 h-100"
                style={{ objectFit: "cover" }}
              />
            </div>
          )}

          {/* Controls */}
          <div
            className="position-absolute bottom-0 start-50 translate-middle-x mb-4"
            style={{ zIndex: 10 }}
          >
            <div className="d-flex gap-3 align-items-center">
              <Button
                variant={isMicEnabled ? "light" : "danger"}
                size="lg"
                className="rounded-circle"
                style={{ width: "56px", height: "56px" }}
                onClick={handleToggleMic}
              >
                {isMicEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
              </Button>
              <Button
                variant={isVideoEnabled ? "light" : "danger"}
                size="lg"
                className="rounded-circle"
                style={{ width: "56px", height: "56px" }}
                onClick={handleToggleVideo}
              >
                {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
              </Button>
              <Button
                variant="light"
                size="lg"
                className="rounded-circle"
                style={{ width: "56px", height: "56px" }}
                onClick={handleMinimize}
              >
                <FaWindowMinimize />
              </Button>
              <Button
                variant="danger"
                size="lg"
                className="rounded-circle"
                style={{ width: "56px", height: "56px" }}
                onClick={handleEndCall}
              >
                <FaPhoneSlash />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Picture-in-picture view
  return (
    <div
      ref={pipRef}
      className="position-fixed bg-dark border border-light rounded shadow-lg"
      style={{
        left: `${pipPosition.x}px`,
        top: `${pipPosition.y}px`,
        width: `${pipSize.width}px`,
        height: `${pipSize.height}px`,
        zIndex: 9997,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="position-relative w-100 h-100">
        {/* Header */}
        <div
          className="d-flex align-items-center justify-content-between p-2 bg-dark border-bottom border-light"
          style={{ cursor: "default" }}
        >
          <div className="d-flex align-items-center gap-2 text-light small">
            <Avatar
              photoUrl={friend.account?.photoUrl}
              name={friend.account?.displayName}
              email={friend.account?.email}
              size={24}
            />
            <span>{friend.account?.displayName || "Call"}</span>
          </div>
          <div className="d-flex gap-1">
            <Button
              variant="link"
              size="sm"
              className="text-light p-1"
              onClick={handleMaximize}
              style={{ minWidth: "auto", lineHeight: 1 }}
            >
              <FaExpand size={12} />
            </Button>
            <Button
              variant="link"
              size="sm"
              className="text-danger p-1"
              onClick={handleEndCall}
              style={{ minWidth: "auto", lineHeight: 1 }}
            >
              <FaPhoneSlash size={12} />
            </Button>
          </div>
        </div>

        {/* Video area */}
        <div className="position-relative" style={{ height: `calc(100% - 40px)`, backgroundColor: "#000" }}>
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-100 h-100"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className="d-flex align-items-center justify-content-center w-100 h-100">
              <Avatar
                photoUrl={friend.account?.photoUrl}
                name={friend.account?.displayName}
                email={friend.account?.email}
                size={60}
              />
            </div>
          )}

          {localStream && (
            <div
              className="position-absolute"
              style={{
                bottom: "8px",
                right: "8px",
                width: "80px",
                height: "60px",
                borderRadius: "4px",
                overflow: "hidden",
                border: "2px solid #fff",
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-100 h-100"
                style={{ objectFit: "cover" }}
              />
            </div>
          )}

          {/* Mini controls */}
          <div className="position-absolute bottom-0 start-0 w-100 p-2 bg-dark bg-opacity-75 d-flex gap-1 justify-content-center">
            <Button
              variant={isMicEnabled ? "light" : "danger"}
              size="sm"
              className="rounded-circle"
              style={{ width: "32px", height: "32px", padding: 0 }}
              onClick={handleToggleMic}
            >
              {isMicEnabled ? <FaMicrophone size={12} /> : <FaMicrophoneSlash size={12} />}
            </Button>
            <Button
              variant={isVideoEnabled ? "light" : "danger"}
              size="sm"
              className="rounded-circle"
              style={{ width: "32px", height: "32px", padding: 0 }}
              onClick={handleToggleVideo}
            >
              {isVideoEnabled ? <FaVideo size={12} /> : <FaVideoSlash size={12} />}
            </Button>
          </div>
        </div>

        {/* Resize handle */}
        <div
          className="position-absolute"
          style={{
            bottom: 0,
            right: 0,
            width: "20px",
            height: "20px",
            cursor: "nwse-resize",
          }}
          onMouseDown={handleResizeStart}
        >
          <div
            className="w-100 h-100"
            style={{
              borderRight: "3px solid #fff",
              borderBottom: "3px solid #fff",
              borderBottomRightRadius: "4px",
            }}
          />
        </div>
      </div>
    </div>
  );
}
