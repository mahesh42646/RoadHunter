"use client";

import { Container, Row, Col, Card, Form, Button, Alert } from "react-bootstrap";
import { useState } from "react";

const contactMethods = [
  {
    icon: "📧",
    title: "Email Us",
    value: "support@roadhunter.com",
    description: "Send us an email anytime!",
    link: "mailto:support@roadhunter.com",
  },
  {
    icon: "💬",
    title: "Live Chat",
    value: "Available 24/7",
    description: "Chat with our support team",
    link: "#",
  },
  {
    icon: "📱",
    title: "Phone",
    value: "+1 (555) 123-4567",
    description: "Call us during business hours",
    link: "tel:+15551234567",
  },
  {
    icon: "📍",
    title: "Address",
    value: "123 Gaming Street",
    description: "San Francisco, CA 94102",
    link: "#",
  },
];

const socialLinks = [
  { icon: "📘", name: "Facebook", link: "#" },
  { icon: "🐦", name: "Twitter", link: "#" },
  { icon: "📷", name: "Instagram", link: "#" },
  { icon: "💼", name: "LinkedIn", link: "#" },
  { icon: "🎮", name: "Discord", link: "#" },
];

export default function ContactUsPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitStatus(null);

    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      setSubmitStatus({
        type: "success",
        message: "Thank you! Your message has been sent successfully. We'll get back to you soon!",
      });
      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
      });
    }, 1500);
  };

  return (
    <>
      <style jsx global>{`
        .contact-hero {
          position: relative;
          min-height: 70vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 6rem 0;
          text-align: center;
        }

        .contact-hero::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 30%, rgba(202, 0, 0, 0.2) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(0, 245, 255, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(255, 122, 24, 0.1) 0%, transparent 60%);
          z-index: 0;
          animation: heroPulse 8s ease-in-out infinite;
        }

        .contact-hero::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: 
            radial-gradient(circle at 30% 40%, rgba(202, 0, 0, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 70% 60%, rgba(0, 245, 255, 0.06) 0%, transparent 40%);
          animation: heroRotate 20s linear infinite;
          z-index: 0;
        }

        @keyframes heroPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.05); }
        }

        @keyframes heroRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .hero-content {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: rgba(0, 245, 255, 0.2);
          border: 1px solid rgba(0, 245, 255, 0.4);
          padding: 0.75rem 1.5rem;
          border-radius: 3rem;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--accent-secondary);
          margin-bottom: 2rem;
          backdrop-filter: blur(15px);
          box-shadow: 0 8px 32px rgba(0, 245, 255, 0.2);
          animation: badgeFloat 3s ease-in-out infinite;
        }

        @keyframes badgeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .hero-title {
          font-size: 4.5rem !important;
          font-weight: 800 !important;
          line-height: 1.1;
          margin-bottom: 2rem;
          background: linear-gradient(135deg, #ffffff 0%, #e0e6ff 30%, #00f5ff 70%, #ff2d95 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-align: center;
          animation: titleFadeIn 1s ease-out;
          letter-spacing: -1px;
        }

        @keyframes titleFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-subtitle {
          font-size: 1.4rem;
          color: var(--text-muted);
          max-width: 700px;
          line-height: 1.8;
          margin: 0 auto 2.5rem;
          text-align: center;
          animation: subtitleFadeIn 1s ease-out 0.2s both;
        }

        @keyframes subtitleFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 3rem;
          flex-wrap: wrap;
          margin-top: 3rem;
          animation: statsFadeIn 1s ease-out 0.4s both;
        }

        @keyframes statsFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-stat {
          text-align: center;
        }

        .hero-stat-value {
          font-size: 2rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: block;
          margin-bottom: 0.25rem;
        }

        .hero-stat-label {
          font-size: 0.85rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .floating-elements {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          pointer-events: none;
          z-index: 1;
        }

        .floating-emoji {
          position: absolute;
          font-size: 2.5rem;
          opacity: 0.3;
          animation: floatEmoji 6s ease-in-out infinite;
        }

        .floating-emoji-1 {
          top: 15%;
          left: 10%;
          animation-delay: 0s;
        }

        .floating-emoji-2 {
          top: 60%;
          right: 15%;
          animation-delay: 2s;
        }

        .floating-emoji-3 {
          bottom: 20%;
          left: 20%;
          animation-delay: 4s;
        }

        @keyframes floatEmoji {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-30px) rotate(15deg);
            opacity: 0.5;
          }
        }

        .contact-form-section {
          padding: 5rem 0;
          position: relative;
        }

        .form-card {
          background: rgba(20, 27, 45, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 2rem;
          padding: 3rem;
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
        }

        .form-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--accent) 0%, var(--accent-secondary) 100%);
        }

        .form-header {
          margin-bottom: 2rem;
        }

        .form-title {
          font-size: 2rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 0.5rem;
        }

        .form-subtitle {
          color: var(--text-muted);
          font-size: 1rem;
        }

        .form-group-custom {
          margin-bottom: 1.5rem;
        }

        .form-label-custom {
          color: var(--text-secondary);
          font-weight: 600;
          margin-bottom: 0.75rem;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-control-custom {
          background: rgba(20, 27, 45, 0.5) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: var(--text-primary) !important;
          border-radius: 0.75rem !important;
          padding: 0.875rem 1.25rem !important;
          transition: all 0.3s ease !important;
          font-size: 1rem !important;
        }

        .form-control-custom:focus {
          background: rgba(20, 27, 45, 0.7) !important;
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 0.2rem rgba(202, 0, 0, 0.25) !important;
          color: var(--text-primary) !important;
        }

        .form-control-custom::placeholder {
          color: var(--text-dim) !important;
          opacity: 0.6 !important;
        }

        .form-control-custom textarea {
          min-height: 150px;
          resize: vertical;
        }

        .submit-button {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-tertiary) 100%);
          border: none;
          padding: 1rem 3rem;
          font-size: 1.1rem;
          font-weight: 700;
          border-radius: 3rem;
          color: white;
          text-transform: uppercase;
          letter-spacing: 1px;
          transition: all 0.3s ease;
          box-shadow: 0 10px 40px rgba(202, 0, 0, 0.4);
          width: 100%;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 15px 50px rgba(202, 0, 0, 0.5);
        }

        .submit-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .contact-details-section {
          padding: 5rem 0;
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.05) 0%, rgba(0, 245, 255, 0.03) 100%);
        }

        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(202, 0, 0, 0.15);
          border: 1px solid rgba(202, 0, 0, 0.3);
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.8rem;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 1rem;
        }

        .section-title {
          font-size: 2.75rem !important;
          font-weight: 700 !important;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #ffffff 0%, #e0e6ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .contact-method-card {
          background: rgba(20, 27, 45, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.5rem;
          padding: 2rem;
          text-align: center;
          backdrop-filter: blur(20px);
          transition: all 0.4s ease;
          height: 100%;
          text-decoration: none;
          display: block;
          color: inherit;
        }

        .contact-method-card:hover {
          transform: translateY(-8px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          color: inherit;
          text-decoration: none;
        }

        .contact-method-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          display: block;
        }

        .contact-method-title {
          font-size: 1.1rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 0.5rem;
        }

        .contact-method-value {
          font-size: 1rem;
          font-weight: 600;
          color: var(--accent-secondary);
          margin-bottom: 0.25rem;
        }

        .contact-method-description {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .social-section {
          margin-top: 4rem;
          padding-top: 3rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .social-title {
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .social-links {
          display: flex;
          justify-content: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .social-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1.25rem 1.5rem;
          background: rgba(20, 27, 45, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          text-decoration: none;
          color: var(--text-primary);
          min-width: 100px;
        }

        .social-link:hover {
          transform: translateY(-5px);
          border-color: rgba(0, 245, 255, 0.3);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          color: var(--text-primary);
          text-decoration: none;
        }

        .social-link-icon {
          font-size: 2rem;
        }

        .social-link-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .alert-custom {
          border-radius: 1rem;
          border: none;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.5rem;
        }

        .alert-success-custom {
          background: rgba(0, 245, 255, 0.15);
          color: var(--accent-secondary);
          border: 1px solid rgba(0, 245, 255, 0.3);
        }

        .info-card {
          background: rgba(20, 27, 45, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.5rem;
          padding: 2rem;
          backdrop-filter: blur(20px);
          margin-bottom: 2rem;
        }

        .info-card-title {
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 1rem;
        }

        .info-card-text {
          color: var(--text-muted);
          line-height: 1.7;
          margin: 0;
        }

        @media (max-width: 991px) {
          .hero-title {
            font-size: 3rem !important;
          }

          .form-card {
            padding: 2rem;
          }

          .section-title {
            font-size: 2rem !important;
          }
        }

        @media (max-width: 991px) {
          .hero-title {
            font-size: 3rem !important;
          }

          .hero-stats {
            gap: 2rem;
          }

          .floating-emoji {
            display: none;
          }
        }

        @media (max-width: 576px) {
          .contact-hero {
            min-height: 60vh;
            padding: 4rem 0;
          }

          .hero-title {
            font-size: 2.5rem !important;
          }

          .hero-subtitle {
            font-size: 1.1rem;
            max-width: 100%;
          }

          .hero-stats {
            gap: 1.5rem;
            margin-top: 2rem;
          }

          .hero-stat-value {
            font-size: 1.5rem;
          }

          .hero-stat-label {
            font-size: 0.75rem;
          }

          .hero-badge {
            padding: 0.6rem 1.25rem;
            font-size: 0.85rem;
          }

          .contact-form-section {
            padding: 3rem 0;
          }

          .form-card {
            padding: 1.5rem;
          }

          .form-title {
            font-size: 1.5rem !important;
          }

          .contact-details-section {
            padding: 3rem 0;
          }

          .contact-method-card {
            padding: 1.5rem;
          }

          .social-link {
            padding: 1rem;
            min-width: 80px;
          }
        }
      `}</style>

      {/* Hero Section */}
      <section className="contact-hero">
        <div className="floating-elements">
          <span className="floating-emoji floating-emoji-1">💬</span>
          <span className="floating-emoji floating-emoji-2">📧</span>
          <span className="floating-emoji floating-emoji-3">💬</span>
        </div>
        <Container>
          <div className="hero-content">
            <div className="hero-badge">
              <span>💬</span>
              <span>Get in Touch</span>
            </div>
            <h1 className="hero-title">
              We'd Love to<br />Hear from You
            </h1>
            <p className="hero-subtitle">
              Have a question, suggestion, or just want to say hello? We're here to help! 
              Reach out to us and we'll get back to you as soon as possible.
            </p>
            <div className="hero-stats">
              <div className="hero-stat">
                <span className="hero-stat-value">24/7</span>
                <span className="hero-stat-label">Support</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">&lt;24h</span>
                <span className="hero-stat-label">Response Time</span>
              </div>
              <div className="hero-stat">
                <span className="hero-stat-value">100%</span>
                <span className="hero-stat-label">Satisfaction</span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Contact Form Section */}
      <section className="contact-form-section">
        <Container>
          <Row className="justify-content-center">
            <Col lg={8}>
              <Card className="form-card border-0">
                <Card.Body>
                  <div className="form-header">
                    <h2 className="form-title">Send us a Message</h2>
                    <p className="form-subtitle">
                      Fill out the form below and we'll respond within 24 hours
                    </p>
                  </div>

                  {submitStatus && (
                    <Alert 
                      variant={submitStatus.type === "success" ? "success" : "danger"}
                      className={`alert-custom ${submitStatus.type === "success" ? "alert-success-custom" : ""}`}
                      onClose={() => setSubmitStatus(null)}
                      dismissible
                    >
                      {submitStatus.message}
                    </Alert>
                  )}

                  <Form onSubmit={handleSubmit}>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="form-group-custom">
                          <Form.Label className="form-label-custom">
                            Your Name *
                          </Form.Label>
                          <Form.Control
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="John Doe"
                            className="form-control-custom"
                            required
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="form-group-custom">
                          <Form.Label className="form-label-custom">
                            Email Address *
                          </Form.Label>
                          <Form.Control
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="john@example.com"
                            className="form-control-custom"
                            required
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <Form.Group className="form-group-custom">
                      <Form.Label className="form-label-custom">
                        Subject *
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        placeholder="What's this about?"
                        className="form-control-custom"
                        required
                      />
                    </Form.Group>

                    <Form.Group className="form-group-custom">
                      <Form.Label className="form-label-custom">
                        Message *
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={6}
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="Tell us more about your inquiry..."
                        className="form-control-custom"
                        required
                      />
                    </Form.Group>

                    <Button
                      type="submit"
                      className="submit-button"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Sending...
                        </>
                      ) : (
                        <>
                          📤 Send Message
                        </>
                      )}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Contact Details Section */}
      <section className="contact-details-section">
        <Container>
          <div className="text-center mb-5">
            <div className="section-badge">
              <span>📍</span>
              <span>Contact Information</span>
            </div>
            <h2 className="section-title">Other Ways to Reach Us</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem' }}>
              Choose the method that works best for you. We're available 24/7 to assist you.
            </p>
          </div>

          <Row className="g-4 mb-5">
            {contactMethods.map((method, index) => (
              <Col md={6} lg={3} key={index}>
                <a 
                  href={method.link}
                  className="contact-method-card"
                  target={method.link.startsWith('http') ? '_blank' : undefined}
                  rel={method.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  <span className="contact-method-icon">{method.icon}</span>
                  <h3 className="contact-method-title">{method.title}</h3>
                  <div className="contact-method-value">{method.value}</div>
                  <p className="contact-method-description">{method.description}</p>
                </a>
              </Col>
            ))}
          </Row>

          {/* Info Card */}
          <Row className="justify-content-center">
            <Col lg={8}>
              <div className="info-card">
                <h3 className="info-card-title">📋 Business Hours</h3>
                <p className="info-card-text">
                  Our support team is available 24/7 to help you with any questions or concerns. 
                  For technical issues, please include as much detail as possible in your message 
                  so we can assist you more effectively. We typically respond within 24 hours, 
                  but urgent matters are prioritized and may receive a response within a few hours.
                </p>
              </div>
            </Col>
          </Row>

          {/* Social Media Section */}
          <div className="social-section">
            <h3 className="social-title">Follow Us on Social Media</h3>
            <div className="social-links">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.link}
                  className="social-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="social-link-icon">{social.icon}</span>
                  <span className="social-link-name">{social.name}</span>
                </a>
              ))}
            </div>
          </div>
        </Container>
      </section>

      

      {/* Footer Space */}
      <div style={{ height: '3rem' }}></div>
    </>
  );
}

