"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Col, Form, Row, Button, Alert, InputGroup } from "react-bootstrap";
import { FaCamera, FaUser, FaLock, FaUnlock, FaUpload } from "react-icons/fa";

import useAuthStore from "@/store/useAuthStore";
import apiClient from "@/lib/apiClient";

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    fullName: user?.account?.displayName || "",
    gender: user?.account?.gender || "",
    profilePrivacy: user?.social?.profilePrivacy || "public",
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.account?.photoUrl || "");
  const fileInputRef = useRef(null);

  const isProfileComplete = user?.account?.profileCompleted;

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

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setMessage("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image size must be less than 5MB");
      return;
    }

    setPhotoFile(file);
    // Create preview
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
      setMessage("Profile completed successfully!");
      
      // Refresh user data
      const meResponse = await apiClient.get("/users/me");
      updateUser(meResponse.data.user);
      
      // Reset form
      setPhotoFile(null);
    } catch (error) {
      setMessage(error.response?.data?.error || "Failed to complete profile");
    } finally {
      setLoading(false);
    }
  };

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

  // Show Instagram-like profile view
  return (
    <div className="text-light">
      <Card className="bg-transparent border-0 mb-4">
        <Card.Body>
          <Row className="align-items-center">
            <Col xs={12} md={4} className="text-center text-md-start mb-4 mb-md-0">
              <div className="position-relative d-inline-block">
                <img
                  src={user?.account?.photoUrl || "/default-avatar.png"}
                  alt={user?.account?.displayName}
                  className="rounded-circle"
                  style={{
                    width: "150px",
                    height: "150px",
                    objectFit: "cover",
                    border: "3px solid #FF2D95",
                  }}
                />
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
              <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-3 mb-3">
                <h2 className="mb-0 fw-bold">{user?.account?.displayName || "User"}</h2>
                <Button
                  variant="outline-light"
                  size="sm"
                  onClick={() => {
                    // Navigate to edit or show edit modal
                    window.location.href = "/dashboard/profile?edit=true";
                  }}
                >
                  Edit Profile
                </Button>
                <Button variant="outline-light" size="sm">
                  View Archive
                </Button>
                <Button variant="outline-light" size="sm">
                  <FaCamera /> Settings
                </Button>
              </div>

              <div className="d-flex gap-4 mb-3">
                <div>
                  <strong>0</strong> posts
                </div>
                <div>
                  <strong>{user?.social?.followers?.length || 0}</strong> followers
                </div>
                <div>
                  <strong>{user?.social?.following?.length || 0}</strong> following
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

      {/* Profile stats and content would go here */}
      <Card className="bg-transparent border-light">
        <Card.Body>
          <div className="text-center text-muted py-5">
            <p>Your posts and activity will appear here</p>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
