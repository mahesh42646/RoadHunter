"use client";

import { useEffect, useState, useRef } from "react";
import { Card, Button, Badge, Modal, Form, Alert, Row, Col } from "react-bootstrap";
import { BsPlusCircle, BsPencil, BsTrash, BsImage, BsTrophy, BsPeople, BsCoin, BsX } from "react-icons/bs";
import Image from "next/image";
import adminApiClient from "@/lib/adminApiClient";
import { getImageUrl } from "@/lib/imageUtils";

export default function GameManagement({ adminToken }) {
  const [cars, setCars] = useState([]);
  const [showCarModal, setShowCarModal] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [carForm, setCarForm] = useState({
    name: "",
    topViewImage: "",
    sideViewImage: "",
    speedRegular: "",
    speedDesert: "",
    speedMuddy: "",
    isActive: true,
  });
  const [topViewFile, setTopViewFile] = useState(null);
  const [sideViewFile, setSideViewFile] = useState(null);
  const [topViewPreview, setTopViewPreview] = useState(null);
  const [sideViewPreview, setSideViewPreview] = useState(null);
  const topViewInputRef = useRef(null);
  const sideViewInputRef = useRef(null);
  const [formErrors, setFormErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({ top: false, side: false });

  useEffect(() => {
    loadCars();
  }, [adminToken]);

  const loadCars = async () => {
    setLoading(true);
    try {
      const response = await adminApiClient.get("/admin/cars", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setCars(response.data.cars || []);
    } catch (error) {
      console.error("Error loading cars:", error);
      setError("Failed to load cars");
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file, type) => {
    const formData = new FormData();
    formData.append("image", file);
    
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const response = await adminApiClient.post("/admin/cars/upload", formData, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          // Don't set Content-Type - let axios set it automatically with boundary
        },
      });
      if (!response.data || !response.data.imageUrl) {
        throw new Error("Invalid response from server");
      }
      return response.data.imageUrl;
    } catch (error) {
      console.error(`Error uploading ${type} image:`, error);
      const errorMessage = error.response?.data?.error || 
                          error.message || 
                          `Failed to upload ${type} image. Please try again.`;
      throw new Error(errorMessage);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleImageChange = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // No validations - accept any file type and size
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "top") {
        setTopViewPreview(reader.result);
        setTopViewFile(file);
      } else {
        setSideViewPreview(reader.result);
        setSideViewFile(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (type) => {
    if (type === "top") {
      setTopViewFile(null);
      setTopViewPreview(null);
      setCarForm(prev => ({ ...prev, topViewImage: "" }));
      if (topViewInputRef.current) topViewInputRef.current.value = "";
    } else {
      setSideViewFile(null);
      setSideViewPreview(null);
      setCarForm(prev => ({ ...prev, sideViewImage: "" }));
      if (sideViewInputRef.current) sideViewInputRef.current.value = "";
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!carForm.name || carForm.name.trim().length < 3 || carForm.name.trim().length > 30) {
      errors.name = "Car name must be between 3 and 30 characters";
    }
    
    if (!carForm.topViewImage && !topViewFile) {
      errors.topViewImage = "Top view image is required";
    }
    
    if (!carForm.sideViewImage && !sideViewFile) {
      errors.sideViewImage = "Side view image is required";
    }
    
    const speedRegular = parseInt(carForm.speedRegular);
    if (!carForm.speedRegular || isNaN(speedRegular) || speedRegular < 20 || speedRegular > 150) {
      errors.speedRegular = "Speed must be between 20 and 150 km/h";
    }
    
    const speedDesert = parseInt(carForm.speedDesert);
    if (!carForm.speedDesert || isNaN(speedDesert) || speedDesert < 20 || speedDesert > 150) {
      errors.speedDesert = "Speed must be between 20 and 150 km/h";
    }
    
    const speedMuddy = parseInt(carForm.speedMuddy);
    if (!carForm.speedMuddy || isNaN(speedMuddy) || speedMuddy < 20 || speedMuddy > 150) {
      errors.speedMuddy = "Speed must be between 20 and 150 km/h";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCarModal = (car = null) => {
    setError("");
    setFormErrors({});
    setTopViewFile(null);
    setSideViewFile(null);
    setTopViewPreview(null);
    setSideViewPreview(null);
    if (topViewInputRef.current) topViewInputRef.current.value = "";
    if (sideViewInputRef.current) sideViewInputRef.current.value = "";
    
    if (car) {
      setEditingCar(car);
      setCarForm({
        name: car.name || "",
        topViewImage: car.topViewImage || "",
        sideViewImage: car.sideViewImage || "",
        speedRegular: car.speedRegular?.toString() || "",
        speedDesert: car.speedDesert?.toString() || "",
        speedMuddy: car.speedMuddy?.toString() || "",
        isActive: car.isActive !== false,
      });
    } else {
      setEditingCar(null);
      setCarForm({
        name: "",
        topViewImage: "",
        sideViewImage: "",
        speedRegular: "",
        speedDesert: "",
        speedMuddy: "",
        isActive: true,
      });
    }
    setShowCarModal(true);
  };

  const handleSaveCar = async () => {
    setError("");
    setFormErrors({});
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      // Upload images if new files are selected
      let topViewImageUrl = carForm.topViewImage;
      let sideViewImageUrl = carForm.sideViewImage;

      try {
        if (topViewFile) {
          topViewImageUrl = await uploadImage(topViewFile, "top");
        }
        if (sideViewFile) {
          sideViewImageUrl = await uploadImage(sideViewFile, "side");
        }
      } catch (uploadError) {
        console.error("Error uploading images:", uploadError);
        setError(uploadError.message || "Failed to upload images. Please try again.");
        setSaving(false);
        return;
      }

      const payload = {
        name: carForm.name.trim(),
        topViewImage: topViewImageUrl,
        sideViewImage: sideViewImageUrl,
        speedRegular: parseInt(carForm.speedRegular),
        speedDesert: parseInt(carForm.speedDesert),
        speedMuddy: parseInt(carForm.speedMuddy),
        isActive: carForm.isActive,
      };

      if (editingCar) {
        await adminApiClient.put(`/admin/cars/${editingCar._id}`, payload, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } else {
        await adminApiClient.post("/admin/cars", payload, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      }
      setShowCarModal(false);
      await loadCars();
    } catch (error) {
      console.error("Error saving car:", error);
      const errorMessage = error.response?.data?.error || 
                          error.message || 
                          "Failed to save car. Please check all fields.";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCar = async (carId) => {
    if (!confirm("Are you sure you want to delete this car? This action cannot be undone.")) return;
    
    try {
      await adminApiClient.delete(`/admin/cars/${carId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      await loadCars();
    } catch (error) {
      console.error("Error deleting car:", error);
      alert(error.response?.data?.error || "Failed to delete car");
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  if (loading && cars.length === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border text-primary" role="status" />
        <span className="ms-3 text-muted">Loading cars...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">Game Management</h3>
          <p className="text-muted mb-0">Manage cars and their statistics for the prediction race game</p>
        </div>
        <Button variant="primary" onClick={() => handleOpenCarModal()}>
          <BsPlusCircle className="me-2" />
          Add New Car
        </Button>
      </div>
      
      {error && !showCarModal && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {cars.length === 0 ? (
        <Card className="glass-card">
          <Card.Body className="text-center text-muted py-5">
            <BsTrophy size={48} className="mb-3 opacity-50" />
            <p className="mb-0">No cars found. Add your first car to start the game!</p>
          </Card.Body>
        </Card>
      ) : (
        <Row className="g-4">
          {cars.map((car) => {
            const stats = car.stats || {};
            const topViewUrl = getImageUrl(car.topViewImage);
            const sideViewUrl = getImageUrl(car.sideViewImage);
            
            return (
              <Col key={car._id} xs={12} md={6} lg={4}>
                <Card className="glass-card h-100" style={{ border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                  <div className="position-relative" style={{ height: "200px", background: "var(--bg-darker, #050810)", overflow: "hidden" }}>
                    {sideViewUrl ? (
                      <Image
                        src={sideViewUrl}
                        alt={car.name}
                        fill
                        style={{ objectFit: "contain", padding: "1rem" }}
                        unoptimized
                      />
                    ) : (
                      <div className="d-flex align-items-center justify-content-center h-100">
                        <BsImage size={48} className="text-muted" />
                      </div>
                    )}
                    <Badge
                      bg={car.isActive ? "success" : "secondary"}
                      className="position-absolute top-0 end-0 m-2"
                    >
                      {car.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Card.Body>
                    <Card.Title className="mb-3">
                      <h5 className="mb-0">{car.name}</h5>
                    </Card.Title>
                    
                    {/* Statistics */}
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center gap-2 small text-muted">
                          <BsTrophy />
                          <span>Games Played</span>
                        </div>
                        <span className="fw-bold">{stats.gamesPlayed || 0}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center gap-2 small text-muted">
                          <BsTrophy style={{ color: "#ffd700" }} />
                          <span>Wins</span>
                        </div>
                        <span className="fw-bold text-warning">{stats.wins || 0}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center gap-2 small text-muted">
                          <BsPeople />
                          <span>People Selected</span>
                        </div>
                        <span className="fw-bold">{formatNumber(stats.totalUsers || 0)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center gap-2 small text-muted">
                          <BsCoin style={{ color: "#ffd700" }} />
                          <span>Total Selections</span>
                        </div>
                        <span className="fw-bold">{formatNumber(stats.totalSelections || 0)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex align-items-center gap-2 small text-muted">
                          <BsCoin style={{ color: "#00f5ff" }} />
                          <span>Coins Spent</span>
                        </div>
                        <span className="fw-bold">{formatNumber(stats.totalCoins || 0)}</span>
                      </div>
                      {stats.gamesPlayed > 0 && (
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="small text-muted">Win Rate</span>
                          <Badge bg="info">{stats.winRate || "0.0"}%</Badge>
                        </div>
                      )}
                    </div>

                    {/* Speeds */}
                    <div className="mb-3 p-2 rounded" style={{ background: "rgba(255, 255, 255, 0.05)" }}>
                      <div className="small text-muted mb-1">Speeds</div>
                      <div className="d-flex justify-content-between small">
                        <span>Regular: <strong>{car.speedRegular} km/h</strong></span>
                        <span>Desert: <strong>{car.speedDesert} km/h</strong></span>
                        <span>Muddy: <strong>{car.speedMuddy} km/h</strong></span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="d-flex gap-2">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="flex-fill"
                        onClick={() => handleOpenCarModal(car)}
                      >
                        <BsPencil className="me-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteCar(car._id)}
                      >
                        <BsTrash />
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Car Modal */}
      <Modal show={showCarModal} onHide={() => !saving && setShowCarModal(false)} size="lg" backdrop={!saving}>
        <Modal.Header closeButton={!saving} className="bg-black">
          <Modal.Title>{editingCar ? "Edit Car" : "Add New Car"}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-black">
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form className="bg-black">
            <Form.Group className="mb-3">
              <Form.Label>
                Car Name <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                value={carForm.name}
                onChange={(e) => setCarForm({ ...carForm, name: e.target.value })}
                placeholder="e.g., Red Racer, Blue Blazer"
                isInvalid={!!formErrors.name}
                disabled={saving}
              />
              <Form.Text className="text-muted">3-30 characters</Form.Text>
              {formErrors.name && (
                <Form.Control.Feedback type="invalid">{formErrors.name}</Form.Control.Feedback>
              )}
            </Form.Group>

            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  <BsImage className="me-1" />
                  Top View Image <span className="text-danger">*</span>
                </Form.Label>
                <div className="d-flex gap-2 mb-2">
                  <Form.Control
                    ref={topViewInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, "top")}
                    disabled={saving || uploading.top}
                  />
                  {(topViewPreview || carForm.topViewImage) && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleRemoveImage("top")}
                      disabled={saving || uploading.top}
                    >
                      <BsX />
                    </Button>
                  )}
                </div>
                {formErrors.topViewImage && (
                  <div className="text-danger small mb-2">{formErrors.topViewImage}</div>
                )}
                {(topViewPreview || carForm.topViewImage) && (
                  <div className="mt-2 border rounded p-2" style={{ background: "rgba(255, 255, 255, 0.05)" }}>
                    <Image
                      src={topViewPreview || getImageUrl(carForm.topViewImage) || ""}
                      alt="Top view preview"
                      width={400}
                      height={100}
                      style={{ maxWidth: "100%", maxHeight: "150px", borderRadius: "0.25rem", objectFit: "contain" }}
                      unoptimized
                    />
                  </div>
                )}
                {uploading.top && (
                  <div className="small text-muted mt-1">Uploading...</div>
                )}
              </Form.Group>

              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  <BsImage className="me-1" />
                  Side View Image <span className="text-danger">*</span>
                </Form.Label>
                <div className="d-flex gap-2 mb-2">
                  <Form.Control
                    ref={sideViewInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, "side")}
                    disabled={saving || uploading.side}
                  />
                  {(sideViewPreview || carForm.sideViewImage) && (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleRemoveImage("side")}
                      disabled={saving || uploading.side}
                    >
                      <BsX />
                    </Button>
                  )}
                </div>
                {formErrors.sideViewImage && (
                  <div className="text-danger small mb-2">{formErrors.sideViewImage}</div>
                )}
                {(sideViewPreview || carForm.sideViewImage) && (
                  <div className="mt-2 border rounded p-2" style={{ background: "rgba(255, 255, 255, 0.05)" }}>
                    <Image
                      src={sideViewPreview || getImageUrl(carForm.sideViewImage) || ""}
                      alt="Side view preview"
                      width={400}
                      height={100}
                      style={{ maxWidth: "100%", maxHeight: "150px", borderRadius: "0.25rem", objectFit: "contain" }}
                      unoptimized
                    />
                  </div>
                )}
                {uploading.side && (
                  <div className="small text-muted mt-1">Uploading...</div>
                )}
              </Form.Group>
            </div>

            <div className="row">
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  Speed on Regular Road (km/h) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  min="20"
                  max="150"
                  value={carForm.speedRegular}
                  onChange={(e) => setCarForm({ ...carForm, speedRegular: e.target.value })}
                  placeholder="e.g., 120"
                  isInvalid={!!formErrors.speedRegular}
                  disabled={saving}
                />
                <Form.Text className="text-muted">20-150 km/h</Form.Text>
                {formErrors.speedRegular && (
                  <Form.Control.Feedback type="invalid">{formErrors.speedRegular}</Form.Control.Feedback>
                )}
              </Form.Group>

              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  Speed on Desert Road (km/h) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  min="20"
                  max="150"
                  value={carForm.speedDesert}
                  onChange={(e) => setCarForm({ ...carForm, speedDesert: e.target.value })}
                  placeholder="e.g., 80"
                  isInvalid={!!formErrors.speedDesert}
                  disabled={saving}
                />
                <Form.Text className="text-muted">20-150 km/h</Form.Text>
                {formErrors.speedDesert && (
                  <Form.Control.Feedback type="invalid">{formErrors.speedDesert}</Form.Control.Feedback>
                )}
              </Form.Group>

              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  Speed on Muddy Road (km/h) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  min="20"
                  max="150"
                  value={carForm.speedMuddy}
                  onChange={(e) => setCarForm({ ...carForm, speedMuddy: e.target.value })}
                  placeholder="e.g., 50"
                  isInvalid={!!formErrors.speedMuddy}
                  disabled={saving}
                />
                <Form.Text className="text-muted">20-150 km/h</Form.Text>
                {formErrors.speedMuddy && (
                  <Form.Control.Feedback type="invalid">{formErrors.speedMuddy}</Form.Control.Feedback>
                )}
              </Form.Group>
            </div>

            <Form.Check
              type="switch"
              label="Active (car will be available in games)"
              checked={carForm.isActive}
              onChange={(e) => setCarForm({ ...carForm, isActive: e.target.checked })}
              disabled={saving}
            />
          </Form>
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between bg-black">
          <Button variant="secondary" onClick={() => setShowCarModal(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveCar} disabled={saving || uploading.top || uploading.side}>
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                {editingCar ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                {editingCar ? "Update" : "Create"} Car
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
