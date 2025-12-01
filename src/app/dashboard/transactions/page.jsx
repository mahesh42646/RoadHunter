"use client";

import { Table } from "react-bootstrap";

import useAuthStore from "@/store/useAuthStore";

export default function TransactionsPage() {
  const transactions = useAuthStore((state) => state.user?.transactions ?? []);

  if (transactions.length === 0) {
    return <p className="text-light-50">No transactions recorded yet.</p>;
  }

  return (
    <Table responsive variant="dark" striped bordered hover>
      <thead>
        <tr>
          <th>Type</th>
          <th>Coins</th>
          <th>Status</th>
          <th>Reference</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((transaction) => (
          <tr key={transaction._id}>
            <td className="text-capitalize">{transaction.type}</td>
            <td>{transaction.partyCoins}</td>
            <td>{transaction.status}</td>
            <td>{transaction.providerReference ?? "—"}</td>
            <td>{transaction.processedAt ? new Date(transaction.processedAt).toLocaleString() : "—"}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

