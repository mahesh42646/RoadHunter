"use client";

import { useState, useEffect } from "react";
import { Navbar, Nav, Badge, Dropdown } from "react-bootstrap";
import { FaBell, FaUserCircle } from "react-icons/fa";
import { io } from "socket.io-client";
import Link from "next/link";

import useAuthStore from "@/store/useAuthStore";
import apiClient from "@/lib/apiClient";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5030";

export default function DashboardHeader() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      newSocket.emit("user:join");
    });

    newSocket.on("friends:requestReceived", (data) => {
      setNotifications((prev) => [
        {
          id: Date.now(),
          type: "follow_request",
          message: `${data.fromUser?.displayName || "Someone"} wants to follow you`,
          userId: data.fromUserId,
          read: false,
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setUnreadCount((prev) => prev + 1);
    });

    newSocket.on("friends:followed", (data) => {
      setNotifications((prev) => [
        {
          id: Date.now(),
          type: "follow",
          message: `${data.follower?.displayName || "Someone"} started following you`,
          userId: data.userId,
          read: false,
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setUnreadCount((prev) => prev + 1);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <Navbar
      bg="transparent"
      variant="dark"
      className="border-bottom border-light border-opacity-25 mb-4"
      style={{ padding: "1rem 0" }}
    >
      <div className="d-flex justify-content-between align-items-center w-100">
        <div className="d-flex align-items-center gap-3">
          <Link href="/dashboard/profile" className="text-decoration-none">
            <div className="d-flex align-items-center gap-2">
              {user?.account?.photoUrl ? (
                <img
                  src={user.account.photoUrl}
                  alt={user.account.displayName}
                  className="rounded-circle"
                  style={{ width: "40px", height: "40px", objectFit: "cover" }}
                />
              ) : (
                <FaUserCircle size={40} color="#FF2D95" />
              )}
              <div>
                <div className="text-light fw-bold">
                  {user?.account?.displayName || user?.account?.email || "User"}
                </div>
                <div className="text-muted small">
                  {user?.social?.followers?.length || 0} followers • {user?.social?.following?.length || 0} following
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="d-flex align-items-center gap-3">
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="transparent"
              className="position-relative border-0 p-2"
              style={{ color: "#FFFFFF" }}
            >
              <FaBell size={20} />
              {unreadCount > 0 && (
                <Badge
                  bg="danger"
                  className="position-absolute top-0 start-100 translate-middle rounded-pill"
                  style={{ fontSize: "0.7rem", minWidth: "18px", height: "18px" }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Dropdown.Toggle>

            <Dropdown.Menu
              style={{
                backgroundColor: "#1A1F2E",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                minWidth: "300px",
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              <div className="d-flex justify-content-between align-items-center p-2 border-bottom border-light border-opacity-25">
                <Dropdown.ItemText className="text-light fw-bold">Notifications</Dropdown.ItemText>
                {unreadCount > 0 && (
                  <button
                    className="btn btn-sm text-primary border-0 bg-transparent"
                    onClick={markAllAsRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <Dropdown.ItemText className="text-muted text-center py-3">
                  No notifications
                </Dropdown.ItemText>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <Dropdown.Item
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    style={{
                      backgroundColor: notification.read ? "transparent" : "rgba(255, 45, 149, 0.1)",
                      color: "#FFFFFF",
                    }}
                    className="py-2"
                  >
                    <div className="small">{notification.message}</div>
                    <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                      {new Date(notification.createdAt).toLocaleString()}
                    </div>
                  </Dropdown.Item>
                ))
              )}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>
    </Navbar>
  );
}

