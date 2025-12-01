"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Badge } from "react-bootstrap";
import adminApiClient from "@/lib/adminApiClient";

export default function TransactionsManagement({ adminToken }) {
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, [adminToken, page]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const response = await adminApiClient.get("/admin/transactions", {
        params: { page },
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setTransactions(response.data.transactions);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Transactions</h3>
        <p className="text-muted mb-0">View all game predictions and transactions</p>
      </div>
      
      <Card className="glass-card">
        <Card.Header>
          <h5>All Transactions</h5>
        </Card.Header>
        <Card.Body>
          <Table responsive>
            <thead>
              <tr>
                <th>User</th>
                <th>Game #</th>
                <th>Car</th>
                <th>Bet</th>
                <th>Result</th>
                <th>Payout</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx._id}>
                  <td>{tx.userId?.account?.displayName || "Unknown"}</td>
                  <td>{tx.gameId?.gameNumber || "N/A"}</td>
                  <td>{tx.predictedCarId?.name || "N/A"}</td>
                  <td>{tx.betAmount}</td>
                  <td>
                    {tx.isCorrect === true ? (
                      <Badge bg="success">Win</Badge>
                    ) : tx.isCorrect === false ? (
                      <Badge bg="danger">Loss</Badge>
                    ) : (
                      <Badge bg="secondary">Pending</Badge>
                    )}
                  </td>
                  <td>{tx.payout?.toLocaleString() || 0}</td>
                  <td>{new Date(tx.timestamp).toLocaleString()}</td>
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

