"use client";

import { useEffect, useState } from "react";
import { Card, Button, Badge, Row, Col, InputGroup, Form } from "react-bootstrap";
import { FaUserPlus, FaCheck, FaTimes, FaComments, FaVideo, FaGift, FaSearch } from "react-icons/fa";
import { useRouter } from "next/navigation";

import apiClient from "@/lib/apiClient";

export default function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadFriends();
    loadSuggestions();
  }, []);

  const loadFriends = async () => {
    try {
      const response = await apiClient.get("/friends");
      setFriends(response.data.friends || []);
    } catch (error) {
      console.error("Failed to load friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      const response = await apiClient.get("/friends/suggestions");
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error("Failed to load suggestions:", error);
    }
  };

  const handleFollow = async (userId) => {
    try {
      await apiClient.post(`/friends/request/${userId}`);
      await loadSuggestions();
      await loadFriends(); // Reload to update follow status
    } catch (error) {
      alert(error.response?.data?.error || "Failed to follow user");
    }
  };

  const handleRemoveFriend = async (userId) => {
    if (!confirm("Are you sure you want to remove this friend?")) return;
    try {
      await apiClient.delete(`/friends/${userId}`);
      await loadFriends();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to remove friend");
    }
  };

  const filteredFriends = friends.filter((friend) =>
    friend.account?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.account?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-light">Loading...</div>;
  }

  return (
    <div className="text-light">
      <div className="mb-4">
        <h2 className="fw-bold">Following</h2>
        <p className="text-muted">People you follow and who follow you</p>
      </div>

      <div className="mb-4">
        <InputGroup>
          <InputGroup.Text>
            <FaSearch />
          </InputGroup.Text>
          <Form.Control
            type="text"
            placeholder="Search friends..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </div>

      <Row className="gy-3 mb-4">
        <Col md={8}>
          <Card className="bg-transparent border-light">
            <Card.Header>
              <h5 className="mb-0">Following ({filteredFriends.length})</h5>
            </Card.Header>
            <Card.Body>
              {filteredFriends.length === 0 ? (
                <p className="text-muted text-center py-4">Not following anyone yet. Check suggestions below!</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {filteredFriends.map((friend) => (
                    <div
                      key={friend._id}
                      className="d-flex align-items-center justify-content-between p-3 bg-dark rounded"
                    >
                      <div className="d-flex align-items-center gap-3">
                        <img
                          src={friend.account?.photoUrl || "/default-avatar.png"}
                          alt={friend.account?.displayName}
                          className="rounded-circle"
                          style={{ width: "50px", height: "50px", objectFit: "cover" }}
                        />
                        <div>
                          <div className="fw-bold">{friend.account?.displayName || friend.account?.email}</div>
                          <div className="text-muted small">
                            Level {friend.progress?.level || 1} • {friend.account?.email}
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => router.push(`/dashboard/friends/chat/${friend._id}`)}
                        >
                          <FaComments /> Chat
                        </Button>
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => router.push(`/dashboard/friends/call/${friend._id}`)}
                        >
                          <FaVideo /> Call
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleRemoveFriend(friend._id)}
                        >
                          <FaTimes /> Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="bg-transparent border-light">
            <Card.Header>
              <h5 className="mb-0">Suggestions</h5>
            </Card.Header>
            <Card.Body>
              {suggestions.length === 0 ? (
                <p className="text-muted text-center py-4">No suggestions available</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {suggestions.slice(0, 5).map((user) => (
                    <div
                      key={user._id}
                      className="d-flex align-items-center justify-content-between p-2 bg-dark rounded"
                    >
                      <div className="d-flex align-items-center gap-2">
                        <img
                          src={user.account?.photoUrl || "/default-avatar.png"}
                          alt={user.account?.displayName}
                          className="rounded-circle"
                          style={{ width: "40px", height: "40px", objectFit: "cover" }}
                        />
                        <div>
                          <div className="small fw-bold">{user.account?.displayName || user.account?.email}</div>
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                            Level {user.progress?.level || 1}
                          </div>
                        </div>
                      </div>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleFollow(user._id)}
                        >
                          <FaUserPlus /> Follow
                        </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

