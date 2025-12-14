"use client";

import { useEffect, useState } from "react";
import { Card, Button, Row, Col, Badge } from "react-bootstrap";
import { FaCheck, FaTimes, FaUserPlus } from "react-icons/fa";

import apiClient from "@/lib/apiClient";
import { getImageUrl } from "@/lib/imageUtils";

export default function FriendRequestsPage() {
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await apiClient.get("/friends/requests");
      setSent(response.data.sent || []);
      setReceived(response.data.received || []);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (userId) => {
    try {
      await apiClient.post(`/friends/accept/${userId}`);
      await loadRequests();
      alert("Friend request accepted!");
    } catch (error) {
      alert(error.response?.data?.error || "Failed to accept request");
    }
  };

  const handleReject = async (userId) => {
    try {
      await apiClient.post(`/friends/reject/${userId}`);
      await loadRequests();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to reject request");
    }
  };

  const handleCancel = async (userId) => {
    try {
      await apiClient.delete(`/friends/${userId}`);
      await loadRequests();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to cancel request");
    }
  };

  if (loading) {
    return <div className="text-light">Loading...</div>;
  }

  return (
    <div className="text-light">
      <div className="mb-4">
        <h2 className="fw-bold">Follow Requests</h2>
        <p className="text-muted">Manage your follow requests</p>
      </div>

      <Row className="gy-4">
        <Col md={6}>
          <Card className="bg-transparent border-light">
            <Card.Header>
              <h5 className="mb-0">
                Received Follow Requests <Badge bg="primary">{received.length}</Badge>
              </h5>
            </Card.Header>
            <Card.Body>
              {received.length === 0 ? (
                <p className="text-muted text-center py-4">No pending requests</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {received.map((user) => (
                    <div
                      key={user._id}
                      className="d-flex align-items-center justify-content-between p-3 bg-dark rounded"
                    >
                      <div className="d-flex align-items-center gap-3">
                        <img
                          src={getImageUrl(user.account?.photoUrl) || "/default-avatar.png"}
                          alt={user.account?.displayName}
                          className="rounded-circle"
                          style={{ width: "50px", height: "50px", objectFit: "cover" }}
                        />
                        <div>
                          <div className="fw-bold">{user.account?.displayName || user.account?.email}</div>
                          <div className="text-muted small">
                            Level {user.progress?.level || 1} • {user.account?.email}
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleAccept(user._id)}
                        >
                          <FaCheck /> Accept
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleReject(user._id)}
                        >
                          <FaTimes /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card className="bg-transparent border-light">
            <Card.Header>
              <h5 className="mb-0">
                Sent Follow Requests <Badge bg="secondary">{sent.length}</Badge>
              </h5>
            </Card.Header>
            <Card.Body>
              {sent.length === 0 ? (
                <p className="text-muted text-center py-4">No sent requests</p>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {sent.map((user) => (
                    <div
                      key={user._id}
                      className="d-flex align-items-center justify-content-between p-3 bg-dark rounded"
                    >
                      <div className="d-flex align-items-center gap-3">
                        <img
                          src={getImageUrl(user.account?.photoUrl) || "/default-avatar.png"}
                          alt={user.account?.displayName}
                          className="rounded-circle"
                          style={{ width: "50px", height: "50px", objectFit: "cover" }}
                        />
                        <div>
                          <div className="fw-bold">{user.account?.displayName || user.account?.email}</div>
                          <div className="text-muted small">
                            Level {user.progress?.level || 1} • {user.account?.email}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => handleCancel(user._id)}
                      >
                        <FaTimes /> Cancel
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

