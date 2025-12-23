"use client";

import { useState, useEffect } from "react";
import { Card, Table, Button, Badge, Modal, Form, Alert, Dropdown } from "react-bootstrap";
import paymentAdminApiClient from "@/lib/paymentAdminApiClient";

export default function DepositRequestsManagement({ paymentAdminToken }) {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");

  useEffect(() => {
    loadRequests();
    loadPaymentMethods();
    const interval = setInterval(() => {
      loadRequests();
      if (selectedRequest) {
        loadChat();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedRequest, paymentAdminToken]);

  const loadRequests = async () => {
    try {
      const response = await paymentAdminApiClient.get("/deposits/payment-admin/requests", {
        headers: { Authorization: `Bearer ${paymentAdminToken}` },
      });
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await paymentAdminApiClient.get("/payment-admin/payment-methods", {
        headers: { Authorization: `Bearer ${paymentAdminToken}` },
      });
      setPaymentMethods(response.data.paymentMethods || []);
    } catch (error) {
      console.error("Failed to load payment methods:", error);
    }
  };

  const loadChat = async () => {
    if (!selectedRequest) return;
    try {
      const response = await paymentAdminApiClient.get(
        `/deposits/payment-admin/${selectedRequest._id}/chat`,
        { headers: { Authorization: `Bearer ${paymentAdminToken}` } }
      );
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error("Failed to load chat:", error);
    }
  };

  const handleSelectRequest = (request) => {
    setSelectedRequest(request);
    loadChat();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRequest || sending) return;

    setSending(true);
    try {
      await paymentAdminApiClient.post(
        `/deposits/payment-admin/${selectedRequest._id}/chat`,
        { message: newMessage },
        { headers: { Authorization: `Bearer ${paymentAdminToken}` } }
      );
      setNewMessage("");
      await loadChat();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleSendPaymentDetails = async (paymentMethodId) => {
    if (!selectedRequest) return;

    try {
      await paymentAdminApiClient.post(
        `/deposits/payment-admin/${selectedRequest._id}/send-payment-details`,
        { paymentMethodId },
        { headers: { Authorization: `Bearer ${paymentAdminToken}` } }
      );
      await loadChat();
      await loadRequests();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to send payment details");
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      await paymentAdminApiClient.post(
        `/deposits/payment-admin/${selectedRequest._id}/approve`,
        { notes: approveNotes },
        { headers: { Authorization: `Bearer ${paymentAdminToken}` } }
      );
      setShowApproveModal(false);
      setApproveNotes("");
      await loadRequests();
      await loadChat();
      setSelectedRequest(null);
    } catch (error) {
      alert(error.response?.data?.error || "Failed to approve deposit");
    }
  };

  const handleCloseRequest = async () => {
    if (!selectedRequest || !confirm("Are you sure you want to close this request?")) return;

    try {
      await paymentAdminApiClient.post(
        `/deposits/payment-admin/${selectedRequest._id}/close`,
        {},
        { headers: { Authorization: `Bearer ${paymentAdminToken}` } }
      );
      await loadRequests();
      setSelectedRequest(null);
    } catch (error) {
      alert(error.response?.data?.error || "Failed to close request");
    }
  };

  const statusColors = {
    pending: "warning",
    payment_details_sent: "info",
    payment_pending: "primary",
    approved: "success",
    rejected: "danger",
    closed: "secondary",
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div className="d-flex gap-3" style={{ height: "calc(100vh - 200px)" }}>
      {/* Requests List */}
      <Card className="glass-card" style={{ width: "350px", overflowY: "auto" }}>
        <Card.Header>
          <h5 className="mb-0">Deposit Requests</h5>
        </Card.Header>
        <Card.Body className="p-0">
          {requests.length === 0 ? (
            <div className="text-center p-4 text-muted">No active requests</div>
          ) : (
            requests.map((request) => (
              <div
                key={request._id}
                onClick={() => handleSelectRequest(request)}
                style={{
                  padding: "1rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                  cursor: "pointer",
                  background:
                    selectedRequest?._id === request._id
                      ? "rgba(255, 45, 149, 0.2)"
                      : "transparent",
                }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <strong>{request.userId?.account?.displayName || "User"}</strong>
                    <br />
                    <small className="text-muted">{request.userId?.account?.email}</small>
                  </div>
                  <Badge bg={statusColors[request.status] || "secondary"}>
                    {request.status?.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="small">
                  <div>Amount: ${request.requestedAmount}</div>
                  <div>Coins: {request.coinsToAdd?.toLocaleString()}</div>
                  <div className="text-muted">
                    {new Date(request.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </Card.Body>
      </Card>

      {/* Chat Panel */}
      {selectedRequest ? (
        <Card className="glass-card flex-grow-1" style={{ display: "flex", flexDirection: "column" }}>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0">
                {selectedRequest.userId?.account?.displayName || "User"}
              </h5>
              <small className="text-muted">
                ${selectedRequest.requestedAmount} → {selectedRequest.coinsToAdd?.toLocaleString()} coins
              </small>
            </div>
            <div className="d-flex gap-2">
              {selectedRequest.status !== "approved" && selectedRequest.status !== "closed" && (
                <>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => setShowApproveModal(true)}
                  >
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" onClick={handleCloseRequest}>
                    Close
                  </Button>
                </>
              )}
            </div>
          </Card.Header>

          <Card.Body
            style={{
              flex: 1,
              overflowY: "auto",
              background: "rgba(0, 0, 0, 0.2)",
              padding: "1rem",
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-3 ${msg.senderType === "payment_admin" ? "text-end" : ""}`}
              >
                <div
                  className={`d-inline-block p-2 rounded ${
                    msg.senderType === "payment_admin"
                      ? "bg-primary"
                      : msg.senderType === "system"
                      ? "bg-info"
                      : "bg-secondary"
                  }`}
                  style={{
                    maxWidth: "70%",
                    color: "#fff",
                    fontSize: "0.9rem",
                  }}
                >
                  <div style={{ whiteSpace: "pre-wrap" }}>{msg.message}</div>
                  <small style={{ opacity: 0.7, fontSize: "0.75rem" }}>
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </small>
                </div>
              </div>
            ))}
          </Card.Body>

          {selectedRequest.status !== "approved" && selectedRequest.status !== "closed" && (
            <Card.Footer>
              <div className="d-flex gap-2 mb-2">
                <Dropdown>
                  <Dropdown.Toggle size="sm" variant="outline-primary">
                    Send Payment Details
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {paymentMethods.length === 0 ? (
                      <Dropdown.Item disabled>No payment methods available</Dropdown.Item>
                    ) : (
                      paymentMethods.map((method) => (
                        <Dropdown.Item
                          key={method._id}
                          onClick={() => handleSendPaymentDetails(method._id)}
                        >
                          {method.name} ({method.type})
                        </Dropdown.Item>
                      ))
                    )}
                  </Dropdown.Menu>
                </Dropdown>
              </div>
              <Form onSubmit={handleSendMessage}>
                <div className="d-flex gap-2">
                  <Form.Control
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={sending}
                  />
                  <Button type="submit" variant="primary" disabled={sending || !newMessage.trim()}>
                    Send
                  </Button>
                </div>
              </Form>
            </Card.Footer>
          )}
        </Card>
      ) : (
        <Card className="glass-card flex-grow-1 d-flex align-items-center justify-content-center">
          <div className="text-center text-muted">
            <p>Select a request to view chat</p>
          </div>
        </Card>
      )}

      {/* Approve Modal */}
      <Modal show={showApproveModal} onHide={() => setShowApproveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Approve Deposit</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            This will add {selectedRequest?.coinsToAdd?.toLocaleString()} coins to the user's wallet.
          </Alert>
          <Form.Group>
            <Form.Label>Notes (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder="Add any notes about this approval..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleApprove}>
            Approve & Add Coins
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

