"use client";

import { useEffect, useState, useRef } from "react";
import { Card, Button, Form, InputGroup } from "react-bootstrap";
import { FaPaperPlane, FaArrowLeft } from "react-icons/fa";
import { useRouter, useParams } from "next/navigation";
import { io } from "socket.io-client";

import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://api.darkunde.in";

export default function FriendChatPage() {
  const params = useParams();
  const router = useRouter();
  const friendId = params.friendId;
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    loadFriend();
    loadMessages();
    connectSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [friendId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectSocket = () => {
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Connected to socket for friend chat");
    });

    newSocket.on("messages:new", (data) => {
      if (
        (data.message.senderId._id === friendId && data.message.receiverId._id === user._id) ||
        (data.message.senderId._id === user._id && data.message.receiverId._id === friendId)
      ) {
        setMessages((prev) => [...prev, data.message]);
      }
    });

    setSocket(newSocket);
  };

  const loadFriend = async () => {
    try {
      const response = await apiClient.get(`/friends/profile/${friendId}`);
      setFriend(response.data.user);
    } catch (error) {
      console.error("Failed to load friend:", error);
      alert("Friend not found");
      router.push("/dashboard/friends");
    }
  };

  const loadMessages = async () => {
    try {
      const response = await apiClient.get(`/messages/${friendId}`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    try {
      await apiClient.post(`/messages/${friendId}`, { message: newMessage });
      setNewMessage("");
    } catch (error) {
      alert(error.response?.data?.error || "Failed to send message");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading) {
    return <div className="text-light">Loading...</div>;
  }

  if (!friend) {
    return <div className="text-light">Friend not found</div>;
  }

  return (
    <div className="text-light d-flex flex-column" style={{ height: "calc(100vh - 200px)" }}>
      <div className="d-flex align-items-center gap-3 mb-3">
        <Button variant="outline-light" onClick={() => router.push("/dashboard/friends")}>
          <FaArrowLeft />
        </Button>
        <div className="d-flex align-items-center gap-2">
          <img
            src={friend.account?.photoUrl || "/default-avatar.png"}
            alt={friend.account?.displayName}
            className="rounded-circle"
            style={{ width: "40px", height: "40px", objectFit: "cover" }}
          />
          <div>
            <div className="fw-bold">{friend.account?.displayName || friend.account?.email}</div>
            <div className="text-muted small">Level {friend.progress?.level || 1}</div>
          </div>
        </div>
      </div>

      <Card className="bg-transparent border-light flex-grow-1 d-flex flex-column">
        <Card.Body
          ref={chatContainerRef}
          className="flex-grow-1 overflow-auto"
          style={{ maxHeight: "500px" }}
        >
          {messages.length === 0 ? (
            <div className="text-center text-muted py-5">No messages yet. Start the conversation!</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {messages.map((msg) => {
                const isOwn = msg.senderId._id === user._id || msg.senderId === user._id;
                return (
                  <div
                    key={msg._id}
                    className={`d-flex ${isOwn ? "justify-content-end" : "justify-content-start"}`}
                  >
                    <div
                      className={`p-3 rounded ${
                        isOwn ? "bg-primary text-white" : "bg-dark text-light"
                      }`}
                      style={{ maxWidth: "70%" }}
                    >
                      {!isOwn && (
                        <div className="small text-muted mb-1">
                          {typeof msg.senderId === "object" ? msg.senderId.account?.displayName : "Friend"}
                        </div>
                      )}
                      <div>{msg.message}</div>
                      <div className="small mt-1" style={{ opacity: 0.7 }}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </Card.Body>
        <Card.Footer>
          <Form onSubmit={sendMessage}>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <Button variant="primary" type="submit" disabled={!newMessage.trim()}>
                <FaPaperPlane />
              </Button>
            </InputGroup>
          </Form>
        </Card.Footer>
      </Card>
    </div>
  );
}

