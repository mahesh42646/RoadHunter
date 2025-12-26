"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Badge, Modal, Form, Tabs, Tab, Alert, ListGroup } from "react-bootstrap";
import { BsCameraVideo, BsMic, BsMicMute, BsCameraVideoOff, BsTrash, BsPencil, BsCheck, BsX, BsPlus, BsEye } from "react-icons/bs";
import adminApiClient from "@/lib/adminApiClient";

export default function PartiesManagement({ adminToken }) {
  const [parties, setParties] = useState([]);
  const [defaultParties, setDefaultParties] = useState([]);
  const [userParties, setUserParties] = useState([]);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("default");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [viewingParty, setViewingParty] = useState(null);
  const [partyDetails, setPartyDetails] = useState(null);
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    botHostId: "",
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
    loadBots();
  }, [adminToken, activeTab]);

  const loadBots = async () => {
    try {
      const response = await adminApiClient.get(`/admin/bots`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setBots(response.data.bots || []);
    } catch (error) {
      console.error("Error loading bots:", error);
    }
  };

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
      botHostId: party.botHostId?._id || party.botHostId || "",
      botVideoUrl: party.botVideoUrl || "",
      botAudioUrl: party.botAudioUrl || "",
      botCameraEnabled: party.botCameraEnabled || false,
      botMicEnabled: party.botMicEnabled || false,
      isActive: party.isActive !== false,
    });
    setPosterFile(null);
    setPosterPreview(null);
    setShowEditModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleViewDetails = async (party) => {
    try {
      setViewingParty(party);
      setLoading(true);
      const response = await adminApiClient.get(`/admin/parties/${party._id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setPartyDetails(response.data.party);
      setShowDetailsModal(true);
    } catch (error) {
      console.error("Error loading party details:", error);
      setError("Failed to load party details");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingParty(null);
    setFormData({
      name: "",
      description: "",
      botHostId: "",
      botVideoUrl: "",
      botAudioUrl: "",
      botCameraEnabled: false,
      botMicEnabled: false,
      isActive: true,
    });
    setPosterFile(null);
    setPosterPreview(null);
    setShowCreateModal(true);
    setError(null);
    setSuccess(null);
  };

  const handlePosterChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }
      setPosterFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPosterPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setError(null);
      setSuccess(null);

      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name.trim());
      formDataToSend.append("description", formData.description.trim());

      // Only include bot settings for default parties
      if (editingParty?.isDefault || !editingParty) {
        if (formData.botHostId) formDataToSend.append("botHostId", formData.botHostId);
        formDataToSend.append("botVideoUrl", formData.botVideoUrl.trim() || "");
        formDataToSend.append("botAudioUrl", formData.botAudioUrl.trim() || "");
        formDataToSend.append("botCameraEnabled", formData.botCameraEnabled);
        formDataToSend.append("botMicEnabled", formData.botMicEnabled);
      } else {
        // For user parties, allow toggling active status
        formDataToSend.append("isActive", formData.isActive);
      }

      // Add poster file if selected
      if (posterFile) {
        formDataToSend.append("poster", posterFile);
      }

      if (editingParty) {
        // Update existing party
        await adminApiClient.put(`/admin/parties/${editingParty._id}`, formDataToSend, {
          headers: { 
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        setSuccess("Party updated successfully");
        setShowEditModal(false);
      } else {
        // Create new party
        await adminApiClient.post(`/admin/parties`, formDataToSend, {
          headers: { 
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'multipart/form-data',
          },
        });
        setSuccess("Default party created successfully");
        setShowCreateModal(false);
      }

      await loadParties();
      setPosterFile(null);
      setPosterPreview(null);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Error saving party:", error);
      setError(error.response?.data?.error || "Failed to save party");
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
        {activeTab === "default" && (
          <Button variant="primary" onClick={handleCreate}>
            <BsPlus /> Create Default Party
          </Button>
        )}
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

            {(editingParty?.isDefault || !editingParty) && (
              <>
                <hr />
                <h6>Bot Settings</h6>
                {!editingParty && (
                  <Form.Group className="mb-3">
                    <Form.Label>Bot Host *</Form.Label>
                    <Form.Select
                      value={formData.botHostId}
                      onChange={(e) => setFormData({ ...formData, botHostId: e.target.value })}
                      required
                    >
                      <option value="">Select a bot</option>
                      {bots.map((bot) => (
                        <option key={bot._id} value={bot._id}>
                          {bot.name} ({bot.username})
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                )}
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
          <Button variant="secondary" onClick={() => {
            setShowEditModal(false);
            setShowCreateModal(false);
            setPosterFile(null);
            setPosterPreview(null);
          }}>
            <BsX /> Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            <BsCheck /> {editingParty ? "Save Changes" : "Create Party"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Create Party Modal */}
      <Modal show={showCreateModal} onHide={() => {
        setShowCreateModal(false);
        setPosterFile(null);
        setPosterPreview(null);
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create Default Party</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Party Name *</Form.Label>
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

            <Form.Group className="mb-3">
              <Form.Label>Party Poster</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handlePosterChange}
              />
              <Form.Text className="text-muted">
                Upload a poster image for the party (max 5MB)
              </Form.Text>
              {posterPreview && (
                <div className="mt-2">
                  <img
                    src={posterPreview}
                    alt="Poster preview"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "200px",
                      objectFit: "contain",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  />
                </div>
              )}
            </Form.Group>

            <hr />
            <h6>Bot Settings</h6>
            <Form.Group className="mb-3">
              <Form.Label>Bot Host *</Form.Label>
              <Form.Select
                value={formData.botHostId}
                onChange={(e) => setFormData({ ...formData, botHostId: e.target.value })}
                required
              >
                <option value="">Select a bot</option>
                {bots.map((bot) => (
                  <option key={bot._id} value={bot._id}>
                    {bot.name} ({bot.username})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Bot Video URL (Pre-recorded video for camera)</Form.Label>
              <Form.Control
                type="url"
                placeholder="https://example.com/video.mp4"
                value={formData.botVideoUrl}
                onChange={(e) => setFormData({ ...formData, botVideoUrl: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Bot Audio URL (Pre-recorded audio for mic)</Form.Label>
              <Form.Control
                type="url"
                placeholder="https://example.com/audio.mp3"
                value={formData.botAudioUrl}
                onChange={(e) => setFormData({ ...formData, botAudioUrl: e.target.value })}
              />
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
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowCreateModal(false);
            setPosterFile(null);
            setPosterPreview(null);
          }}>
            <BsX /> Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            <BsCheck /> Create Party
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Party Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Party Details: {viewingParty?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : partyDetails ? (
            <div>
              <Card className="mb-3">
                <Card.Body>
                  <h6>Basic Information</h6>
                  <p><strong>Name:</strong> {partyDetails.name}</p>
                  <p><strong>Description:</strong> {partyDetails.description || "N/A"}</p>
                  <p><strong>Host:</strong> {partyDetails.hostUsername || partyDetails.hostId?.account?.displayName || "Unknown"}</p>
                  <p><strong>Status:</strong> 
                    <Badge bg={partyDetails.isActive ? "success" : "secondary"} className="ms-2">
                      {partyDetails.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {partyDetails.isDefault && (
                      <Badge bg="info" className="ms-2">Default</Badge>
                    )}
                  </p>
                  <p><strong>Started:</strong> {new Date(partyDetails.startedAt).toLocaleString()}</p>
                  {partyDetails.stats?.duration !== undefined && (
                    <p><strong>Duration:</strong> {Math.floor(partyDetails.stats.duration / 60)}h {partyDetails.stats.duration % 60}m</p>
                  )}
                </Card.Body>
              </Card>

              <Card className="mb-3">
                <Card.Body>
                  <h6>Participants ({partyDetails.stats?.activeParticipants || 0} active / {partyDetails.stats?.totalParticipants || 0} total)</h6>
                  <ListGroup variant="flush">
                    {partyDetails.participants?.slice(0, 10).map((p, idx) => (
                      <ListGroup.Item key={idx} className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{p.username || p.userId?.account?.displayName || "Unknown"}</strong>
                          {p.role === "host" && <Badge bg="warning" className="ms-2">Host</Badge>}
                          <Badge bg={p.status === "active" ? "success" : p.status === "muted" ? "warning" : "secondary"} className="ms-2">
                            {p.status}
                          </Badge>
                        </div>
                      </ListGroup.Item>
                    ))}
                    {(!partyDetails.participants || partyDetails.participants.length === 0) && (
                      <ListGroup.Item className="text-muted">No participants</ListGroup.Item>
                    )}
                  </ListGroup>
                </Card.Body>
              </Card>

              <Card className="mb-3">
                <Card.Body>
                  <h6>Chat Statistics</h6>
                  <p><strong>Total Messages:</strong> {partyDetails.stats?.chatStats?.totalMessages || 0}</p>
                  {partyDetails.stats?.chatStats?.recentMessages && partyDetails.stats.chatStats.recentMessages.length > 0 && (
                    <div className="mt-3">
                      <strong>Recent Messages:</strong>
                      <ListGroup variant="flush" className="mt-2">
                        {partyDetails.stats.chatStats.recentMessages.slice(-5).map((msg, idx) => (
                          <ListGroup.Item key={idx}>
                            <strong>{msg.username}:</strong> {msg.message}
                            <small className="text-muted ms-2">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </small>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </div>
                  )}
                </Card.Body>
              </Card>

              {partyDetails.stats?.giftStats && (
                <Card className="mb-3">
                  <Card.Body>
                    <h6>Gift Statistics</h6>
                    <p><strong>Total Gifts:</strong> {partyDetails.stats.giftStats.total}</p>
                    <p><strong>Total Value:</strong> {partyDetails.stats.giftStats.totalValue || 0} coins</p>
                  </Card.Body>
                </Card>
              )}

              <Card className="mb-3">
                <Card.Body>
                  <h6>Party Statistics</h6>
                  <p><strong>Total Views:</strong> {partyDetails.stats?.totalViews || 0}</p>
                  <p><strong>Peak Participants:</strong> {partyDetails.stats?.peakParticipants || 0}</p>
                  {partyDetails.stats?.joinRequestStats && (
                    <>
                      <p><strong>Join Requests:</strong> {partyDetails.stats.joinRequestStats.total} total</p>
                      <p className="small text-muted">
                        Pending: {partyDetails.stats.joinRequestStats.pending} | 
                        Approved: {partyDetails.stats.joinRequestStats.approved} | 
                        Rejected: {partyDetails.stats.joinRequestStats.rejected}
                      </p>
                    </>
                  )}
                </Card.Body>
              </Card>

              {partyDetails.isDefault && (
                <Card>
                  <Card.Body>
                    <h6>Bot Settings</h6>
                    <p><strong>Bot:</strong> {partyDetails.botHostId?.name || "N/A"}</p>
                    <p><strong>Camera:</strong> {partyDetails.botCameraEnabled ? "Enabled" : "Disabled"}</p>
                    <p><strong>Mic:</strong> {partyDetails.botMicEnabled ? "Enabled" : "Disabled"}</p>
                    {partyDetails.botVideoUrl && <p><strong>Video URL:</strong> <a href={partyDetails.botVideoUrl} target="_blank" rel="noopener noreferrer">{partyDetails.botVideoUrl}</a></p>}
                    {partyDetails.botAudioUrl && <p><strong>Audio URL:</strong> <a href={partyDetails.botAudioUrl} target="_blank" rel="noopener noreferrer">{partyDetails.botAudioUrl}</a></p>}
                  </Card.Body>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center text-muted">Failed to load party details</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

