"use client";

import { useState, useEffect } from "react";
import { Card, ListGroup, Button, Form, Modal, Badge, Alert } from "react-bootstrap";
import apiClient from "@/lib/apiClient";
import useAuthStore from "@/store/useAuthStore";
import DepositChatPanel from "@/components/DepositChatPanel";

export default function WalletPage() {
  const user = useAuthStore((state) => state.user);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCoinsModal, setShowAddCoinsModal] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState(null);
  const [depositAmount, setDepositAmount] = useState(10);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadWallet();
    loadTransactions();
  }, []);

  const loadWallet = async () => {
    try {
      const response = await apiClient.get("/wallet/balance");
      setWallet(response.data);
    } catch (error) {
      console.error("Failed to load wallet", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await apiClient.get("/wallet/transactions");
      setTransactions(response.data.transactions || []);
    } catch (error) {
      console.error("Failed to load transactions", error);
    }
  };

  const handleCreateDepositRequest = async (e) => {
    e.preventDefault();
    if (depositAmount < 10) {
      alert("Minimum deposit amount is $10");
      return;
    }

    setCreating(true);
    try {
      const response = await apiClient.post("/deposits/request", {
        amount: depositAmount,
      });
      setActiveRequestId(response.data.depositRequest._id);
      setShowAddCoinsModal(false);
      setShowChatPanel(true);
      await loadTransactions();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to create deposit request");
    } finally {
      setCreating(false);
    }
  };

  const handleChatClose = () => {
    setShowChatPanel(false);
    setActiveRequestId(null);
    loadWallet();
    loadTransactions();
  };

  const handleRequestCreated = () => {
    loadWallet();
    loadTransactions();
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
        <div className="text-center">
          <div className="spinner-border mb-3" style={{ color: "var(--accent)" }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p style={{ color: "var(--text-muted)" }}>Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-4">
      {showChatPanel && activeRequestId ? (
        <DepositChatPanel
          requestId={activeRequestId}
          onClose={handleChatClose}
          onRequestCreated={handleRequestCreated}
        />
      ) : (
        <>
          <Card className="glass-card border-0">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-start mb-4">
                <div>
                  <Card.Title className="fw-bold mb-2" style={{ color: "var(--text-secondary)" }}>
                    My Wallet
                  </Card.Title>
                  <p className="small mb-1" style={{ color: "var(--text-muted)" }}>Wallet ID</p>
                  <p className="fw-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                    {wallet?.walletId || "Pending profile completion"}
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setShowAddCoinsModal(true)}>
                  + Add Coins
                </Button>
              </div>
          <div className="d-flex align-items-center gap-3">
            <div style={{ fontSize: "3rem" }}>💎</div>
            <div>
              <p className="small mb-1" style={{ color: "var(--text-muted)" }}>Party Coins</p>
              <h2 className="fw-bold mb-0" style={{ color: "var(--text-secondary)" }}>
                {wallet?.partyCoins?.toLocaleString() || 0}
              </h2>
              <p className="small mb-0" style={{ color: "var(--text-muted)" }}>
                Virtual currency only - No real money value
              </p>
              <p className="small mt-1" style={{ color: "rgba(202, 0, 0, 0.8)", fontSize: "0.7rem" }}>
                ⚠️ Party Coins are for entertainment only. NOT gambling or betting.
              </p>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="glass-card border-0">
        <Card.Header
          style={{
            background: "transparent",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            color: "var(--text-secondary)",
          }}
        >
          <Card.Title className="mb-0 fw-bold">Transaction History</Card.Title>
        </Card.Header>
        <ListGroup variant="flush">
          {transactions.length === 0 ? (
            <ListGroup.Item
              className="text-center p-4"
              style={{ background: "transparent", color: "var(--text-muted)" }}
            >
              No transactions yet. Add coins to get started!
            </ListGroup.Item>
          ) : (
            transactions.map((transaction, idx) => (
              <ListGroup.Item
                key={idx}
                className="d-flex justify-content-between align-items-center p-3"
                style={{
                  background: "transparent",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  color: "var(--text-primary)",
                }}
              >
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="fw-semibold text-capitalize" style={{ color: "var(--text-secondary)" }}>
                      {transaction.type?.replace("_", " ") || "Transaction"}
                    </span>
                    {transaction.status && (
                      <Badge
                        style={{
                          background:
                            transaction.status === "completed"
                              ? "rgba(0, 245, 255, 0.2)"
                              : "rgba(255, 122, 24, 0.2)",
                          color:
                            transaction.status === "completed"
                              ? "var(--accent-secondary)"
                              : "var(--accent-tertiary)",
                          border:
                            transaction.status === "completed"
                              ? "1px solid rgba(0, 245, 255, 0.3)"
                              : "1px solid rgba(255, 122, 24, 0.3)",
                          fontSize: "0.7rem",
                        }}
                      >
                        {transaction.status}
                      </Badge>
                    )}
                  </div>
                  {transaction.metadata && (
                    <div className="small mb-1" style={{ color: "var(--text-muted)" }}>
                      {transaction.metadata.giftType && (
                        <span>
                          Gift: {transaction.metadata.giftType.replace("-", " ")}{" "}
                          {transaction.metadata.quantity > 1 && `x${transaction.metadata.quantity}`}
                        </span>
                      )}
                      {transaction.metadata.source === "free_coins" && <span>Free coins added</span>}
                      {transaction.metadata.source === "manual_deposit" && <span>Manual deposit</span>}
                    </div>
                  )}
                  <small style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>
                    {new Date(transaction.processedAt).toLocaleString()}
                  </small>
                </div>
                <div className="text-end">
                  <div
                    className="fw-bold"
                    style={{
                      color:
                        transaction.partyCoins > 0
                          ? "var(--accent-secondary)"
                          : transaction.partyCoins < 0
                          ? "#ff6b7a"
                          : "var(--text-primary)",
                    }}
                  >
                    {transaction.partyCoins > 0 ? "+" : ""}
                    {transaction.partyCoins?.toLocaleString() || 0} coins
                  </div>
                  {transaction.amountUsd && (
                    <small style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>
                      ${transaction.amountUsd.toFixed(2)} USD
                    </small>
                  )}
                </div>
              </ListGroup.Item>
            ))
          )}
        </ListGroup>
      </Card>

          <Modal
            show={showAddCoinsModal}
            onHide={() => setShowAddCoinsModal(false)}
            centered
            contentClassName="glass-card border-0"
          >
            <Modal.Header
              closeButton
              style={{
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                color: "var(--text-primary)",
              }}
            >
              <Modal.Title style={{ color: "var(--text-secondary)" }}>Add Coins</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleCreateDepositRequest}>
              <Modal.Body style={{ color: "var(--text-primary)" }}>
                <Form.Group className="mb-3">
                  <Form.Label>Deposit Amount (USD)</Form.Label>
                  <Form.Control
                    type="number"
                    min="10"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Math.max(10, parseFloat(e.target.value) || 10))}
                    placeholder="Enter amount in USD"
                  />
                  <Form.Text style={{ color: "var(--text-muted)" }}>
                    Minimum deposit: $10
                  </Form.Text>
                </Form.Group>
                <Alert variant="info" className="mb-0">
                  <strong>Pricing:</strong>
                  <ul className="mb-0 small">
                    <li>$10 = 1,000 coins</li>
                    <li>$100 = 10,000 coins</li>
                    <li>$200 = 22,000 coins</li>
                    <li>Above $200 = 20% extra coins</li>
                  </ul>
                </Alert>
              </Modal.Body>
              <Modal.Footer style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <Button variant="outline-light" onClick={() => setShowAddCoinsModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={creating}>
                  {creating ? "Creating..." : "Create Deposit Request"}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>
        </>
      )}
    </div>
  );
}
