"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Badge, Form } from "react-bootstrap";
import adminApiClient from "@/lib/adminApiClient";

export default function UsersManagement({ adminToken }) {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, [adminToken, page, search]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await adminApiClient.get("/admin/users", {
        params: { page, search },
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setUsers(response.data.users);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBanToggle = async (userId, isBanned) => {
    try {
      await adminApiClient.put(
        `/admin/users/${userId}`,
        { isBanned: !isBanned },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      await loadUsers();
    } catch (error) {
      alert("Failed to update user");
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">User Management</h3>
        <p className="text-muted mb-0">Manage users, view statistics, and control access</p>
      </div>
      
      <Card className="glass-card">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5>Users</h5>
          <Form.Control
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: "300px" }}
          />
        </Card.Header>
        <Card.Body>
          <Table responsive>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Balance</th>
                <th>Predictions</th>
                <th>Wins</th>
                <th>Admin</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.account?.displayName || "N/A"}</td>
                  <td>{user.account?.email || "N/A"}</td>
                  <td>{user.wallet?.partyCoins?.toLocaleString() || 0}</td>
                  <td>{user.stats?.totalPredictions || 0}</td>
                  <td>{user.stats?.wins || 0}</td>
                  <td>{user.isAdmin ? <Badge bg="success">Yes</Badge> : <Badge bg="secondary">No</Badge>}</td>
                  <td>
                    {user.isBanned ? (
                      <Badge bg="danger">Banned</Badge>
                    ) : (
                      <Badge bg="success">Active</Badge>
                    )}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant={user.isBanned ? "success" : "danger"}
                      onClick={() => handleBanToggle(user._id, user.isBanned)}
                    >
                      {user.isBanned ? "Unban" : "Ban"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>Page {page} of {totalPages}</div>
            <div>
              <Button
                variant="outline-primary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline-primary"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="ms-2"
              >
                Next
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

