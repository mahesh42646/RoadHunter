"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Badge, Spinner, Alert } from "react-bootstrap";
import { FaPhone, FaVideo, FaPhoneSlash, FaClock, FaCheck, FaTimes, FaArrowRight } from "react-icons/fa";

import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";
import useCallStore from "@/store/useCallStore";
import Avatar from "@/components/Avatar";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

export default function CallsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const { callStatus, friendId, friend, startCall, setCallStatus, setFriend, setCallId } = useCallStore();

  const [callHistory, setCallHistory] = useState([]);
  const [ongoingCalls, setOngoingCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ongoing"); // "ongoing" or "history"

  useEffect(() => {
    loadCalls();
    setupSocketListeners();
  }, []);

  const setupSocketListeners = () => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("user:join");
    });

    socket.on("call:new", () => {
      loadCalls();
    });

    socket.on("call:updated", () => {
      loadCalls();
    });

    socket.on("friend:call:incoming", async (data) => {
      // Reload calls to show new incoming call
      loadCalls();
    });

    return () => {
      socket.disconnect();
    };
  };

  const loadCalls = async () => {
    setLoading(true);
    try {
      const [historyRes, ongoingRes] = await Promise.all([
        apiClient.get("/calls/history"),
        apiClient.get("/calls/ongoing"),
      ]);

      setCallHistory(historyRes.data.calls || []);
      setOngoingCalls(ongoingRes.data.calls || []);
    } catch (error) {
      console.error("Failed to load calls:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCall = async (call) => {
    try {
      const otherUser = call.otherUser;
      if (!otherUser?._id) return;

      // Set call state
      startCall(otherUser._id, otherUser, call.isCaller);
      setCallStatus(call.status === "ringing" ? "ringing" : "connected");
      setFriend(otherUser);
      if (call._id) {
        setCallId(call._id);
      }

      // Navigate to call page
      router.push(`/dashboard/friends/call/${otherUser._id}`);
    } catch (error) {
      console.error("Failed to join call:", error);
      alert("Failed to join call");
    }
  };

  const getStatusBadge = (status, direction) => {
    const variants = {
      connected: "success",
      ringing: "warning",
      missed: "danger",
      rejected: "danger",
      ended: "secondary",
      initiated: "info",
    };

    const icons = {
      connected: <FaCheck />,
      ringing: <FaClock />,
      missed: <FaTimes />,
      rejected: <FaTimes />,
      ended: <FaCheck />,
      initiated: <FaClock />,
    };

    return (
      <Badge bg={variants[status] || "secondary"} className="d-flex align-items-center gap-1">
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div className="text-light">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Calls</h2>
        <div className="btn-group" role="group">
          <Button
            variant={activeTab === "ongoing" ? "primary" : "outline-primary"}
            onClick={() => setActiveTab("ongoing")}
          >
            Ongoing ({ongoingCalls.length})
          </Button>
          <Button
            variant={activeTab === "history" ? "primary" : "outline-primary"}
            onClick={() => setActiveTab("history")}
          >
            History ({callHistory.length})
          </Button>
        </div>
      </div>

      {activeTab === "ongoing" && (
        <div>
          {ongoingCalls.length === 0 ? (
            <Card className="bg-transparent border-light">
              <Card.Body className="text-center py-5">
                <FaPhone size={48} className="text-muted mb-3" />
                <p className="text-muted">No ongoing calls</p>
              </Card.Body>
            </Card>
          ) : (
            <div className="d-flex flex-column gap-3">
              {ongoingCalls.map((call) => (
                <Card key={call._id} className="bg-transparent border-light">
                  <Card.Body>
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-3 flex-grow-1">
                        <Avatar
                          photoUrl={call.otherUser?.account?.photoUrl}
                          name={call.otherUser?.account?.displayName}
                          email={call.otherUser?.account?.email}
                          size={60}
                          showBorder={true}
                        />
                        <div className="flex-grow-1">
                          <div className="fw-bold d-flex align-items-center gap-2">
                            {call.otherUser?.account?.displayName || "Unknown"}
                            {call.callType === "video" ? (
                              <FaVideo className="text-primary" />
                            ) : (
                              <FaPhone className="text-primary" />
                            )}
                          </div>
                          <div className="text-muted small">
                            {call.direction === "outgoing" ? "Outgoing" : "Incoming"} • {formatDate(call.startedAt)}
                          </div>
                          {getStatusBadge(call.status, call.direction)}
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        {(call.status === "ringing" || call.status === "connected") && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleJoinCall(call)}
                          >
                            <FaArrowRight className="me-2" />
                            Join
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div>
          {callHistory.length === 0 ? (
            <Card className="bg-transparent border-light">
              <Card.Body className="text-center py-5">
                <FaPhone size={48} className="text-muted mb-3" />
                <p className="text-muted">No call history</p>
              </Card.Body>
            </Card>
          ) : (
            <div className="d-flex flex-column gap-3">
              {callHistory.map((call) => (
                <Card key={call._id} className="bg-transparent border-light">
                  <Card.Body>
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-3 flex-grow-1">
                        <Avatar
                          photoUrl={call.otherUser?.account?.photoUrl}
                          name={call.otherUser?.account?.displayName}
                          email={call.otherUser?.account?.email}
                          size={60}
                          showBorder={true}
                        />
                        <div className="flex-grow-1">
                          <div className="fw-bold d-flex align-items-center gap-2">
                            {call.otherUser?.account?.displayName || "Unknown"}
                            {call.callType === "video" ? (
                              <FaVideo className="text-primary" size={14} />
                            ) : (
                              <FaPhone className="text-primary" size={14} />
                            )}
                          </div>
                          <div className="text-muted small">
                            {call.direction === "outgoing" ? "Outgoing" : "Incoming"} • {formatDate(call.startedAt)}
                            {call.duration > 0 && ` • ${formatDuration(call.duration)}`}
                          </div>
                          {getStatusBadge(call.status, call.direction)}
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            if (call.otherUser?._id) {
                              router.push(`/dashboard/friends/call/${call.otherUser._id}`);
                            }
                          }}
                        >
                          <FaPhone className="me-2" />
                          Call Again
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
