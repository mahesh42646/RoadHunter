"use client";

import VerticalRaceGame from "@/app/game/components/VerticalRaceGame";

export default function PredictionRaceGame({ socket, wallet, onClose, partyId }) {
  return (
    <div style={{ height: "100%", width: "100%" }}>
      <VerticalRaceGame 
        socket={socket} 
        wallet={wallet} 
        onClose={onClose}
        partyId={partyId}
      />
    </div>
  );
}
