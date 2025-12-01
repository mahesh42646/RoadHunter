"use client";

import { useMemo, useState } from "react";
import { Button, Modal } from "react-bootstrap";

export default function FloatingHelp() {
  const [open, setOpen] = useState(false);

  const quickLinks = useMemo(
    () => [
      { label: "Discord", href: "https://discord.gg" },
      { label: "Support", href: "mailto:support@partyverse.gg" },
    ],
    [],
  );

  return (
    <>
      <Button
        variant="primary"
        className="position-fixed z-3 rounded-pill shadow-lg"
        style={{ bottom: "2rem", right: "2rem" }}
        onClick={() => setOpen(true)}
      >
        Need help?
      </Button>
      <Modal show={open} onHide={() => setOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Need Assistance?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted">
            Chat with our support squad or check the community for instant answers.
          </p>
          <ul className="list-unstyled">
            {quickLinks.map((link) => (
              <li key={link.label} className="mb-2">
                <a className="text-decoration-none" href={link.href} target="_blank" rel="noreferrer">
                  {link.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </Modal.Body>
      </Modal>
    </>
  );
}

