"use client";

import { useState } from "react";
import { Button, Form, Badge } from "react-bootstrap";
import { BsX, BsCoin, BsPeople, BsPerson, BsShuffle } from "react-icons/bs";
import apiClient from "@/lib/apiClient";

const GIFT_TYPES = {
  'lucky-kiss': { name: 'Lucky Kiss', price: 177, emoji: '💋' },
  'hugging-heart': { name: 'Hugging Heart', price: 1088, emoji: '🤗❤️' },
  'holding-hands': { name: 'Holding Hands', price: 3888, emoji: '🤝' },
  'lucky-star': { name: 'Lucky Star', price: 7777, emoji: '⭐' },
  'lollipop': { name: 'Lollipop', price: 5999, emoji: '🍭' },
  'kiss': { name: 'Kiss', price: 19999, emoji: '💋' },
  'bouquet': { name: 'Bouquet', price: 59999, emoji: '🌹' },
  'love-car': { name: 'Love Car', price: 89999, emoji: '🚗💕' },
};

export default function GiftSelector({ show, onHide, partyId, wallet, onGiftSent, participants, hostId, friendId }) {
  const [selectedGift, setSelectedGift] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [recipientType, setRecipientType] = useState('all');
  const [randomCount, setRandomCount] = useState(1);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('popular');

  const gifts = Object.entries(GIFT_TYPES);
  const popularGifts = gifts.slice(0, 4);
  const luckyGifts = gifts.slice(4);

  const selectedGiftData = selectedGift ? GIFT_TYPES[selectedGift] : null;
  
  // Calculate recipient count
  const recipientCount = friendId 
    ? 1 // Single friend
    : recipientType === 'all' 
    ? (participants?.length || 0)
    : recipientType === 'host' 
    ? 1 
    : recipientType === 'random'
    ? Math.min(randomCount, participants?.length || 0)
    : 0;
  
  // Total cost = quantity * price * recipientCount
  // If quantity is 10 and there are 50 recipients, cost = 10 * price * 50 (500 gifts total)
  const totalCost = selectedGiftData ? selectedGiftData.price * quantity * recipientCount : 0;
  const canAfford = wallet?.partyCoins >= totalCost;


  const handleSendGift = async () => {
    if (!selectedGift || !canAfford) return;
    setSending(true);
    try {
      const payload = {
        giftType: selectedGift,
        quantity,
      };

      // If friendId is provided, send to that friend (no party required)
      if (friendId) {
        payload.friendId = friendId;
      } else {
        // Otherwise, send to party participants
        payload.partyId = partyId;
        payload.recipientType = recipientType;
        if (recipientType === 'random') {
          payload.randomCount = randomCount;
        }
      }

      await apiClient.post('/gifts/send', payload);
      onGiftSent();
      onHide();
      setSelectedGift(null);
      setQuantity(1);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to send gift');
    } finally {
      setSending(false);
    }
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "relative",
        maxHeight: "100%",
        background: "rgba(15, 22, 36, 0.95)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "0.5rem",
        padding: "0.75rem",
        overflowY: "auto",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div className="d-flex justify-content-between align-items-center ">
        <h6 className="fw-bold mb-0" style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Send Gift
        </h6>
        <button
          onClick={onHide}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
          title="Close"
        >
          <BsX style={{ fontSize: "1.1rem" }} />
        </button>
      </div>

      <div className="d-flex gap-2 mb-2">
        <Button
          variant={activeTab === 'popular' ? 'primary' : 'outline-light'}
          size="sm"
          onClick={() => setActiveTab('popular')}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
        >
          Popular
        </Button>
        <Button
          variant={activeTab === 'lucky' ? 'primary' : 'outline-light'}
          size="sm"
          onClick={() => setActiveTab('lucky')}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
        >
          Lucky
        </Button>
      </div>

      <div className="row g-1 mb-3" style={{ maxHeight: "150px", overflowY: "auto" }}>
        {(activeTab === 'popular' ? popularGifts : luckyGifts).map(([key, gift]) => (
          <div key={key} className="col-3 col-sm-2">
            <div
              onClick={() => setSelectedGift(key)}
              style={{
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: selectedGift === key
                  ? 'rgba(255, 45, 149, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: selectedGift === key
                  ? '2px solid var(--accent)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{gift.emoji}</div>
              <div className="small fw-bold mb-1" style={{ color: 'var(--text-secondary)', fontSize: "0.65rem" }}>
                {gift.name.length > 8 ? gift.name.substring(0, 8) + '...' : gift.name}
              </div>
              <div className="d-flex align-items-center justify-content-center gap-1">
                <BsCoin style={{ color: '#FFD700', fontSize: '0.7rem' }} />
                <span className="small" style={{ color: 'var(--text-primary)', fontSize: "0.65rem" }}>
                  {gift.price.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedGift && (
        <div className="p-2 " style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <div className="d-flex align-items-center gap-2 mb-2">
            <div style={{ fontSize: '1.5rem' }}>{selectedGiftData.emoji}</div>
            <div>
              <div className="fw-bold small" style={{ color: 'var(--text-secondary)', fontSize: "0.8rem" }}>
                {selectedGiftData.name}
              </div>
              <div className="small" style={{ color: 'var(--text-muted)', fontSize: "0.7rem" }}>
                {selectedGiftData.price.toLocaleString()} coins each
              </div>
            </div>
          </div>

          <Form.Group className="mb-2">
            <Form.Label className="small" style={{ fontSize: "0.75rem" }}>Quantity per recipient</Form.Label>
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="outline-light"
                size="sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}
              >
                -
              </Button>
              <Form.Control
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ maxWidth: '60px', textAlign: 'center', fontSize: "0.75rem", padding: "0.25rem" }}
              />
              <Button
                variant="outline-light"
                size="sm"
                onClick={() => setQuantity(quantity + 1)}
                style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}
              >
                +
              </Button>
            </div>
          </Form.Group>

          {!friendId && (
            <>
              <Form.Group className="mb-2">
                <Form.Label className="small" style={{ fontSize: "0.75rem" }}>Send To</Form.Label>
                <Form.Select
                  value={recipientType}
                  onChange={(e) => setRecipientType(e.target.value)}
                  size="sm"
                  style={{ fontSize: "0.75rem" }}
                >
                  <option value="all">All Participants ({participants?.length || 0})</option>
                  <option value="host">Host Only</option>
                  <option value="random">Random Participants</option>
                </Form.Select>
              </Form.Group>

              {recipientType === 'random' && (
                <Form.Group className="mb-2">
                  <Form.Label className="small" style={{ fontSize: "0.75rem" }}>Number of Random Recipients</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    max={participants?.length || 1}
                    value={randomCount}
                    onChange={(e) => setRandomCount(Math.max(1, parseInt(e.target.value) || 1))}
                    size="sm"
                    style={{ fontSize: "0.75rem" }}
                  />
                </Form.Group>
              )}
            </>
          )}

          <div className="mb-2 p-2" style={{
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "0.25rem",
          }}>
            <div className="small mb-1" style={{ color: 'var(--text-muted)', fontSize: "0.7rem" }}>
              Calculation: {quantity} gift{quantity > 1 ? 's' : ''} × {recipientCount} recipient{recipientCount > 1 ? 's' : ''} = {quantity * recipientCount} total gift{quantity * recipientCount > 1 ? 's' : ''}
            </div>
            <div className="small fw-bold d-flex align-items-center gap-1" style={{ color: 'var(--text-secondary)', fontSize: "0.8rem" }}>
              <span>Total Cost:</span>
              <BsCoin style={{ color: '#FFD700', fontSize: '0.8rem' }} />
              <span>{totalCost.toLocaleString()} coins</span>
            </div>
            <div className="small d-flex align-items-center gap-1" style={{ color: 'var(--text-muted)', fontSize: "0.7rem" }}>
              <span>Your Balance:</span>
              <BsCoin style={{ color: '#FFD700', fontSize: '0.7rem' }} />
              <span>{wallet?.partyCoins?.toLocaleString() || 0}</span>
            </div>
            {!canAfford && (
              <div className="small text-danger mt-1" style={{ fontSize: "0.7rem" }}>
                Insufficient coins
              </div>
            )}
          </div>

          <div className="d-flex gap-2">
            <Button
              variant="outline-light"
              size="sm"
              onClick={onHide}
              style={{ fontSize: "0.75rem", flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendGift}
              disabled={!canAfford || sending || recipientCount === 0}
              style={{ fontSize: "0.75rem", flex: 1 }}
            >
              {sending ? 'Sending...' : 'Send Gift'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
