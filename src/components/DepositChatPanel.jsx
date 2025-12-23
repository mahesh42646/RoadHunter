"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, Form, Badge, Modal, Alert } from "react-bootstrap";
import apiClient from "@/lib/apiClient";

export default function DepositChatPanel({ requestId, onClose, onRequestCreated }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [request, setRequest] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (requestId) {
      loadChat();
      const interval = setInterval(loadChat, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [requestId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChat = async () => {
    if (!requestId) return;
    try {
      const [chatRes, requestsRes] = await Promise.all([
        apiClient.get(`/deposits/${requestId}/chat`),
        apiClient.get("/deposits/my-requests"),
      ]);
      setMessages(chatRes.data.messages || []);
      const req = requestsRes.data.requests?.find((r) => r._id === requestId);
      if (req) {
        setRequest(req);
        if (req.status === "approved") {
          onRequestCreated?.(); // Refresh wallet
        }
      }
    } catch (error) {
      console.error("Failed to load chat:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await apiClient.post(`/deposits/${requestId}/chat`, {
        message: newMessage,
        messageType: "text",
      });
      setNewMessage("");
      await loadChat();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = async (action) => {
    let message = "";
    let messageType = "text";

    switch (action) {
      case "pricing":
        message = "Can you please share the pricing details?";
        messageType = "pricing";
        break;
      case "payment_details":
        message = "Please share the payment details.";
        messageType = "payment_details";
        break;
      case "approval":
        message = "I have made the payment. Please verify and approve.";
        messageType = "approval_request";
        break;
      default:
        return;
    }

    setSending(true);
    try {
      await apiClient.post(`/deposits/${requestId}/chat`, {
        message,
        messageType,
      });
      await loadChat();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center p-4">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  const statusColors = {
    pending: "warning",
    payment_details_sent: "info",
    payment_pending: "primary",
    approved: "success",
    rejected: "danger",
    closed: "secondary",
  };

  return (
    <Card className="glass-card border-0" style={{ height: "600px", display: "flex", flexDirection: "column" }}>
      <Card.Header
        className="d-flex justify-content-between align-items-center"
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          background: "transparent",
        }}
      >
        <div>
          <Card.Title className="mb-0" style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>
            Deposit Request
          </Card.Title>
          {request && (
            <div className="d-flex align-items-center gap-2 mt-1">
              <Badge bg={statusColors[request.status] || "secondary"}>
                {request.status?.replace(/_/g, " ").toUpperCase()}
              </Badge>
              <span className="small" style={{ color: "var(--text-muted)" }}>
                ${request.requestedAmount} → {request.coinsToAdd?.toLocaleString()} coins
              </span>
            </div>
          )}
        </div>
        <Button variant="link" onClick={onClose} style={{ color: "var(--text-muted)", padding: 0 }}>
          ✕
        </Button>
      </Card.Header>

      <Card.Body
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          background: "rgba(0, 0, 0, 0.2)",
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-3 ${msg.senderType === "user" ? "text-end" : ""}`}
          >
            <div
              className={`d-inline-block p-2 rounded ${
                msg.senderType === "user"
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
        <div ref={messagesEndRef} />
      </Card.Body>

      {request && request.status !== "approved" && request.status !== "closed" && (
        <Card.Footer
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            background: "transparent",
          }}
        >
          <div className="d-flex gap-2 mb-2 flex-wrap">
            <Button
              size="sm"
              variant="outline-primary"
              onClick={() => handleQuickAction("pricing")}
              disabled={sending}
            >
              Request Pricing
            </Button>
            <Button
              size="sm"
              variant="outline-info"
              onClick={() => handleQuickAction("payment_details")}
              disabled={sending}
            >
              Request Payment Details
            </Button>
            <Button
              size="sm"
              variant="outline-success"
              onClick={() => handleQuickAction("approval")}
              disabled={sending}
            >
              Request Approval
            </Button>
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
  );
}

