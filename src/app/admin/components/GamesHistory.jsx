"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Badge } from "react-bootstrap";
import adminApiClient from "@/lib/adminApiClient";

export default function GamesHistory({ adminToken }) {
  const [games, setGames] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGames();
  }, [adminToken, page]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const response = await adminApiClient.get("/admin/games", {
        params: { page },
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setGames(response.data.games);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Error loading games:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && games.length === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Games History</h3>
        <p className="text-muted mb-0">View all past and current games</p>
      </div>
      
      <Card className="glass-card">
        <Card.Header>
          <h5>All Games</h5>
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
                  <th>Game #</th>
                  <th>Status</th>
                  <th>Cars</th>
                  <th>Pot</th>
                  <th>Predictions</th>
                  <th>Winner</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => (
                  <tr key={game._id} className="text-center">
                    <td className="fw-semibold">{game.gameNumber}</td>
                    <td>
                      <Badge bg={
                        game.status === "finished" ? "success" :
                        game.status === "racing" ? "warning" :
                        game.status === "predictions" ? "info" : "secondary"
                      }>
                        {game.status}
                      </Badge>
                    </td>
                    <td>{game.cars?.map((c) => c.carId?.name).join(", ") || "N/A"}</td>
                    <td className="text-success fw-bold">{game.totalPot?.toLocaleString() || 0}</td>
                    <td>{game.totalPredictions || 0}</td>
                    <td>
                      <span className="badge bg-info text-dark">{game.winnerCarId?.name || "N/A"}</span>
                    </td>
                    <td className="text-muted small">{new Date(game.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
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
    </div>
  );
}

