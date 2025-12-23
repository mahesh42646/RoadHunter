"use client";

import { useEffect, useState } from "react";
import { Card, Table } from "react-bootstrap";
import { BsBarChart, BsPeople, BsCashCoin, BsTrophy } from "react-icons/bs";
import adminApiClient from "@/lib/adminApiClient";

export default function AdminDashboard({ adminToken }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [adminToken]);

  const loadAnalytics = async () => {
    try {
      const response = await adminApiClient.get("/admin/analytics", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "400px" }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!analytics) {
    return <div className="text-center text-muted">Failed to load analytics</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="mb-1">Dashboard Overview</h3>
        <p className="text-muted mb-0">Platform statistics and insights</p>
      </div>
      
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <Card className="glass-card">
            <Card.Body>
              <h6 className="text-muted">Total Users</h6>
              <h3>{analytics.overview.totalUsers}</h3>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="glass-card">
            <Card.Body>
              <h6 className="text-muted">Total Games</h6>
              <h3>{analytics.overview.totalGames}</h3>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="glass-card">
            <Card.Body>
              <h6 className="text-muted">Total Predictions</h6>
              <h3>{analytics.overview.totalPredictions}</h3>
            </Card.Body>
          </Card>
        </div>
        <div className="col-md-3">
          <Card className="glass-card">
            <Card.Body>
              <h6 className="text-muted">Platform Fees</h6>
              <h3>{analytics.overview.totalFees.toLocaleString()} coins</h3>
            </Card.Body>
          </Card>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-6">
        <Card className="glass-card">
  <Card.Header>
    <h5>Recent Games</h5>
  </Card.Header>
  <Card.Body className="p-0 glass-card">
    <div className="table-responsive">
      <Table
        responsive
        hover
        striped
        bordered
        size="sm"
        variant="dark"
        className="mb-0 text-white"
      >
        <thead className="text-uppercase small">
          <tr className="text-center">
            <th>Game #</th>
            <th>Pot</th>
            <th>Predictions</th>
            <th>Winner</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {analytics.recentGames.map((game) => (
            <tr key={game._id} className="text-center">
              <td className="fw-semibold">{game.gameNumber}</td>
              <td className="text-success fw-bold">{game.totalPot.toLocaleString()}</td>
              <td>{game.totalPredictions}</td>
              <td>
                <span className="badge bg-info text-dark">{game.winnerCarId?.name || "N/A"}</span>
              </td>
              <td className="text-muted small">{new Date(game.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  </Card.Body>
</Card>


        </div>
        <div className="col-md-6">
        <Card className="glass-card">
            <Card.Header>
              <h5>Car Win Statistics</h5>
            </Card.Header>
            <Card.Body className="p-0 glass-card">
              <div className="table-responsive">
                <Table
                  responsive
                  hover
                  striped
                  bordered
                  size="sm"
                  variant="dark"
                  className="mb-0 text-white"
                >
                  <thead className="text-uppercase small">
                    <tr className="text-center">
                      <th>Car</th>
                      <th>Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.carStats.map((stat) => (
                      <tr key={stat.carId} className="text-center">
                        <td className="fw-semibold">{stat.carName}</td>
                        <td>{stat.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      <Card className="glass-card">
        <Card.Header>
          <h5>Top Users</h5>
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
                  <th>User</th>
                  <th>Predictions</th>
                  <th>Wins</th>
                  <th>Win Rate</th>
                  <th>Virtual Coins Used</th>
                  <th>Won</th>
                  <th>Net Profit</th>
                </tr>
              </thead>
              <tbody>
              {analytics.topUsers.map((user) => (
                  <tr key={user.userId} className="text-center">
                    <td className="fw-semibold">{user.username}</td>
                    <td>{user.totalPredictions}</td>
                    <td>{user.wins}</td>
                    <td>{user.winRate}%</td>
                    <td>{user.totalWagered.toLocaleString()} (Virtual)</td>
                    <td>{user.totalWon.toLocaleString()}</td>
                    <td className={user.netProfit >= 0 ? "text-success" : "text-danger"}>
                      {user.netProfit >= 0 ? "+" : ""}{user.netProfit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

