"use client";

import { useState, useEffect } from "react";
import { Card, Table, Button, Badge, Modal, Form, Alert } from "react-bootstrap";
import adminApiClient from "@/lib/adminApiClient";

export default function PaymentMethodsManagement({ adminToken }) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "upi",
    details: {},
    isActive: true,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    loadPaymentMethods();
  }, [adminToken]);

  const loadPaymentMethods = async () => {
    setLoading(true);
    try {
      const response = await adminApiClient.get("/admin/payment-methods", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setPaymentMethods(response.data.paymentMethods || []);
    } catch (error) {
      console.error("Failed to load payment methods:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setError("");
    try {
      await adminApiClient.post(
        "/admin/payment-methods",
        formData,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      setShowCreateModal(false);
      setFormData({ name: "", type: "upi", details: {}, isActive: true });
      await loadPaymentMethods();
    } catch (error) {
      setError(error.response?.data?.error || "Failed to create payment method");
    }
  };

  const handleEdit = async () => {
    setError("");
    try {
      await adminApiClient.put(
        `/admin/payment-methods/${selectedMethod._id}`,
        formData,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      setShowEditModal(false);
      setSelectedMethod(null);
      setFormData({ name: "", type: "upi", details: {}, isActive: true });
      await loadPaymentMethods();
    } catch (error) {
      setError(error.response?.data?.error || "Failed to update payment method");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this payment method?")) return;

    try {
      await adminApiClient.delete(`/admin/payment-methods/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      await loadPaymentMethods();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to delete payment method");
    }
  };

  const openEditModal = (method) => {
    setSelectedMethod(method);
    setFormData({
      name: method.name,
      type: method.type,
      details: method.details || {},
      isActive: method.isActive,
    });
    setError("");
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Payment Methods Management</h3>
        <p className="text-muted mb-0">Manage payment methods that payment admins can use</p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="glass-card">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5>Payment Methods</h5>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            Add Payment Method
          </Button>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover variant="dark" className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Details</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    No payment methods found
                  </td>
                </tr>
              ) : (
                paymentMethods.map((method) => (
                  <tr key={method._id}>
                    <td>{method.name}</td>
                    <td>
                      <Badge bg="info">{method.type}</Badge>
                    </td>
                    <td>
                      <small>
                        {method.type === "upi" && method.details.upiId && `UPI: ${method.details.upiId}`}
                        {method.type === "bank_transfer" &&
                          method.details.accountNumber &&
                          `Account: ${method.details.accountNumber}`}
                        {method.type === "qr_code" && "QR Code available"}
                        {method.type === "wallet" && method.details.walletNumber && `Wallet: ${method.details.walletNumber}`}
                      </small>
                    </td>
                    <td>
                      {method.isActive ? (
                        <Badge bg="success">Active</Badge>
                      ) : (
                        <Badge bg="secondary">Inactive</Badge>
                      )}
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button size="sm" variant="primary" onClick={() => openEditModal(method)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(method._id)}
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
        </Card.Body>
      </Card>

      {/* Create Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add Payment Method</Modal.Title>
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
                placeholder="e.g., UPI Payment, Bank Transfer"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              <Form.Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value, details: {} })}
              >
                <option value="upi">UPI</option>
                <option value="qr_code">QR Code</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="wallet">Wallet</option>
                <option value="other">Other</option>
              </Form.Select>
            </Form.Group>

            {formData.type === "upi" && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>UPI ID</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.upiId || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, upiId: e.target.value },
                      })
                    }
                    placeholder="yourname@upi"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>QR Code URL (optional)</Form.Label>
                  <Form.Control
                    type="url"
                    value={formData.details.qrCodeUrl || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, qrCodeUrl: e.target.value },
                      })
                    }
                    placeholder="https://..."
                  />
                </Form.Group>
              </>
            )}

            {formData.type === "qr_code" && (
              <Form.Group className="mb-3">
                <Form.Label>QR Code URL</Form.Label>
                <Form.Control
                  type="url"
                  value={formData.details.qrCodeUrl || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: { ...formData.details, qrCodeUrl: e.target.value },
                    })
                  }
                  placeholder="https://..."
                  required
                />
              </Form.Group>
            )}

            {formData.type === "bank_transfer" && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Account Number</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.accountNumber || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, accountNumber: e.target.value },
                      })
                    }
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>IFSC Code</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.ifscCode || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, ifscCode: e.target.value },
                      })
                    }
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Bank Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.bankName || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, bankName: e.target.value },
                      })
                    }
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Account Holder Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.accountHolderName || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, accountHolderName: e.target.value },
                      })
                    }
                    required
                  />
                </Form.Group>
              </>
            )}

            {formData.type === "wallet" && (
              <Form.Group className="mb-3">
                <Form.Label>Wallet Number</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.details.walletNumber || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: { ...formData.details, walletNumber: e.target.value },
                    })
                  }
                  required
                />
              </Form.Group>
            )}

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
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            Create
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Payment Method</Modal.Title>
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
              <Form.Label>Type</Form.Label>
              <Form.Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value, details: {} })}
              >
                <option value="upi">UPI</option>
                <option value="qr_code">QR Code</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="wallet">Wallet</option>
                <option value="other">Other</option>
              </Form.Select>
            </Form.Group>

            {/* Same form fields as create modal */}
            {formData.type === "upi" && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>UPI ID</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.upiId || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, upiId: e.target.value },
                      })
                    }
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>QR Code URL (optional)</Form.Label>
                  <Form.Control
                    type="url"
                    value={formData.details.qrCodeUrl || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, qrCodeUrl: e.target.value },
                      })
                    }
                  />
                </Form.Group>
              </>
            )}

            {formData.type === "qr_code" && (
              <Form.Group className="mb-3">
                <Form.Label>QR Code URL</Form.Label>
                <Form.Control
                  type="url"
                  value={formData.details.qrCodeUrl || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: { ...formData.details, qrCodeUrl: e.target.value },
                    })
                  }
                  required
                />
              </Form.Group>
            )}

            {formData.type === "bank_transfer" && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Account Number</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.accountNumber || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, accountNumber: e.target.value },
                      })
                    }
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>IFSC Code</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.ifscCode || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, ifscCode: e.target.value },
                      })
                    }
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Bank Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.bankName || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, bankName: e.target.value },
                      })
                    }
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Account Holder Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.details.accountHolderName || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        details: { ...formData.details, accountHolderName: e.target.value },
                      })
                    }
                    required
                  />
                </Form.Group>
              </>
            )}

            {formData.type === "wallet" && (
              <Form.Group className="mb-3">
                <Form.Label>Wallet Number</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.details.walletNumber || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      details: { ...formData.details, walletNumber: e.target.value },
                    })
                  }
                  required
                />
              </Form.Group>
            )}

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
    </div>
  );
}

