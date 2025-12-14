"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Col, Row, Button, Badge, Alert } from "react-bootstrap";
import { FaArrowLeft, FaUserPlus, FaComments, FaPhone, FaVideo, FaGift, FaExclamationTriangle, FaBan } from "react-icons/fa";
import Image from "next/image";

import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";
import { getImageUrl, getInitials } from "@/lib/imageUtils";
import Avatar from "@/components/Avatar";

export default function ViewUserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId;
  const currentUser = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relationship, setRelationship] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userId) {
      loadUserProfile();
    }
  }, [userId]);

  const loadUserProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/friends/profile/${userId}`);
      setProfileUser(response.data.user);
      setRelationship(response.data.user?.relationship || {});
    } catch (error) {
      console.error("Failed to load user profile:", error);
      setError(error.response?.data?.error || "Failed to load user profile");
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      const profilePrivacy = relationship?.profilePrivacy || 'public';
      await apiClient.post(`/friends/request/${userId}`);
      await loadUserProfile();
      await refreshCurrentUser();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to follow user");
    }
  };

  const handleFollowBack = async () => {
    try {
      await apiClient.post(`/friends/follow-back/${userId}`);
      await loadUserProfile();
      await refreshCurrentUser();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to follow back");
    }
  };

  const handleUnfollow = async () => {
    try {
      await apiClient.delete(`/friends/${userId}`);
      await loadUserProfile();
      await refreshCurrentUser();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to unfollow");
    }
  };

  const refreshCurrentUser = async () => {
    try {
      const response = await apiClient.get("/users/me");
      updateUser(response.data.user);
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  };

  const handleChat = () => {
    router.push(`/dashboard/friends/chat/${userId}`);
  };

  const handleVoiceCall = () => {
    router.push(`/dashboard/friends/call/${userId}`);
  };

  const handleVideoCall = () => {
    router.push(`/dashboard/friends/call/${userId}?video=true`);
  };

  const handleSendGift = async () => {
    const isFriend = relationship?.isFriend || relationship?.isFollowing || false;
    if (!isFriend) {
      alert("You can only send gifts to friends. Please follow this user first.");
      return;
    }
    router.push(`/dashboard/friends?gift=${userId}`);
  };

  const handleReport = () => {
    const reason = prompt("Please provide a reason for reporting this user:");
    if (!reason || !reason.trim()) return;

    apiClient.post(`/users/report/${userId}`, { reason: reason.trim() })
      .then(() => {
        alert("User reported successfully. Thank you for keeping our community safe.");
      })
      .catch((error) => {
        alert(error.response?.data?.error || "Failed to report user");
      });
  };

  const handleBlock = () => {
    if (!confirm("Are you sure you want to block this user? This action can be undone later.")) return;
    
    apiClient.post(`/friends/block/${userId}`)
      .then(() => {
        alert("User blocked successfully");
        router.push("/dashboard/profile");
      })
      .catch((error) => {
        alert(error.response?.data?.error || "Failed to block user");
      });
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div className="text-light p-4">
        <Button variant="outline-light" className="mb-3" onClick={() => router.back()}>
          <FaArrowLeft className="me-2" /> Back
        </Button>
        <Alert variant="danger">{error || "User not found"}</Alert>
      </div>
    );
  }

  const isFriend = relationship?.isFriend || relationship?.isFollowing || false;
  const isFollowing = relationship?.isFollowing || false;
  const hasSentRequest = relationship?.hasSentFollowRequest || false;
  const canFollowBack = relationship?.canFollowBack !== false;
  const followsYou = relationship?.followsYou || false;
  const canView = relationship?.canView !== false;

  if (!canView) {
    return (
      <div className="text-light p-4">
        <Button variant="outline-light" className="mb-3" onClick={() => router.back()}>
          <FaArrowLeft className="me-2" /> Back
        </Button>
        <Alert variant="warning">This profile is private. Send a follow request to view it.</Alert>
      </div>
    );
  }

  return (
    <div className="text-light">
      <div className="mb-3">
        <Button variant="outline-light" onClick={() => router.back()}>
          <FaArrowLeft className="me-2" /> Back
        </Button>
      </div>

      <Card className="bg-transparent border-light mb-4">
        <Card.Body>
          <Row className="align-items-center">
            <Col xs={12} md={4} className="text-center mb-3 mb-md-0">
              <div className="position-relative d-inline-block">
                <Avatar
                  photoUrl={profileUser.account?.photoUrl}
                  name={profileUser.account?.displayName}
                  email={profileUser.account?.email}
                  size={150}
                  showBorder={true}
                />
              </div>
            </Col>

            <Col xs={12} md={8}>
              <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-2 gap-md-3 mb-3 flex-wrap">
                <h2 className="mb-0 fw-bold">{profileUser.account?.displayName || "User"}</h2>
                {currentUser?._id !== userId && (
                  <div className="d-flex gap-2 flex-wrap">
                    {isFollowing ? (
                      <Button variant="outline-secondary" size="sm" onClick={handleUnfollow}>
                        Unfollow
                      </Button>
                    ) : canFollowBack ? (
                      <Button variant="primary" size="sm" onClick={handleFollowBack}>
                        Follow Back
                      </Button>
                    ) : hasSentRequest ? (
                      <Button variant="outline-warning" size="sm" disabled>
                        Request Sent
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={handleFollow}>
                        <FaUserPlus className="me-2" /> Follow
                      </Button>
                    )}
                    
                    {isFriend && (
                      <>
                        <Button variant="outline-primary" size="sm" onClick={handleChat}>
                          <FaComments className="me-2" /> Chat
                        </Button>
                        <Button variant="outline-success" size="sm" onClick={handleVoiceCall}>
                          <FaPhone className="me-2" /> Call
                        </Button>
                        <Button variant="outline-info" size="sm" onClick={handleVideoCall}>
                          <FaVideo className="me-2" /> Video
                        </Button>
                        <Button variant="outline-warning" size="sm" onClick={handleSendGift}>
                          <FaGift className="me-2" /> Gift
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="d-flex flex-wrap gap-3 gap-md-4 mb-3">
                <div>
                  <strong>{profileUser.social?.followers?.length || 0}</strong>{" "}
                  <span className="text-muted">followers</span>
                </div>
                <div>
                  <strong>{(profileUser.social?.friends?.length || 0) + (profileUser.social?.following?.length || 0)}</strong>{" "}
                  <span className="text-muted">following</span>
                </div>
              </div>

              <div>
                <div className="fw-bold mb-1">{profileUser.account?.displayName}</div>
                <div className="text-muted small mb-1">{profileUser.account?.email}</div>
                {profileUser.account?.gender && (
                  <div className="text-muted small">
                    {profileUser.account.gender.charAt(0).toUpperCase() + profileUser.account.gender.slice(1)}
                  </div>
                )}
                {followsYou && (
                  <Badge bg="info" className="mt-2">Follows you</Badge>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Stats Cards */}
      <Row className="gy-3 mb-4">
        <Col xs={12} sm={6} md={4}>
          <Card className="bg-transparent border-light h-100">
            <Card.Body>
              <Card.Title className="text-muted small mb-2">Level</Card.Title>
              <Card.Text className="display-5 fw-bold mb-0">{profileUser.progress?.level ?? 1}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card className="bg-transparent border-light h-100">
            <Card.Body>
              <Card.Title className="text-muted small mb-2">Party Coins</Card.Title>
              <Card.Text className="display-5 fw-bold mb-0">{profileUser.wallet?.partyCoins ?? 0}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card className="bg-transparent border-light h-100">
            <Card.Body>
              <Card.Title className="text-muted small mb-2">Profile Privacy</Card.Title>
              <Card.Text className="display-6 fw-bold mb-0">
                {profileUser.social?.profilePrivacy === 'private' ? 'Private' : 'Public'}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {currentUser?._id !== userId && (
        <Card className="bg-transparent border-light">
          <Card.Header>
            <h5 className="mb-0">Actions</h5>
          </Card.Header>
          <Card.Body>
            <div className="d-flex flex-wrap gap-2">
              {isFriend && (
                <>
                  <Button variant="outline-primary" onClick={handleChat}>
                    <FaComments className="me-2" /> Chat
                  </Button>
                  <Button variant="outline-success" onClick={handleVoiceCall}>
                    <FaPhone className="me-2" /> Voice Call
                  </Button>
                  <Button variant="outline-info" onClick={handleVideoCall}>
                    <FaVideo className="me-2" /> Video Call
                  </Button>
                  <Button variant="outline-warning" onClick={handleSendGift}>
                    <FaGift className="me-2" /> Send Gift
                  </Button>
                </>
              )}
              <Button variant="outline-danger" onClick={handleReport}>
                <FaExclamationTriangle className="me-2" /> Report
              </Button>
              <Button variant="danger" onClick={handleBlock}>
                <FaBan className="me-2" /> Block
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
