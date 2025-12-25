"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Card, Col, Form, Row, Button, Alert, InputGroup, Modal, Badge, Dropdown } from "react-bootstrap";
import { FaCamera, FaUser, FaLock, FaUnlock, FaUpload, FaTimes, FaCopy, FaCheck, FaComments, FaPhone, FaVideo, FaGift, FaUserCircle, FaBan, FaExclamationTriangle } from "react-icons/fa";
import { io } from "socket.io-client";

import useAuthStore from "@/store/useAuthStore";
import apiClient from "@/lib/apiClient";
import { getImageUrl, getInitials } from "@/lib/imageUtils";
import GiftSelector from "@/app/party/components/GiftSelector";
import UserListItem from "./components/UserListItem";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [referralData, setReferralData] = useState(null);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftRecipientId, setGiftRecipientId] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportUserId, setReportUserId] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [showBlockConfirmModal, setShowBlockConfirmModal] = useState(false);
  const [blockUserId, setBlockUserId] = useState(null);
  const [blocking, setBlocking] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.account?.displayName || "",
    gender: user?.account?.gender || "",
    profilePrivacy: user?.social?.profilePrivacy || "public",
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.account?.photoUrl || "");
  const fileInputRef = useRef(null);
  
  // Email and password management
  const [showAddEmailModal, setShowAddEmailModal] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: "" });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });
  const [changePasswordForm, setChangePasswordForm] = useState({ 
    currentPassword: "", 
    newPassword: "", 
    confirmPassword: "" 
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const isProfileComplete = user?.account?.profileCompleted;

  // Check for edit query parameter
  useEffect(() => {
    const editParam = searchParams.get("edit");
    if (editParam === "true") {
      setShowEditModal(true);
      router.replace("/dashboard/profile", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.account?.displayName || "",
        gender: user.account?.gender || "",
        profilePrivacy: user.social?.profilePrivacy || "public",
      });
      setPreviewUrl(user.account?.photoUrl || "");
    }
  }, [user]);

  useEffect(() => {
    if (isProfileComplete) {
      loadReferralData();
      loadWallet();
    }
  }, [isProfileComplete]);

  const loadWallet = async () => {
    try {
      const response = await apiClient.get("/wallet/balance");
      setWallet(response.data);
    } catch (error) {
      console.error("Failed to load wallet:", error);
    }
  };

  // Socket listener for social updates (followers/following count changes)
  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token || !user?._id) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("user:join");
    });

    // Listen for social updates (follower/following count changes)
    socket.on("user:socialUpdated", async (data) => {
      if (data.userId === user._id) {
        // Refresh user data to get updated follower/following counts
        try {
          const response = await apiClient.get("/users/me");
          updateUser(response.data.user);
        } catch (error) {
          console.error("Failed to refresh user data:", error);
        }
      }
    });

    // Listen for when someone follows you
    socket.on("friends:followed", async (data) => {
      if (data.targetId === user._id) {
        // Someone followed you, refresh user data
        try {
          const response = await apiClient.get("/users/me");
          updateUser(response.data.user);
        } catch (error) {
          console.error("Failed to refresh user data:", error);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?._id, updateUser]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image size must be less than 5MB");
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    setMessage("");

    if (!emailForm.email.trim()) {
      setMessage("Email is required");
      setEmailLoading(false);
      return;
    }

    try {
      const response = await apiClient.post("/users/account/add-email", {
        email: emailForm.email.trim(),
      });
      updateUser(response.data.user);
      setMessage("Email added successfully!");
      setEmailForm({ email: "" });
      
      const meResponse = await apiClient.get("/users/me");
      updateUser(meResponse.data.user);
      
      setTimeout(() => {
        setShowAddEmailModal(false);
        setMessage("");
      }, 2000);
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to add email");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setMessage("");

    if (!passwordForm.password || passwordForm.password.length < 8) {
      setMessage("Password must be at least 8 characters");
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setMessage("Passwords do not match");
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await apiClient.post("/users/account/set-password", {
        password: passwordForm.password,
      });
      updateUser(response.data.user);
      setMessage("Password set successfully!");
      setPasswordForm({ password: "", confirmPassword: "" });
      
      const meResponse = await apiClient.get("/users/me");
      updateUser(meResponse.data.user);
      
      setTimeout(() => {
        setShowSetPasswordModal(false);
        setMessage("");
      }, 2000);
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to set password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePasswordLoading(true);
    setMessage("");

    if (!changePasswordForm.currentPassword || !changePasswordForm.newPassword) {
      setMessage("All fields are required");
      setChangePasswordLoading(false);
      return;
    }

    if (changePasswordForm.newPassword.length < 8) {
      setMessage("New password must be at least 8 characters");
      setChangePasswordLoading(false);
      return;
    }

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setMessage("New passwords do not match");
      setChangePasswordLoading(false);
      return;
    }

    try {
      // First verify current password by attempting to sign in
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const { auth } = await import("@/firebase");
      
      await signInWithEmailAndPassword(
        auth,
        user.account.email,
        changePasswordForm.currentPassword
      );

      // If sign in successful, update password
      const response = await apiClient.post("/users/account/change-password", {
        currentPassword: changePasswordForm.currentPassword,
        newPassword: changePasswordForm.newPassword,
      });
      
      setMessage("Password changed successfully!");
      setChangePasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setMessage("");
      }, 2000);
    } catch (error) {
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        setMessage("Current password is incorrect");
      } else {
        setMessage(error.response?.data?.error || error.message || "Failed to change password");
      }
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!formData.fullName.trim()) {
      setMessage("Full name is required");
      setLoading(false);
      return;
    }

    if (!formData.gender) {
      setMessage("Please select your gender");
      setLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("fullName", formData.fullName.trim());
      formDataToSend.append("gender", formData.gender);
      formDataToSend.append("profilePrivacy", formData.profilePrivacy);
      if (photoFile) {
        formDataToSend.append("photo", photoFile);
      }

      const response = await apiClient.post("/users/profile", formDataToSend);
      updateUser(response.data.user);
      setMessage("Profile updated successfully!");
      
      const meResponse = await apiClient.get("/users/me");
      updateUser(meResponse.data.user);
      
      setPhotoFile(null);
      
      if (showEditModal) {
        setTimeout(() => {
          setShowEditModal(false);
          setMessage("");
        }, 2000);
      }
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to complete profile");
    } finally {
      setLoading(false);
    }
  };

  const loadFollowers = async () => {
    setLoadingFollowers(true);
    try {
      const response = await apiClient.get("/friends/followers");
      setFollowers(response.data.followers || []);
    } catch (error) {
      console.error("Failed to load followers:", error);
      setFollowers([]);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const loadFollowing = async () => {
    setLoadingFollowing(true);
    try {
      const response = await apiClient.get("/friends/following");
      setFollowing(response.data.following || []);
    } catch (error) {
      console.error("Failed to load following:", error);
      setFollowing([]);
    } finally {
      setLoadingFollowing(false);
    }
  };

  const handleFollow = async (userId, profilePrivacy) => {
    try {
      await apiClient.post(`/friends/request/${userId}`);
      // Wait a bit for backend to process
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshUserData();
      await loadFollowers();
      await loadFollowing();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to follow user");
    }
  };

  const handleFollowBack = async (userId, profilePrivacy) => {
    try {
      await apiClient.post(`/friends/follow-back/${userId}`);
      // Wait a bit for backend to process
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshUserData();
      await loadFollowers();
      await loadFollowing();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to follow back");
    }
  };

  const handleUnfollow = async (userId) => {
    try {
      await apiClient.delete(`/friends/${userId}`);
      // Wait a bit for backend to process
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshUserData();
      await loadFollowers();
      await loadFollowing();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to unfollow");
    }
  };

  const handleViewProfile = (userId) => {
    router.push(`/dashboard/users/${userId}`);
  };

  const handleSendGift = async (userId) => {
    // Check if user is a friend/following first
    try {
      const response = await apiClient.get(`/friends/profile/${userId}`);
      const relationship = response.data.user?.relationship || {};
      const isFriend = relationship.isFriend || relationship.isFollowing || false;
      
      if (!isFriend) {
        alert("You can only send gifts to friends. Please follow this user first.");
        return;
      }
      
      setGiftRecipientId(userId);
      setShowGiftModal(true);
      setShowFollowersModal(false);
      setShowFollowingModal(false);
    } catch (error) {
      console.error("Failed to check relationship:", error);
      alert("Failed to check user relationship");
    }
  };

  const handleChat = (userId) => {
    router.push(`/dashboard/friends/chat/${userId}`);
  };

  const handleVoiceCall = async (userId) => {
    try {
      // Check user status first
      const statusResponse = await apiClient.get(`/friends/status/${userId}`);
      const { status, isOnline, isBusy } = statusResponse.data;

      if (!isOnline) {
        alert("User is offline. Cannot make a call.");
        return;
      }

      if (isBusy) {
        alert("User is busy (in a party). Cannot make a call.");
        return;
      }

      const response = await apiClient.get(`/friends/profile/${userId}`);
      const friendData = response.data.user;
      const { startCall, setCallStatus } = useCallStore.getState();
      startCall(userId, friendData, true);
      setCallStatus("calling");
      // Navigate to call page which will handle socket emission
      router.push(`/dashboard/friends/call/${userId}`);
    } catch (error) {
      console.error("Failed to start call:", error);
      const errorMsg = error.response?.data?.error || "Failed to start call";
      alert(errorMsg);
    }
  };

  const handleVideoCall = async (userId) => {
    try {
      // Check user status first
      const statusResponse = await apiClient.get(`/friends/status/${userId}`);
      const { status, isOnline, isBusy } = statusResponse.data;

      if (!isOnline) {
        alert("User is offline. Cannot make a call.");
        return;
      }

      if (isBusy) {
        alert("User is busy (in a party). Cannot make a call.");
        return;
      }

      const response = await apiClient.get(`/friends/profile/${userId}`);
      const friendData = response.data.user;
      const { startCall, setCallStatus } = useCallStore.getState();
      startCall(userId, friendData, true);
      setCallStatus("calling");
      // Navigate to call page which will handle socket emission
      router.push(`/dashboard/friends/call/${userId}`);
    } catch (error) {
      console.error("Failed to start call:", error);
      const errorMsg = error.response?.data?.error || "Failed to start call";
      alert(errorMsg);
    }
  };

  const handleReport = (userId) => {
    setReportUserId(userId);
    setShowReportModal(true);
    setShowFollowersModal(false);
    setShowFollowingModal(false);
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) {
      setMessage("Please provide a reason for reporting");
      return;
    }

    setReporting(true);
    setMessage("");
    
    try {
      await apiClient.post(`/users/report/${reportUserId}`, { reason: reportReason.trim() });
      setMessage("User reported successfully. Thank you for keeping our community safe.");
      setReportReason("");
      setTimeout(() => {
        setShowReportModal(false);
        setMessage("");
        setReportUserId(null);
      }, 2000);
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to report user");
    } finally {
      setReporting(false);
    }
  };

  const handleBlock = (userId) => {
    setBlockUserId(userId);
    setShowBlockConfirmModal(true);
    setShowFollowersModal(false);
    setShowFollowingModal(false);
  };

  const handleConfirmBlock = async () => {
    if (!blockUserId) return;

    setBlocking(true);
    try {
      await apiClient.post(`/friends/block/${blockUserId}`);
      alert("User blocked successfully");
      await refreshUserData();
      await loadFollowers();
      await loadFollowing();
      setShowBlockConfirmModal(false);
      setBlockUserId(null);
    } catch (error) {
      alert(error.response?.data?.error || "Failed to block user");
    } finally {
      setBlocking(false);
    }
  };

  const refreshUserData = async () => {
    try {
      const response = await apiClient.get("/users/me");
      updateUser(response.data.user);
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  };

  const handleFollowersClick = async () => {
    // Refresh user data first to get latest follower count
    await refreshUserData();
    setShowFollowersModal(true);
    loadFollowers();
  };

  const handleFollowingClick = async () => {
    // Refresh user data first to get latest following count
    await refreshUserData();
    setShowFollowingModal(true);
    loadFollowing();
  };

  const loadReferralData = async () => {
    setLoadingReferrals(true);
    try {
      const response = await apiClient.get("/users/referrals");
      setReferralData(response.data);
    } catch (error) {
      console.error("Failed to load referral data:", error);
      setReferralData({
        pending: 0,
        completed: 0,
        referralWallet: { partyCoins: 0, totalEarned: 0, totalWithdrawn: 0 },
        referrals: [],
        referralCode: user?.referralCode || null,
      });
    } finally {
      setLoadingReferrals(false);
    }
  };

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyReferralLink = () => {
    if (user?.referralCode) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const referralLink = `${baseUrl}/user/login?ref=${user.referralCode}`;
      navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount <= 0) {
      setMessage("Please enter a valid amount");
      return;
    }

    if (amount > (referralData?.referralWallet?.partyCoins || 0)) {
      setMessage("Insufficient balance in referral wallet");
      return;
    }

    setWithdrawing(true);
    setMessage("");
    
    try {
      await apiClient.post("/users/referrals/withdraw", { amount });
      setMessage("Withdrawal successful! Coins transferred to main wallet.");
      await loadReferralData();
      // Refresh user data to update main wallet
      const meResponse = await apiClient.get("/users/me");
      updateUser(meResponse.data.user);
      setWithdrawAmount("");
      setTimeout(() => {
        setShowWithdrawModal(false);
        setMessage("");
      }, 2000);
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to withdraw");
    } finally {
      setWithdrawing(false);
    }
  };

  // Calculate total following (friends + following)
  const totalFollowing = (user?.social?.friends?.length || 0) + (user?.social?.following?.length || 0);

  // Show completion form if profile not complete
  if (!isProfileComplete) {
    return (
      <div className="text-light">
        <div className="mb-4">
          <h2 className="fw-bold">Complete Your Profile</h2>
          <p className="text-muted">Complete your profile to join parties and connect with others</p>
        </div>

        <Card className="bg-transparent border-light">
          <Card.Body>
            {message && (
              <Alert variant={message.includes("success") ? "success" : "danger"} className="mb-4">
                {message}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Row className="gy-4">
                <Col md={12} className="text-center">
                  <div className="mb-3">
                    <div
                      className="position-relative d-inline-block"
                      style={{ cursor: "pointer" }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {previewUrl ? (
                        previewUrl.startsWith("data:") ? (
                          <img
                            src={previewUrl}
                            alt="Profile"
                            className="rounded-circle"
                            style={{
                              width: "150px",
                              height: "150px",
                              objectFit: "cover",
                              border: "3px solid #FF2D95",
                            }}
                          />
                        ) : getImageUrl(previewUrl) ? (
                          <Image
                            src={getImageUrl(previewUrl)}
                            alt="Profile"
                            width={150}
                            height={150}
                            className="rounded-circle"
                            style={{
                              objectFit: "cover",
                              border: "3px solid #FF2D95",
                            }}
                            unoptimized
                          />
                        ) : (
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center"
                            style={{
                              width: "150px",
                              height: "150px",
                              backgroundColor: "rgba(255, 45, 149, 0.3)",
                              border: "3px solid #FF2D95",
                              color: "white",
                              fontSize: "3rem",
                              fontWeight: "bold",
                            }}
                          >
                            {getInitials(user?.account?.displayName || user?.account?.email || "?")}
                          </div>
                        )
                      ) : (
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center"
                          style={{
                            width: "150px",
                            height: "150px",
                            backgroundColor: "#1A1F2E",
                            border: "3px solid #FF2D95",
                          }}
                        >
                          <FaCamera size={50} color="#FF2D95" />
                        </div>
                      )}
                      <div
                        className="position-absolute bottom-0 end-0 bg-primary rounded-circle p-2"
                        style={{ transform: "translate(25%, 25%)" }}
                      >
                        <FaCamera size={16} />
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: "none" }}
                    />
                    <div className="mt-2">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FaUpload className="me-2" />
                        {previewUrl && previewUrl !== user?.account?.photoUrl ? "Change Photo" : "Upload Photo"}
                      </Button>
                      {!photoFile && user?.account?.photoUrl && (
                        <p className="text-muted small mt-2 mb-0">
                          Using Google account photo. Upload a custom photo to replace it.
                        </p>
                      )}
                    </div>
                  </div>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>
                      <FaUser className="me-2" />
                      Full Name *
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                      }
                      placeholder="Enter your full name"
                      required
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={user?.account?.email || ""}
                      readOnly
                      disabled
                    />
                    <Form.Text className="text-muted">Email from your account</Form.Text>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Gender *</Form.Label>
                    <Form.Select
                      value={formData.gender}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, gender: e.target.value }))
                      }
                      required
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>
                      {formData.profilePrivacy === "public" ? (
                        <FaUnlock className="me-2" />
                      ) : (
                        <FaLock className="me-2" />
                      )}
                      Profile Privacy *
                    </Form.Label>
                    <Form.Select
                      value={formData.profilePrivacy}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, profilePrivacy: e.target.value }))
                      }
                      required
                    >
                      <option value="public">Public - Anyone can follow you</option>
                      <option value="private">Private - Follow requests required</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={loading}
                    className="w-100"
                  >
                    {loading ? "Completing Profile..." : "Complete Profile"}
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
      </div>
    );
  }

  // Main profile view with merged dashboard stats
  return (
    <div className="text-light">
      {/* Welcome Section */}
      <div className="mb-4">
        <p className="text-muted small mb-1">Player overview</p>
        <h2 className="fw-bold">Welcome back, {user?.account?.displayName ?? "Player"}</h2>
        <p className="text-light-50">
          Keep your profile complete to unlock wallet access, referral bonuses, and level boosts.
        </p>
      </div>

      {/* Profile Header Card */}
      <Card className="bg-transparent border-light mb-4">
        <Card.Body>
          <Row className="align-items-center">
            <Col xs={12} md={4} className="text-center text-md-start mb-4 mb-md-0">
              <div className="position-relative d-inline-block">
                {getImageUrl(user?.account?.photoUrl) ? (
                <Image
                  src={getImageUrl(user?.account?.photoUrl)}
                  alt={user?.account?.displayName || "Profile"}
                  width={150}
                  height={150}
                  className="rounded-circle"
                  style={{
                    objectFit: "cover",
                    border: "3px solid #FF2D95",
                  }}
                  unoptimized
                />
                ) : (
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: "150px",
                      height: "150px",
                      backgroundColor: "rgba(255, 45, 149, 0.3)",
                      border: "3px solid #FF2D95",
                      color: "white",
                      fontSize: "3rem",
                      fontWeight: "bold",
                    }}
                  >
                    {getInitials(user?.account?.displayName || user?.account?.email || "?")}
                  </div>
                )}
                <div
                  className="position-absolute bottom-0 end-0 bg-primary rounded-circle p-2"
                  style={{ transform: "translate(25%, 25%)", cursor: "pointer" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FaCamera size={16} />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                />
              </div>
            </Col>

            <Col xs={12} md={8}>
              <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-2 gap-md-3 mb-3 flex-wrap">
                <h2 className="mb-0 fw-bold">{user?.account?.displayName || "User"}</h2>
                <Button
                  variant="outline-light"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                  className="flex-shrink-0"
                >
                  Edit Profile
                </Button>
              </div>

              <div className="d-flex flex-wrap gap-3 gap-md-4 mb-3">
                <div style={{ cursor: "pointer" }} onClick={handleFollowersClick}>
                  <strong>{user?.social?.followers?.length || 0}</strong>{" "}
                  <span className="text-muted">followers</span>
                </div>
                <div style={{ cursor: "pointer" }} onClick={handleFollowingClick}>
                  <strong>{totalFollowing}</strong>{" "}
                  <span className="text-muted">following</span>
                </div>
              </div>

              <div>
                <div className="fw-bold mb-1">{user?.account?.displayName}</div>
                <div className="text-muted small mb-1">{user?.account?.email}</div>
                {user?.account?.gender && (
                  <div className="text-muted small">
                    {user.account.gender.charAt(0).toUpperCase() + user.account.gender.slice(1)}
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Stats Cards Section */}
      <Row className="gy-3 mb-4">
        <Col xs={12} sm={6} md={4}>
          <Card className="bg-transparent border-light h-100">
        <Card.Body>
              <Card.Title className="text-muted small mb-2">Level</Card.Title>
              <Card.Text className="display-5 fw-bold mb-0">{user?.progress?.level ?? 1}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card className="bg-transparent border-light h-100">
            <Card.Body>
              <Card.Title className="text-muted small mb-2">Party Coins</Card.Title>
              <Card.Text className="display-5 fw-bold mb-0">{user?.wallet?.partyCoins ?? 0}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} sm={6} md={4}>
          <Card className="bg-transparent border-light h-100">
            <Card.Body>
              <Card.Title className="text-muted small mb-2">Referral Code</Card.Title>
              <div className="d-flex align-items-center gap-2">
                <Card.Text className="display-6 fw-bold mb-0 flex-grow-1">
                  {user?.referralCode ?? "Pending profile"}
                </Card.Text>
                {user?.referralCode && (
                  <Button
                    variant="outline-light"
                    size="sm"
                    onClick={copyReferralCode}
                    className="flex-shrink-0"
                    title="Copy Code"
                  >
                    {copiedCode ? <FaCheck /> : <FaCopy />}
                  </Button>
                )}
          </div>
        </Card.Body>
      </Card>
        </Col>
      </Row>

      {/* Referral System Section */}
      {user?.referralCode && (
        <Card className="bg-transparent border-light mb-4">
          <Card.Header>
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Referral Program</h5>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={copyReferralLink}
              >
                {copiedLink ? (
                  <>
                    <FaCheck className="me-2" /> Link Copied!
                  </>
                ) : (
                  <>
                    <FaCopy className="me-2" /> Copy Referral Link
                  </>
                )}
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            {loadingReferrals ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <>
                <Row className="gy-3 mb-4">
                  <Col xs={12} sm={6} md={3}>
                    <div className="text-center p-3 rounded" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
                      <div className="text-muted small mb-1">Pending Referrals</div>
                      <div className="display-6 fw-bold">{referralData?.pending || 0}</div>
                    </div>
                  </Col>
                  <Col xs={12} sm={6} md={3}>
                    <div className="text-center p-3 rounded" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
                      <div className="text-muted small mb-1">Completed Referrals</div>
                      <div className="display-6 fw-bold text-success">{referralData?.completed || 0}</div>
                    </div>
                  </Col>
                  <Col xs={12} sm={6} md={3}>
                    <div className="text-center p-3 rounded" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
                      <div className="text-muted small mb-1">Referral Wallet</div>
                      <div className="display-6 fw-bold text-warning">{referralData?.referralWallet?.partyCoins || 0}</div>
                      <div className="text-muted small mt-1">Party Coins</div>
                    </div>
                  </Col>
                  <Col xs={12} sm={6} md={3}>
                    <div className="text-center p-3 rounded" style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
                      <div className="text-muted small mb-1">Total Earned</div>
                      <div className="display-6 fw-bold text-info">{referralData?.referralWallet?.totalEarned || 0}</div>
                      <div className="text-muted small mt-1">Party Coins</div>
                    </div>
                  </Col>
                </Row>

                {referralData?.referralWallet?.partyCoins > 0 && (
                  <div className="d-flex justify-content-center">
                    <Button
                      variant="primary"
                      onClick={() => setShowWithdrawModal(true)}
                    >
                      Withdraw to Main Wallet
                    </Button>
                  </div>
                )}

                {referralData?.referrals && referralData.referrals.length > 0 && (
                  <div className="mt-4">
                    <h6 className="mb-3">Your Referrals</h6>
                    <div className="d-flex flex-column gap-2" style={{ maxHeight: "300px", overflowY: "auto" }}>
                      {referralData.referrals.map((ref, idx) => (
                        <div
                          key={idx}
                          className="d-flex align-items-center justify-content-between p-2 rounded"
                          style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            {ref.user ? (
                              <>
                                {getImageUrl(ref.user.photoUrl) ? (
                                  <Image
                                    src={getImageUrl(ref.user.photoUrl)}
                                    alt={ref.user.displayName}
                                    width={40}
                                    height={40}
                                    className="rounded-circle"
                                    style={{ objectFit: "cover" }}
                                    unoptimized
                                  />
                                ) : (
                                  <div
                                    className="rounded-circle d-flex align-items-center justify-content-center"
                                    style={{
                                      width: "40px",
                                      height: "40px",
                                      backgroundColor: "rgba(255, 45, 149, 0.3)",
                                      color: "white",
                                      fontSize: "1rem",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {getInitials(ref.user.displayName || ref.user.email || "?")}
                                  </div>
                                )}
                                <div>
                                  <div className="fw-bold small">{ref.user.displayName || ref.user.email}</div>
                                  <div className="text-muted small">Level {ref.user.level || 1}</div>
                                </div>
                              </>
                            ) : (
                              <div className="text-muted">User not found</div>
                            )}
                          </div>
                          <div className="text-end">
                            <Badge
                              bg={ref.status === "completed" ? "success" : "warning"}
                              className="mb-1"
                            >
                              {ref.status === "completed" ? "Completed" : "Pending"}
                            </Badge>
                            {ref.status === "completed" && (
                              <div className="text-success small">
                                +{ref.bonusEarned || 0} coins
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Withdraw Modal */}
      <Modal
        show={showWithdrawModal}
        onHide={() => {
          setShowWithdrawModal(false);
          setWithdrawAmount("");
          setMessage("");
        }}
        centered
        contentClassName="bg-dark border-light"
      >
        <Modal.Header closeButton className="border-light">
          <Modal.Title className="text-light">Withdraw from Referral Wallet</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {message && (
            <Alert variant={message.includes("success") ? "success" : "danger"} className="mb-3">
              {message}
            </Alert>
          )}
          <div className="mb-3">
            <div className="text-muted small mb-2">Available Balance</div>
            <div className="h4 fw-bold text-warning">
              {referralData?.referralWallet?.partyCoins || 0} Party Coins
            </div>
          </div>
          <Form onSubmit={handleWithdraw}>
            <Form.Group className="mb-3">
              <Form.Label>Amount to Withdraw (Party Coins)</Form.Label>
              <Form.Control
                type="number"
                min="1"
                max={referralData?.referralWallet?.partyCoins || 0}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount"
                required
              />
              <Form.Text className="text-muted">
                Coins will be transferred to your main wallet
              </Form.Text>
            </Form.Group>
            <div className="d-flex gap-2">
              <Button
                variant="outline-light"
                className="flex-grow-1"
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount("");
                  setMessage("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-grow-1"
                disabled={withdrawing}
              >
                {withdrawing ? "Processing..." : "Withdraw"}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Followers Modal */}
      <Modal
        show={showFollowersModal}
        onHide={() => setShowFollowersModal(false)}
        centered
        contentClassName="bg-dark border-light"
      >
        <Modal.Header closeButton className="border-light">
          <Modal.Title className="text-light">Followers</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {loadingFollowers ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : followers.length === 0 ? (
            <div className="text-center text-muted py-4">No followers yet</div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {followers.map((follower) => {
                const relationship = follower.relationship || {};
                return (
                  <UserListItem
                    key={follower._id}
                    user={follower}
                    relationship={relationship}
                    isFollowing={relationship.isFollowing || false}
                    hasSentRequest={relationship.hasSentFollowRequest || false}
                    canFollowBack={relationship.canFollowBack !== false}
                    profilePrivacy={relationship.profilePrivacy || 'public'}
                    followsYou={false}
                    onFollow={handleFollow}
                    onFollowBack={handleFollowBack}
                    onUnfollow={handleUnfollow}
                    onViewProfile={handleViewProfile}
                    onSendGift={handleSendGift}
                    onChat={handleChat}
                    onVoiceCall={handleVoiceCall}
                    onVideoCall={handleVideoCall}
                    onReport={handleReport}
                    onBlock={handleBlock}
                  />
                );
              })}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Following Modal */}
      <Modal
        show={showFollowingModal}
        onHide={() => setShowFollowingModal(false)}
        centered
        contentClassName="bg-dark border-light"
      >
        <Modal.Header closeButton className="border-light">
          <Modal.Title className="text-light">Following</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {loadingFollowing ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : following.length === 0 ? (
            <div className="text-center text-muted py-4">Not following anyone yet</div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {following.map((follow) => {
                const relationship = follow.relationship || {};
                return (
                  <UserListItem
                    key={follow._id}
                    user={follow}
                    relationship={relationship}
                    isFollowing={true}
                    hasSentRequest={false}
                    canFollowBack={false}
                    profilePrivacy={relationship.profilePrivacy || 'public'}
                    followsYou={relationship.followsYou || false}
                    onFollow={handleFollow}
                    onFollowBack={handleFollowBack}
                    onUnfollow={handleUnfollow}
                    onViewProfile={handleViewProfile}
                    onSendGift={handleSendGift}
                    onChat={handleChat}
                    onVoiceCall={handleVoiceCall}
                    onVideoCall={handleVideoCall}
                    onReport={handleReport}
                    onBlock={handleBlock}
                  />
                );
              })}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        show={showEditModal}
        onHide={() => {
          setShowEditModal(false);
          setMessage("");
          if (user) {
            setFormData({
              fullName: user.account?.displayName || "",
              gender: user.account?.gender || "",
              profilePrivacy: user.social?.profilePrivacy || "public",
            });
            setPreviewUrl(user.account?.photoUrl || "");
            setPhotoFile(null);
          }
        }}
        size="lg"
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
          <Modal.Title style={{ color: "var(--text-secondary)", fontSize: "1.25rem" }}>
            Edit Profile
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ color: "var(--text-primary)" }}>
          {message && (
            <Alert variant={message.includes("success") ? "success" : "danger"} className="mb-4">
              {message}
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Row className="gy-4">
              <Col md={12} className="text-center">
                <div className="mb-3">
                  <div
                    className="position-relative d-inline-block"
                    style={{ cursor: "pointer" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      previewUrl.startsWith("data:") ? (
                        <img
                          src={previewUrl}
                          alt="Profile"
                          className="rounded-circle"
                          style={{
                            width: "150px",
                            height: "150px",
                            objectFit: "cover",
                            border: "3px solid #FF2D95",
                          }}
                        />
                      ) : getImageUrl(previewUrl) ? (
                        <Image
                          src={getImageUrl(previewUrl)}
                          alt="Profile"
                          width={150}
                          height={150}
                          className="rounded-circle"
                          style={{
                            objectFit: "cover",
                            border: "3px solid #FF2D95",
                          }}
                          unoptimized
                        />
                      ) : (
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center"
                          style={{
                            width: "150px",
                            height: "150px",
                            backgroundColor: "rgba(255, 45, 149, 0.3)",
                            border: "3px solid #FF2D95",
                            color: "white",
                            fontSize: "3rem",
                            fontWeight: "bold",
                          }}
                        >
                          {getInitials(user?.account?.displayName || user?.account?.email || "?")}
                        </div>
                      )
                    ) : (
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center"
                        style={{
                          width: "150px",
                          height: "150px",
                          backgroundColor: "#1A1F2E",
                          border: "3px solid #FF2D95",
                        }}
                      >
                        <FaCamera size={50} color="#FF2D95" />
                      </div>
                    )}
                    <div
                      className="position-absolute bottom-0 end-0 bg-primary rounded-circle p-2"
                      style={{ transform: "translate(25%, 25%)" }}
                    >
                      <FaCamera size={16} />
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                  <div className="mt-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FaUpload className="me-2" />
                      {previewUrl && previewUrl !== user?.account?.photoUrl ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {!photoFile && user?.account?.photoUrl && (
                      <p className="text-muted small mt-2 mb-0">
                        Using current photo. Upload a new photo to replace it.
                      </p>
                    )}
                  </div>
                </div>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>
                    <FaUser className="me-2" />
                    Full Name *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                    }
                    placeholder="Enter your full name"
                    required
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  {user?.account?.email ? (
                    <>
                      <Form.Control
                        type="email"
                        value={user?.account?.email || ""}
                        readOnly
                        disabled
                      />
                      <Form.Text className="text-muted">Email cannot be changed once added</Form.Text>
                    </>
                  ) : (
                    <>
                      <Form.Control
                        type="email"
                        value="Not set"
                        readOnly
                        disabled
                        style={{ backgroundColor: "var(--bg-secondary)" }}
                      />
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="mt-2"
                        onClick={() => setShowAddEmailModal(true)}
                      >
                        Add Email
                      </Button>
                      <Form.Text className="text-muted d-block mt-1">
                        Add email to secure your account (can only be added once)
                      </Form.Text>
                    </>
                  )}
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>Password</Form.Label>
                  {(() => {
                    const hasPasswordProvider = user?.account?.providers?.some(
                      p => p.providerId === 'password'
                    );
                    
                    if (hasPasswordProvider) {
                      return (
                        <>
                          <Form.Control
                            type="text"
                            value="••••••••"
                            readOnly
                            disabled
                          />
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="mt-2"
                            onClick={() => setShowChangePasswordModal(true)}
                          >
                            Change Password
                          </Button>
                          <Form.Text className="text-muted d-block mt-1">
                            Change your account password
                          </Form.Text>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <Form.Control
                            type="text"
                            value="Not set"
                            readOnly
                            disabled
                            style={{ backgroundColor: "var(--bg-secondary)" }}
                          />
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="mt-2"
                            onClick={() => setShowSetPasswordModal(true)}
                            disabled={!user?.account?.email}
                          >
                            Set Password
                          </Button>
                          <Form.Text className="text-muted d-block mt-1">
                            {user?.account?.email 
                              ? "Set a password to login with email and password"
                              : "Add email first to set a password"}
                          </Form.Text>
                        </>
                      );
                    }
                  })()}
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>Gender *</Form.Label>
                  <Form.Select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, gender: e.target.value }))
                    }
                    required
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label>
                    {formData.profilePrivacy === "public" ? (
                      <FaUnlock className="me-2" />
                    ) : (
                      <FaLock className="me-2" />
                    )}
                    Profile Privacy *
                  </Form.Label>
                  <Form.Select
                    value={formData.profilePrivacy}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, profilePrivacy: e.target.value }))
                    }
                    required
                  >
                    <option value="public">Public - Anyone can follow you</option>
                    <option value="private">Private - Follow requests required</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={12}>
                <div className="d-flex gap-2">
                  <Button
                    type="button"
                    variant="outline-light"
                    size="lg"
                    onClick={() => {
                      setShowEditModal(false);
                      setMessage("");
                      if (user) {
                        setFormData({
                          fullName: user.account?.displayName || "",
                          gender: user.account?.gender || "",
                          profilePrivacy: user.social?.profilePrivacy || "public",
                        });
                        setPreviewUrl(user.account?.photoUrl || "");
                        setPhotoFile(null);
                      }
                    }}
                    className="flex-grow-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={loading}
                    className="flex-grow-1"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Gift Modal for Individual User */}
      {showGiftModal && giftRecipientId && (
        <Modal
          show={showGiftModal}
          onHide={() => {
            setShowGiftModal(false);
            setGiftRecipientId(null);
          }}
          centered
          contentClassName="glass-card border-0"
          size="lg"
        >
          <Modal.Header
            closeButton
            style={{
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              color: "var(--text-primary)",
            }}
          >
            <Modal.Title style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
              Send Gift
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <GiftSelector
              show={true}
              onHide={() => {
                setShowGiftModal(false);
                setGiftRecipientId(null);
              }}
              wallet={wallet}
              friendId={giftRecipientId}
              onGiftSent={async () => {
                await loadWallet();
                await refreshUserData();
                setShowGiftModal(false);
                setGiftRecipientId(null);
              }}
            />
          </Modal.Body>
        </Modal>
      )}

      {/* Report User Modal */}
      <Modal
        show={showReportModal}
        onHide={() => {
          setShowReportModal(false);
          setReportUserId(null);
          setReportReason("");
          setMessage("");
        }}
        centered
        contentClassName="bg-dark border-light"
      >
        <Modal.Header closeButton className="border-light">
          <Modal.Title className="text-light">Report User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {message && (
            <Alert variant={message.includes("success") ? "success" : "danger"} className="mb-3">
              {message}
            </Alert>
          )}
          <Form onSubmit={handleSubmitReport}>
            <Form.Group className="mb-3">
              <Form.Label>Reason for Reporting</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Please provide a detailed reason for reporting this user..."
                required
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button
                variant="outline-light"
                className="flex-grow-1"
                onClick={() => {
                  setShowReportModal(false);
                  setReportUserId(null);
                  setReportReason("");
                  setMessage("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                className="flex-grow-1"
                disabled={reporting || !reportReason.trim()}
              >
                {reporting ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Block User Confirmation Modal */}
      <Modal
        show={showBlockConfirmModal}
        onHide={() => {
          setShowBlockConfirmModal(false);
          setBlockUserId(null);
        }}
        centered
        contentClassName="bg-dark border-light"
      >
        <Modal.Header closeButton className="border-light">
          <Modal.Title className="text-light">Block User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-light">
            Are you sure you want to block this user? You will no longer be able to see their content, 
            and they won't be able to see yours. This action can be undone later.
          </p>
          <div className="d-flex gap-2">
            <Button
              variant="outline-light"
              className="flex-grow-1"
              onClick={() => {
                setShowBlockConfirmModal(false);
                setBlockUserId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-grow-1"
              onClick={handleConfirmBlock}
              disabled={blocking}
            >
              {blocking ? "Blocking..." : "Block User"}
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Add Email Modal */}
      <Modal
        show={showAddEmailModal}
        onHide={() => {
          setShowAddEmailModal(false);
          setEmailForm({ email: "" });
          setMessage("");
        }}
        centered
        contentClassName="bg-dark border-light"
      >
        <Modal.Header closeButton className="border-light">
          <Modal.Title className="text-light">Add Email</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {message && (
            <Alert variant={message.includes("success") ? "success" : "danger"} className="mb-3">
              {message}
            </Alert>
          )}
          <Form onSubmit={handleAddEmail}>
            <Form.Group className="mb-3">
              <Form.Label>Email Address</Form.Label>
              <Form.Control
                type="email"
                value={emailForm.email}
                onChange={(e) => setEmailForm({ email: e.target.value })}
                placeholder="Enter your email"
                required
              />
              <Form.Text className="text-muted">
                You can only add an email once. It cannot be changed later.
              </Form.Text>
            </Form.Group>
            <div className="d-flex gap-2">
              <Button
                variant="outline-light"
                className="flex-grow-1"
                onClick={() => {
                  setShowAddEmailModal(false);
                  setEmailForm({ email: "" });
                  setMessage("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-grow-1"
                disabled={emailLoading || !emailForm.email.trim()}
              >
                {emailLoading ? "Adding..." : "Add Email"}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Set Password Modal */}
      <Modal
        show={showSetPasswordModal}
        onHide={() => {
          setShowSetPasswordModal(false);
          setPasswordForm({ password: "", confirmPassword: "" });
          setMessage("");
        }}
        centered
        contentClassName="bg-dark border-light"
      >
        <Modal.Header closeButton className="border-light">
          <Modal.Title className="text-light">Set Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {message && (
            <Alert variant={message.includes("success") ? "success" : "danger"} className="mb-3">
              {message}
            </Alert>
          )}
          <Form onSubmit={handleSetPassword}>
            <Form.Group className="mb-3">
              <Form.Label>New Password</Form.Label>
              <Form.Control
                type="password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                placeholder="Enter password (min 8 characters)"
                required
                minLength={8}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Confirm Password</Form.Label>
              <Form.Control
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Confirm password"
                required
                minLength={8}
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button
                variant="outline-light"
                className="flex-grow-1"
                onClick={() => {
                  setShowSetPasswordModal(false);
                  setPasswordForm({ password: "", confirmPassword: "" });
                  setMessage("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-grow-1"
                disabled={passwordLoading || !passwordForm.password || passwordForm.password !== passwordForm.confirmPassword}
              >
                {passwordLoading ? "Setting..." : "Set Password"}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        show={showChangePasswordModal}
        onHide={() => {
          setShowChangePasswordModal(false);
          setChangePasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
          setMessage("");
        }}
        centered
        contentClassName="bg-dark border-light"
      >
        <Modal.Header closeButton className="border-light">
          <Modal.Title className="text-light">Change Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {message && (
            <Alert variant={message.includes("success") ? "success" : "danger"} className="mb-3">
              {message}
            </Alert>
          )}
          <Form onSubmit={handleChangePassword}>
            <Form.Group className="mb-3">
              <Form.Label>Current Password</Form.Label>
              <Form.Control
                type="password"
                value={changePasswordForm.currentPassword}
                onChange={(e) => setChangePasswordForm({ ...changePasswordForm, currentPassword: e.target.value })}
                placeholder="Enter current password"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>New Password</Form.Label>
              <Form.Control
                type="password"
                value={changePasswordForm.newPassword}
                onChange={(e) => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
                placeholder="Enter new password (min 8 characters)"
                required
                minLength={8}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Confirm New Password</Form.Label>
              <Form.Control
                type="password"
                value={changePasswordForm.confirmPassword}
                onChange={(e) => setChangePasswordForm({ ...changePasswordForm, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                required
                minLength={8}
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button
                variant="outline-light"
                className="flex-grow-1"
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setChangePasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  setMessage("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-grow-1"
                disabled={changePasswordLoading || !changePasswordForm.currentPassword || !changePasswordForm.newPassword || changePasswordForm.newPassword !== changePasswordForm.confirmPassword}
              >
                {changePasswordLoading ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}
