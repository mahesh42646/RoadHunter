"use client";

import VerticalRaceGame from "@/app/game/components/VerticalRaceGame";

export default function PredictionRaceGame({ socket, wallet, onClose, partyId }) {
  // Use the socket passed as prop (from party room)
  const partySocket = socket;

  // Render vertical game directly
  return (
    <div style={{ height: "100%", width: "100%" }}>
      <VerticalRaceGame 
        socket={partySocket} 
        wallet={wallet} 
        onClose={onClose}
        partyId={partyId}
      />
    </div>
  );
}
