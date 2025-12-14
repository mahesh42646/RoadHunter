"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Badge, Modal, Form, Alert } from "react-bootstrap";
import { BsPlusCircle, BsPencil, BsTrash, BsImage, BsTrophy } from "react-icons/bs";
import Image from "next/image";
import adminApiClient from "@/lib/adminApiClient";

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
  const [formErrors, setFormErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const validateForm = () => {
    const errors = {};
    
    if (!carForm.name || carForm.name.trim().length < 3 || carForm.name.trim().length > 30) {
      errors.name = "Car name must be between 3 and 30 characters";
    }
    
    if (!carForm.topViewImage || !isValidUrl(carForm.topViewImage)) {
      errors.topViewImage = "Valid top view image URL is required";
    }
    
    if (!carForm.sideViewImage || !isValidUrl(carForm.sideViewImage)) {
      errors.sideViewImage = "Valid side view image URL is required";
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

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleOpenCarModal = (car = null) => {
    setError("");
    setFormErrors({});
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
      const payload = {
        name: carForm.name.trim(),
        topViewImage: carForm.topViewImage.trim(),
        sideViewImage: carForm.sideViewImage.trim(),
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
      setError(error.response?.data?.error || "Failed to save car. Please check all fields.");
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

      <Card className="glass-card">
        <Card.Header>
          <h5 className="mb-0">Cars ({cars.length})</h5>
        </Card.Header>
        <Card.Body>
          {cars.length === 0 ? (
            <div className="text-center text-muted py-5">
              <BsTrophy size={48} className="mb-3 opacity-50" />
              <p className="mb-0">No cars found. Add your first car to start the game!</p>
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Car Name</th>
                  <th>Regular Speed</th>
                  <th>Desert Speed</th>
                  <th>Muddy Speed</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ width: "120px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => (
                  <tr key={car._id}>
                    <td>
                      <strong>{car.name}</strong>
                    </td>
                    <td>{car.speedRegular} km/h</td>
                    <td>{car.speedDesert} km/h</td>
                    <td>{car.speedMuddy} km/h</td>
                    <td>
                      {car.isActive ? (
                        <Badge bg="success">Active</Badge>
                      ) : (
                        <Badge bg="secondary">Inactive</Badge>
                      )}
                    </td>
                    <td>
                      {car.createdAt ? new Date(car.createdAt).toLocaleDateString() : "N/A"}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => handleOpenCarModal(car)}
                          title="Edit"
                        >
                          <BsPencil />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleDeleteCar(car._id)}
                          title="Delete"
                        >
                          <BsTrash />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Car Modal */}
      <Modal show={showCarModal} onHide={() => !saving && setShowCarModal(false)} size="lg" backdrop={!saving}>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>{editingCar ? "Edit Car" : "Add New Car"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form>
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
                  Top View Image URL <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="url"
                  value={carForm.topViewImage}
                  onChange={(e) => setCarForm({ ...carForm, topViewImage: e.target.value })}
                  placeholder="https://example.com/car-top.png"
                  isInvalid={!!formErrors.topViewImage}
                  disabled={saving}
                />
                {formErrors.topViewImage && (
                  <Form.Control.Feedback type="invalid">{formErrors.topViewImage}</Form.Control.Feedback>
                )}
                {carForm.topViewImage && isValidUrl(carForm.topViewImage) && (
                  <div className="mt-2">
                    <Image
                      src={carForm.topViewImage}
                      alt="Top view preview"
                      width={400}
                      height={100}
                      style={{ maxWidth: "100%", maxHeight: "100px", borderRadius: "0.25rem", objectFit: "contain" }}
                      unoptimized
                    />
                  </div>
                )}
              </Form.Group>

              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  <BsImage className="me-1" />
                  Side View Image URL <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="url"
                  value={carForm.sideViewImage}
                  onChange={(e) => setCarForm({ ...carForm, sideViewImage: e.target.value })}
                  placeholder="https://example.com/car-side.png"
                  isInvalid={!!formErrors.sideViewImage}
                  disabled={saving}
                />
                {formErrors.sideViewImage && (
                  <Form.Control.Feedback type="invalid">{formErrors.sideViewImage}</Form.Control.Feedback>
                )}
                {carForm.sideViewImage && isValidUrl(carForm.sideViewImage) && (
                  <div className="mt-2">
                    <Image
                      src={carForm.sideViewImage}
                      alt="Side view preview"
                      width={400}
                      height={100}
                      style={{ maxWidth: "100%", maxHeight: "100px", borderRadius: "0.25rem", objectFit: "contain" }}
                      unoptimized
                    />
                  </div>
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
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCarModal(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveCar} disabled={saving}>
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
