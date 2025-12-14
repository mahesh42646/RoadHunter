"use client";

import { useState } from "react";
import { Button, Badge, Dropdown } from "react-bootstrap";
import { FaTimes, FaUserCircle, FaGift, FaComments, FaPhone, FaVideo, FaExclamationTriangle, FaBan } from "react-icons/fa";
import Image from "next/image";

import { getImageUrl, getInitials } from "@/lib/imageUtils";
import Avatar from "@/components/Avatar";
import useUserStatus from "@/hooks/useUserStatus";

export default function UserListItem({
  user,
  relationship,
  onFollow,
  onFollowBack,
  onUnfollow,
  onViewProfile,
  onSendGift,
  onChat,
  onVoiceCall,
  onVideoCall,
  onReport,
  onBlock,
  isFollowing,
  hasSentRequest,
  canFollowBack,
  profilePrivacy,
  followsYou,
}) {
  const { status: userStatus, isOnline, isBusy } = useUserStatus(user._id);

  return (
    <div
      className="d-flex align-items-center justify-content-between gap-3 p-2 rounded"
      style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
    >
      <div className="d-flex align-items-center gap-3 flex-grow-1">
        {getImageUrl(user.account?.photoUrl) ? (
          <Image
            src={getImageUrl(user.account?.photoUrl)}
            alt={user.account?.displayName}
            width={50}
            height={50}
            className="rounded-circle"
            style={{ objectFit: "cover" }}
            unoptimized
          />
        ) : (
          <div
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{
              width: "50px",
              height: "50px",
              backgroundColor: "rgba(255, 45, 149, 0.3)",
              color: "white",
              fontSize: "1.2rem",
              fontWeight: "bold",
              flexShrink: 0,
            }}
          >
            {getInitials(user.account?.displayName || user.account?.email || "?")}
          </div>
        )}
        <div className="flex-grow-1">
          <div className="fw-bold d-flex align-items-center gap-2">
            {user.account?.displayName || user.account?.email}
            {userStatus === 'online' && (
              <Badge bg="success" style={{ width: "8px", height: "8px", padding: 0, borderRadius: "50%" }} />
            )}
            {userStatus === 'busy' && (
              <Badge bg="warning" style={{ width: "8px", height: "8px", padding: 0, borderRadius: "50%" }} />
            )}
            {userStatus === 'offline' && (
              <Badge bg="secondary" style={{ width: "8px", height: "8px", padding: 0, borderRadius: "50%" }} />
            )}
          </div>
          <div className="text-muted small">
            Level {user.progress?.level || 1}
            {followsYou && (
              <Badge bg="info" className="ms-2">Follows you</Badge>
            )}
            {userStatus === 'busy' && <span className="ms-2 text-warning">(Busy)</span>}
            {userStatus === 'offline' && <span className="ms-2 text-muted">(Offline)</span>}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 d-flex align-items-center gap-2">
        {isFollowing ? (
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => onUnfollow(user._id)}
          >
            Unfollow
          </Button>
        ) : canFollowBack ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onFollowBack(user._id, profilePrivacy)}
          >
            Follow Back
          </Button>
        ) : hasSentRequest ? (
          <Button variant="outline-warning" size="sm" disabled>
            Request Sent
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onFollow(user._id, profilePrivacy)}
          >
            Follow
          </Button>
        )}
        
        {/* Actions Dropdown */}
        <Dropdown>
          <Dropdown.Toggle
            variant="outline-light"
            size="sm"
            id={`actions-${user._id}`}
            style={{ minWidth: "40px" }}
          >
            <FaTimes style={{ transform: "rotate(90deg)" }} />
          </Dropdown.Toggle>
          <Dropdown.Menu className="bg-dark border-light">
            <Dropdown.Item
              className="text-light"
              onClick={() => onViewProfile(user._id)}
              style={{ cursor: "pointer" }}
            >
              <FaUserCircle className="me-2" /> View Profile
            </Dropdown.Item>
            {isFollowing && (
              <>
                <Dropdown.Item
                  className="text-light"
                  onClick={() => onSendGift(user._id)}
                  style={{ cursor: "pointer" }}
                >
                  <FaGift className="me-2" /> Send Gift
                </Dropdown.Item>
                <Dropdown.Item
                  className="text-light"
                  onClick={() => onChat(user._id)}
                  style={{ cursor: "pointer" }}
                >
                  <FaComments className="me-2" /> Chat
                </Dropdown.Item>
                <Dropdown.Item
                  className={isOnline && !isBusy ? "text-light" : "text-muted"}
                  onClick={() => isOnline && !isBusy && onVoiceCall(user._id)}
                  style={{ cursor: isOnline && !isBusy ? "pointer" : "not-allowed" }}
                  disabled={!isOnline || isBusy}
                >
                  <FaPhone className="me-2" /> Voice Call
                  {!isOnline && <span className="ms-2 text-muted">(Offline)</span>}
                  {isBusy && <span className="ms-2 text-warning">(Busy)</span>}
                </Dropdown.Item>
                <Dropdown.Item
                  className={isOnline && !isBusy ? "text-light" : "text-muted"}
                  onClick={() => isOnline && !isBusy && onVideoCall(user._id)}
                  style={{ cursor: isOnline && !isBusy ? "pointer" : "not-allowed" }}
                  disabled={!isOnline || isBusy}
                >
                  <FaVideo className="me-2" /> Video Call
                  {!isOnline && <span className="ms-2 text-muted">(Offline)</span>}
                  {isBusy && <span className="ms-2 text-warning">(Busy)</span>}
                </Dropdown.Item>
                <Dropdown.Divider className="bg-light" />
                <Dropdown.Item
                  className="text-light"
                  onClick={() => onReport(user._id)}
                  style={{ cursor: "pointer" }}
                >
                  <FaExclamationTriangle className="me-2" /> Report
                </Dropdown.Item>
              </>
            )}
            <Dropdown.Item
              className="text-danger"
              onClick={() => onBlock(user._id)}
              style={{ cursor: "pointer" }}
            >
              <FaBan className="me-2" /> Block
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
}
