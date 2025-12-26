"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Card, Modal, Form, Badge, Tabs, Tab } from "react-bootstrap";

import apiClient from "@/lib/apiClient";
import useAuthStore, { selectIsAuthenticated } from "@/store/useAuthStore";
import usePartyStore from "@/store/usePartyStore";
import { getImageUrl } from "@/lib/imageUtils";

export default function HomePage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const currentPartyId = usePartyStore((state) => state.currentPartyId);
  const [parties, setParties] = useState([]);
  const [allParties, setAllParties] = useState([]); // Store all parties
  const [friends, setFriends] = useState([]); // Store friends list
  const [activeTab, setActiveTab] = useState("all"); // "all" or "friends"
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    privacy: "public",
  });
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);
  const [loginFormData, setLoginFormData] = useState({ email: "", password: "" });
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!hydrated) return;

    // Always show party list - don't auto-redirect to last party
    // User can manually click to join a party
    loadParties();
    if (isAuthenticated) {
      loadFriends();
    }

    const interval = setInterval(() => {
      loadParties();
      if (isAuthenticated) {
        loadFriends();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [hydrated, router, isAuthenticated]);

  // After login, join selected party if any
  useEffect(() => {
    if (isAuthenticated && selectedPartyId && hydrated) {
      handleJoinParty(selectedPartyId);
      setSelectedPartyId(null);
      setShowLoginModal(false);
    }
  }, [isAuthenticated, selectedPartyId, hydrated]);

  const loadParties = async () => {
    try {
      const response = await apiClient.get("/parties?privacy=public&isActive=true&limit=50");
      const partiesList = response.data.parties || [];
      setAllParties(partiesList);
      filterPartiesByTab(partiesList, activeTab, friends, isAuthenticated);
      setLoading(false);
    } catch (error) {
      // Error handled silently - show empty state
      setLoading(false);
      setAllParties([]);
      setParties([]);
    }
  };

  const loadFriends = async () => {
    try {
      const response = await apiClient.get("/friends");
      const friendsList = response.data.friends || [];
      setFriends(friendsList);
      // Re-filter parties when friends list updates
      filterPartiesByTab(allParties, activeTab, friendsList, isAuthenticated);
    } catch (error) {
      // Error handled silently
      setFriends([]);
    }
  };

  const filterPartiesByTab = (partiesList, tab, currentFriends, isAuth) => {
    if (tab === "friends") {
      if (!isAuth || !currentFriends || currentFriends.length === 0) {
        setParties([]);
        return;
      }
      
      // Get friend IDs
      const friendIds = currentFriends.map(f => f._id || f.id).filter(Boolean);
      
      // Filter parties where at least one friend is participant or host
      const filteredParties = partiesList.filter(party => {
        // Check if host is a friend
        const hostId = party.hostId?._id || party.hostId;
        const hostIsFriend = hostId && friendIds.some(fid => 
          hostId.toString() === fid.toString()
        );
        
        // Check if any participant is a friend
        const hasFriendParticipant = party.participants && party.participants.some(p => {
          const participantId = p.userId?._id || p.userId;
          return participantId && friendIds.some(fid => 
            participantId.toString() === fid.toString()
          );
        });
        
        return hostIsFriend || hasFriendParticipant;
      });
      
      setParties(filteredParties);
    } else {
      // Show all parties
      setParties(partiesList);
    }
  };

  // Update parties when tab changes
  useEffect(() => {
    if (allParties.length > 0) {
      filterPartiesByTab(allParties, activeTab, friends, isAuthenticated);
    }
  }, [activeTab, friends, isAuthenticated, allParties]);

  const handleJoinParty = async (partyId) => {
    if (!isAuthenticated) {
      // Store party ID and show login modal
      setSelectedPartyId(partyId);
      setShowLoginModal(true);
      return;
    }

    try {
      await apiClient.post(`/parties/${partyId}/join`);
      router.push(`/party/${partyId}`);
    } catch (error) {
      const errorMsg = error.response?.data?.error || "Failed to join party";
      if (errorMsg.includes("request")) {
        alert("Join request sent! Waiting for host approval...");
      } else {
        alert(errorMsg);
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const response = await apiClient.post("/auth/login", loginFormData);
      useAuthStore.getState().setAuth(response.data.token, response.data.user);
      // selectedPartyId will be handled by useEffect
    } catch (error) {
      alert(error.response?.data?.error || "Login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleCreateParty = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      setShowCreateModal(false);
      setShowLoginModal(true);
      return;
    }

    setCreating(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      if (formData.description) {
        formDataToSend.append("description", formData.description);
      }
      formDataToSend.append("privacy", formData.privacy);
      if (posterFile) {
        formDataToSend.append("poster", posterFile);
      }

      const response = await apiClient.post("/parties", formDataToSend);
      setShowCreateModal(false);
      setFormData({ name: "", description: "", privacy: "public" });
      setPosterFile(null);
      setPosterPreview(null);
      router.push(`/party/${response.data.party._id}`);
    } catch (error) {
      alert(error.response?.data?.error || "Failed to create party");
    } finally {
      setCreating(false);
    }
  };

  const handlePosterChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size must be less than 5MB");
        return;
      }
      setPosterFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPosterPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!hydrated || loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <div className="spinner-border mb-3" style={{ color: "var(--accent)" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p style={{ color: "var(--text-muted)" }}>{!hydrated ? "Loading..." : "Loading parties..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "90dvh",
        paddingTop: "0px", // Space for fixed header
        paddingBottom: "100px", // Space for footer
        background: "radial-gradient(ellipse at top, #0f1624 0%, #0a0e1a 50%, #050810 100%)",
      }}
    >
      <div className="container-fluid px-3 py-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="fw-bold mb-0" style={{ color: "var(--text-secondary)" }}>
            Partys
          </h4>
          <Button variant="primary" size="sm" onClick={() => {
            if (!isAuthenticated) {
              setShowLoginModal(true);
            } else {
              setShowCreateModal(true);
            }
          }}>
            + Create
          </Button>
        </div>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => k && setActiveTab(k)}
          className="mb-3"
          style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}
        >
          <Tab eventKey="all" title="All Partys" />
          <Tab eventKey="friends" title="Friends" disabled={!isAuthenticated} />
        </Tabs>

      <div className="row g-2">
        {parties.length === 0 ? (
          <div className="col-12">
            <Card className="glass-card border-0 text-center p-4">
              <Card.Body>
                <div className="mb-3" style={{ fontSize: "3rem" }}>🎉</div>
                <h5 className="mb-2" style={{ color: "var(--text-secondary)" }}>
                  No active parties
                </h5>
                <p className="small mb-3" style={{ color: "var(--text-muted)" }}>
                  Be the first to create a party room!
                </p>
                <Button variant="primary" size="sm" onClick={() => {
                  if (!isAuthenticated) {
                    setShowLoginModal(true);
                  } else {
                    setShowCreateModal(true);
                  }
                }}>
                  Create Party
                </Button>
              </Card.Body>
            </Card>
          </div>
        ) : (
          parties.map((party) => {
            const participants = party.participants || [];
            const topParticipants = participants.slice(0, 4);
            const host = participants.find((p) => p.role === "host") || {
              username: party.hostUsername,
              avatarUrl: party.hostAvatarUrl,
            };

            return (
              <div key={party._id} className="col-4 col-md-3 col-lg-2">
                <Card
                  className="glass-card border-0 h-100"
                  style={{
                    aspectRatio: "9/16",
                    overflow: "hidden",
                    position: "relative",
                    cursor: "pointer",
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  onClick={() => handleJoinParty(party._id)}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: party.avatarUrl
                        ? `url(${getImageUrl(party.avatarUrl)}) center/cover`
                        : "linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)",
                      opacity: 0.3,
                      zIndex: 0,
                    }}
                  />
                  <Card.Body
                    className="p-2 d-flex flex-column justify-content-between"
                    style={{ position: "relative", zIndex: 1, height: "100%" }}
                  >
                    <div>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-center gap-1">
                          <span style={{ fontSize: "0.7rem", color: "#FFD700" }}>💰</span>
                          <span
                            className="small fw-bold"
                            style={{ color: "var(--text-primary)", fontSize: "0.65rem" }}
                          >
                            {party.stats?.totalViews
                              ? (party.stats.totalViews / 1000).toFixed(1) + "K"
                              : "0"}
                          </span>
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <span style={{ fontSize: "0.7rem" }}>👥</span>
                          <span
                            className="small fw-bold"
                            style={{ color: "var(--text-primary)", fontSize: "0.65rem" }}
                          >
                            {participants.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <div className="d-flex align-items-center gap-1 mb-2">
                        <span style={{ fontSize: "0.7rem" }}>📹</span>
                        <div className="d-flex align-items-center" style={{ gap: "-4px" }}>
                          {topParticipants.map((p, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: "16px",
                                height: "16px",
                                borderRadius: "50%",
                                border: "1px solid rgba(255, 255, 255, 0.3)",
                                marginLeft: idx > 0 ? "-4px" : "0",
                                overflow: "hidden",
                                background: p.avatarUrl
                                  ? `url(${getImageUrl(p.avatarUrl)}) center/cover`
                                  : "rgba(255, 45, 149, 0.5)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.5rem",
                                color: "white",
                                fontWeight: "bold",
                              }}
                            >
                              {!p.avatarUrl && (p.username?.[0]?.toUpperCase() || "?")}
                            </div>
                          ))}
                        </div>
                      </div>
                      <p
                        className="mb-1 fw-bold small text-truncate"
                        style={{ color: "var(--text-primary)", fontSize: "0.7rem" }}
                      >
                        {party.name}
                      </p>
                      <div className="d-flex align-items-center gap-1">
                        <span style={{ fontSize: "0.6rem" }}>🇮🇳</span>
                        <span style={{ fontSize: "0.6rem" }}>👑</span>
                        <span
                          className="small"
                          style={{ color: "var(--text-muted)", fontSize: "0.6rem" }}
                        >
                          Lv{party.hostId ? "10" : "1"}
                        </span>
                        <span style={{ fontSize: "0.6rem" }}>👤</span>
                        <span
                          className="small"
                          style={{ color: "var(--text-muted)", fontSize: "0.6rem" }}
                        >
                          en
                        </span>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </div>
            );
          })
        )}
      </div>
      </div>

      {/* Login Modal */}
      <Modal
        show={showLoginModal}
        onHide={() => {
          setShowLoginModal(false);
          setSelectedPartyId(null);
          setLoginFormData({ email: "", password: "" });
        }}
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
          <Modal.Title style={{ color: "var(--text-secondary)" }}>Login Required</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleLogin}>
          <Modal.Body style={{ color: "var(--text-primary)" }}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter your email"
                value={loginFormData.email}
                onChange={(e) => setLoginFormData({ ...loginFormData, email: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter your password"
                value={loginFormData.password}
                onChange={(e) => setLoginFormData({ ...loginFormData, password: e.target.value })}
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <Button
              variant="outline-light"
              onClick={() => {
                setShowLoginModal(false);
                setSelectedPartyId(null);
                router.push("/user/login");
              }}
            >
              Go to Login Page
            </Button>
            <Button type="submit" variant="primary" disabled={loggingIn}>
              {loggingIn ? "Logging in..." : "Login"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Create Party Modal */}
      <Modal
        show={showCreateModal}
        onHide={() => {
          setShowCreateModal(false);
          setFormData({ name: "", description: "", privacy: "public" });
          setPosterFile(null);
          setPosterPreview(null);
        }}
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
          <Modal.Title style={{ color: "var(--text-secondary)" }}>Create Party Room</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateParty}>
          <Modal.Body style={{ color: "var(--text-primary)" }}>
            {!isAuthenticated && (
              <div className="alert alert-info mb-3">
                Please login to create a party. You'll be redirected to login after clicking Create.
              </div>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Party Name *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter party name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="What's this party about?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                maxLength={500}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Party Poster</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handlePosterChange}
              />
              <Form.Text className="text-muted">
                Upload a poster image for your party (max 5MB)
              </Form.Text>
              {posterPreview && (
                <div className="mt-2">
                  <Image
                    src={posterPreview}
                    alt="Poster preview"
                    width={800}
                    height={200}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      objectFit: "contain",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                    unoptimized
                  />
                </div>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Privacy</Form.Label>
              <Form.Select
                value={formData.privacy}
                onChange={(e) => setFormData({ ...formData, privacy: e.target.value })}
              >
                <option value="public">Public - Anyone can join</option>
                <option value="private">Private - Approve join requests</option>
              </Form.Select>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <Button variant="outline-light" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? "Creating..." : "Create Party"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}

