"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Badge, Modal, Form, Tabs, Tab, Alert } from "react-bootstrap";
import { BsCameraVideo, BsMic, BsMicMute, BsCameraVideoOff, BsTrash, BsPencil, BsCheck, BsX } from "react-icons/bs";
import adminApiClient from "@/lib/adminApiClient";

export default function PartiesManagement({ adminToken }) {
  const [parties, setParties] = useState([]);
  const [defaultParties, setDefaultParties] = useState([]);
  const [userParties, setUserParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("default");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    botVideoUrl: "",
    botAudioUrl: "",
    botCameraEnabled: false,
    botMicEnabled: false,
    isActive: true,
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadParties();
  }, [adminToken, activeTab]);

  const loadParties = async () => {
    try {
      setLoading(true);
      const type = activeTab === "default" ? "default" : activeTab === "user" ? "user" : "all";
      const response = await adminApiClient.get(`/admin/parties?type=${type}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      
      const allParties = response.data.parties || [];
      setParties(allParties);
      
      if (activeTab === "all") {
        setDefaultParties(allParties.filter(p => p.isDefault));
        setUserParties(allParties.filter(p => !p.isDefault));
      } else if (activeTab === "default") {
        setDefaultParties(allParties);
      } else {
        setUserParties(allParties);
      }
    } catch (error) {
      console.error("Error loading parties:", error);
      setError("Failed to load parties");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (party) => {
    setEditingParty(party);
    setFormData({
      name: party.name || "",
      description: party.description || "",
      botVideoUrl: party.botVideoUrl || "",
      botAudioUrl: party.botAudioUrl || "",
      botCameraEnabled: party.botCameraEnabled || false,
      botMicEnabled: party.botMicEnabled || false,
      isActive: party.isActive !== false,
    });
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    try {
      setError(null);
      setSuccess(null);

      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
      };

      // Only include bot settings for default parties
      if (editingParty?.isDefault) {
        updateData.botVideoUrl = formData.botVideoUrl.trim() || null;
        updateData.botAudioUrl = formData.botAudioUrl.trim() || null;
        updateData.botCameraEnabled = formData.botCameraEnabled;
        updateData.botMicEnabled = formData.botMicEnabled;
      } else {
        // For user parties, allow toggling active status
        updateData.isActive = formData.isActive;
      }

      await adminApiClient.put(`/admin/parties/${editingParty._id}`, updateData, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      setSuccess("Party updated successfully");
      setShowEditModal(false);
      await loadParties();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Error updating party:", error);
      setError(error.response?.data?.error || "Failed to update party");
    }
  };

  const handleDelete = async (partyId) => {
    if (!confirm("Are you sure you want to delete this party? This action cannot be undone.")) {
      return;
    }

    try {
      await adminApiClient.delete(`/admin/parties/${partyId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setSuccess("Party deleted successfully");
      await loadParties();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Error deleting party:", error);
      setError(error.response?.data?.error || "Failed to delete party");
    }
  };

  const renderPartyTable = (partyList, isDefault = false) => {
    if (loading) {
      return (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      );
    }

    if (partyList.length === 0) {
      return (
        <Card className="border-0">
          <Card.Body className="text-center py-5">
            <p className="text-muted">No {isDefault ? "default" : "user-generated"} parties found</p>
          </Card.Body>
        </Card>
      );
    }

    return (
      <Table striped bordered hover variant="dark" responsive>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Host</th>
            <th>Participants</th>
            <th>Status</th>
            {isDefault && <th>Bot Settings</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {partyList.map((party) => (
            <tr key={party._id}>
              <td>{party.name}</td>
              <td>{party.description || "-"}</td>
              <td>{party.hostUsername || party.hostId?.account?.displayName || "Unknown"}</td>
              <td>{party.participants?.length || 0}</td>
              <td>
                <Badge bg={party.isActive ? "success" : "secondary"}>
                  {party.isActive ? "Active" : "Inactive"}
                </Badge>
                {party.isDefault && (
                  <Badge bg="info" className="ms-1">Default</Badge>
                )}
              </td>
              {isDefault && (
                <td>
                  <div className="d-flex gap-2 align-items-center">
                    <span className={party.botCameraEnabled ? "text-success" : "text-muted"}>
                      {party.botCameraEnabled ? <BsCameraVideo /> : <BsCameraVideoOff />}
                    </span>
                    <span className={party.botMicEnabled ? "text-success" : "text-muted"}>
                      {party.botMicEnabled ? <BsMic /> : <BsMicMute />}
                    </span>
                    {party.botVideoUrl && (
                      <Badge bg="primary" className="ms-1">Video</Badge>
                    )}
                    {party.botAudioUrl && (
                      <Badge bg="primary" className="ms-1">Audio</Badge>
                    )}
                  </div>
                </td>
              )}
              <td>
                <div className="d-flex gap-2">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleEdit(party)}
                  >
                    <BsPencil /> Edit
                  </Button>
                  {!isDefault && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(party._id)}
                    >
                      <BsTrash /> Delete
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Parties Management</h3>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Tabs activeKey={activeTab} onSelect={(k) => k && setActiveTab(k)} className="mb-4">
        <Tab eventKey="default" title={`Default Parties (${defaultParties.length})`}>
          <Card className="border-0 mt-3">
            <Card.Body>
              <p className="text-muted mb-3">
                Default parties are always active and never end. Configure bot camera/mic settings and pre-recorded media.
              </p>
              {renderPartyTable(defaultParties, true)}
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="user" title={`User Parties (${userParties.length})`}>
          <Card className="border-0 mt-3">
            <Card.Body>
              <p className="text-muted mb-3">
                User-generated parties. You can activate/deactivate or delete them.
              </p>
              {renderPartyTable(userParties, false)}
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="all" title={`All Parties (${parties.length})`}>
          <div className="mt-3">
            <h5 className="mb-3">Default Parties</h5>
            {renderPartyTable(defaultParties, true)}
            <h5 className="mb-3 mt-4">User Parties</h5>
            {renderPartyTable(userParties, false)}
          </div>
        </Tab>
      </Tabs>

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Party</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Party Name</Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Form.Group>

            {editingParty?.isDefault && (
              <>
                <hr />
                <h6>Bot Settings</h6>
                <Form.Group className="mb-3">
                  <Form.Label>Bot Video URL (Pre-recorded video for camera)</Form.Label>
                  <Form.Control
                    type="url"
                    placeholder="https://example.com/video.mp4"
                    value={formData.botVideoUrl}
                    onChange={(e) => setFormData({ ...formData, botVideoUrl: e.target.value })}
                  />
                  <Form.Text className="text-muted">
                    URL to a pre-recorded video file to use as bot camera output
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Bot Audio URL (Pre-recorded audio for mic)</Form.Label>
                  <Form.Control
                    type="url"
                    placeholder="https://example.com/audio.mp3"
                    value={formData.botAudioUrl}
                    onChange={(e) => setFormData({ ...formData, botAudioUrl: e.target.value })}
                  />
                  <Form.Text className="text-muted">
                    URL to a pre-recorded audio file to use as bot mic output
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    label="Bot Camera Enabled"
                    checked={formData.botCameraEnabled}
                    onChange={(e) => setFormData({ ...formData, botCameraEnabled: e.target.checked })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    label="Bot Mic Enabled"
                    checked={formData.botMicEnabled}
                    onChange={(e) => setFormData({ ...formData, botMicEnabled: e.target.checked })}
                  />
                </Form.Group>
              </>
            )}

            {!editingParty?.isDefault && (
              <>
                <hr />
                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    label="Party Active"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                </Form.Group>
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            <BsX /> Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            <BsCheck /> Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

