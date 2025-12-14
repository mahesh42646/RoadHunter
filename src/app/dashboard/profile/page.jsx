"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Card, Col, Form, Row, Button, Alert, InputGroup, Modal, Badge } from "react-bootstrap";
import { FaCamera, FaUser, FaLock, FaUnlock, FaUpload, FaTimes, FaCopy, FaCheck } from "react-icons/fa";

import useAuthStore from "@/store/useAuthStore";
import apiClient from "@/lib/apiClient";
import { getImageUrl, getInitials } from "@/lib/imageUtils";

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
  const [formData, setFormData] = useState({
    fullName: user?.account?.displayName || "",
    gender: user?.account?.gender || "",
    profilePrivacy: user?.social?.profilePrivacy || "public",
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.account?.photoUrl || "");
  const fileInputRef = useRef(null);

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

  const handleFollowersClick = () => {
    setShowFollowersModal(true);
    loadFollowers();
  };

  const handleFollowingClick = () => {
    setShowFollowingModal(true);
    loadFollowing();
  };

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
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
                  >
                    {copiedCode ? <FaCheck /> : <FaCopy />}
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

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
              {followers.map((follower) => (
                <div
                  key={follower._id}
                  className="d-flex align-items-center gap-3 p-2 rounded"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                >
                  {getImageUrl(follower.account?.photoUrl) ? (
                    <Image
                      src={getImageUrl(follower.account?.photoUrl)}
                      alt={follower.account?.displayName}
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
                      {getInitials(follower.account?.displayName || follower.account?.email || "?")}
                    </div>
                  )}
                  <div className="flex-grow-1">
                    <div className="fw-bold">{follower.account?.displayName || follower.account?.email}</div>
                    <div className="text-muted small">
                      Level {follower.progress?.level || 1}
                    </div>
                  </div>
                </div>
              ))}
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
              {following.map((follow) => (
                <div
                  key={follow._id}
                  className="d-flex align-items-center gap-3 p-2 rounded"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                >
                  {getImageUrl(follow.account?.photoUrl) ? (
                    <Image
                      src={getImageUrl(follow.account?.photoUrl)}
                      alt={follow.account?.displayName}
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
                      {getInitials(follow.account?.displayName || follow.account?.email || "?")}
                    </div>
                  )}
                  <div className="flex-grow-1">
                    <div className="fw-bold">{follow.account?.displayName || follow.account?.email}</div>
                    <div className="text-muted small">
                      Level {follow.progress?.level || 1}
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
}
