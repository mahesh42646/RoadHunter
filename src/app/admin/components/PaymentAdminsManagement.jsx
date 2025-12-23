"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Badge, Form, Modal, Alert } from "react-bootstrap";
import adminApiClient from "@/lib/adminApiClient";

export default function PaymentAdminsManagement({ adminToken }) {
  const [paymentAdmins, setPaymentAdmins] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPaymentAdmin, setSelectedPaymentAdmin] = useState(null);
  const [formData, setFormData] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadPaymentAdmins();
  }, [adminToken, page, search]);

  const loadPaymentAdmins = async () => {
    setLoading(true);
    try {
      const response = await adminApiClient.get("/admin/payment-admins", {
        params: { page, search },
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setPaymentAdmins(response.data.paymentAdmins);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Error loading payment admins:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setError("");
    setSuccess("");
    try {
      const response = await adminApiClient.post(
        "/admin/payment-admins",
        formData,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      setSuccess(`Payment administrator created successfully! Email: ${formData.email}, Password: ${formData.password}`);
      setFormData({ email: "", password: "", name: "" });
      setShowCreateModal(false);
      await loadPaymentAdmins();
      setTimeout(() => setSuccess(""), 5000);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to create payment administrator");
    }
  };

  const handleEdit = async () => {
    setError("");
    setSuccess("");
    try {
      const updateData = {
        name: formData.name,
        isActive: formData.isActive,
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      await adminApiClient.put(
        `/admin/payment-admins/${selectedPaymentAdmin._id}`,
        updateData,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      setSuccess("Payment administrator updated successfully!");
      setFormData({ email: "", password: "", name: "" });
      setShowEditModal(false);
      setSelectedPaymentAdmin(null);
      await loadPaymentAdmins();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to update payment administrator");
    }
  };

  const handleDelete = async () => {
    setError("");
    try {
      await adminApiClient.delete(
        `/admin/payment-admins/${selectedPaymentAdmin._id}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      setShowDeleteModal(false);
      setSelectedPaymentAdmin(null);
      await loadPaymentAdmins();
    } catch (error) {
      setError(error.response?.data?.error || "Failed to delete payment administrator");
    }
  };

  const openEditModal = (paymentAdmin) => {
    setSelectedPaymentAdmin(paymentAdmin);
    setFormData({
      email: paymentAdmin.email,
      password: "",
      name: paymentAdmin.name,
      isActive: paymentAdmin.isActive,
    });
    setError("");
    setShowEditModal(true);
  };

  const openDeleteModal = (paymentAdmin) => {
    setSelectedPaymentAdmin(paymentAdmin);
    setError("");
    setShowDeleteModal(true);
  };

  const handleActiveToggle = async (paymentAdmin) => {
    try {
      await adminApiClient.put(
        `/admin/payment-admins/${paymentAdmin._id}`,
        { isActive: !paymentAdmin.isActive },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      await loadPaymentAdmins();
    } catch (error) {
      alert("Failed to update payment administrator status");
    }
  };

  if (loading && paymentAdmins.length === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Payment Administrators Management</h3>
        <p className="text-muted mb-0">Create and manage payment administrator accounts</p>
      </div>

      {success && (
        <Alert variant="success" onClose={() => setSuccess("")} dismissible>
          {success}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}

      <Card className="glass-card">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5>Payment Administrators</h5>
          <div className="d-flex gap-2">
            <Form.Control
              type="text"
              placeholder="Search payment admins..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ width: "300px" }}
            />
            <Button
              variant="primary"
              onClick={() => {
                setFormData({ email: "", password: "", name: "" });
                setError("");
                setShowCreateModal(true);
              }}
            >
              Create Payment Admin
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0 glass-card">
          <div className="table-responsive">
            <Table
              responsive
              hover
              striped
              bordered
              variant="dark"
              className="mb-0 text-white"
            >
              <thead className="text-uppercase small">
                <tr className="text-center">
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentAdmins.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4">
                      No payment administrators found
                    </td>
                  </tr>
                ) : (
                  paymentAdmins.map((paymentAdmin) => (
                    <tr key={paymentAdmin._id} className="text-center">
                      <td className="fw-semibold">{paymentAdmin.name}</td>
                      <td>{paymentAdmin.email}</td>
                      <td>
                        {paymentAdmin.isActive ? (
                          <Badge bg="success">Active</Badge>
                        ) : (
                          <Badge bg="danger">Inactive</Badge>
                        )}
                      </td>
                      <td>
                        {paymentAdmin.lastLogin
                          ? new Date(paymentAdmin.lastLogin).toLocaleString()
                          : "Never"}
                      </td>
                      <td>
                        {new Date(paymentAdmin.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="d-flex gap-2 justify-content-center">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => openEditModal(paymentAdmin)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={paymentAdmin.isActive ? "warning" : "success"}
                            onClick={() => handleActiveToggle(paymentAdmin)}
                          >
                            {paymentAdmin.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openDeleteModal(paymentAdmin)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-3 p-3 text-white">
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

      {/* Create Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Payment Administrator</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
              <Form.Text className="text-muted">Minimum 6 characters</Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            Create
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Payment Administrator</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={formData.email}
                disabled
                style={{ backgroundColor: "#2a2a2a", color: "#999" }}
              />
              <Form.Text className="text-muted">Email cannot be changed</Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>New Password (leave blank to keep current)</Form.Label>
              <Form.Control
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={6}
              />
              <Form.Text className="text-muted">Minimum 6 characters</Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                label="Active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleEdit}>
            Update
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Payment Administrator</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p>
            Are you sure you want to delete payment administrator{" "}
            <strong>{selectedPaymentAdmin?.name}</strong> ({selectedPaymentAdmin?.email})?
          </p>
          <p className="text-danger">This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

