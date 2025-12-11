"use client";

import { Container, Row, Col, Card, Nav } from "react-bootstrap";
import { useState, useEffect } from "react";
import Link from "next/link";

const sections = [
  { id: "acceptance", title: "Acceptance of Terms", icon: "✓" },
  { id: "eligibility", title: "Eligibility", icon: "👤" },
  { id: "use", title: "Use of Website", icon: "🌐" },
  { id: "services", title: "Services & Disclaimers", icon: "⚡" },
  { id: "intellectual", title: "Intellectual Property", icon: "©" },
  { id: "accounts", title: "User Accounts", icon: "🔐" },
  { id: "liability", title: "Limitation of Liability", icon: "⚖️" },
  { id: "thirdparty", title: "Third-Party Links", icon: "🔗" },
  { id: "privacy", title: "Privacy Policy", icon: "🛡️" },
  { id: "modifications", title: "Modifications", icon: "📝" },
  { id: "governing", title: "Governing Law", icon: "📜" },
  { id: "contact", title: "Contact Information", icon: "📧" },
];

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState("acceptance");
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
      
      // Update active section based on scroll position
      const sectionElements = sections.map(s => ({
        id: s.id,
        element: document.getElementById(s.id)
      }));
      
      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const section = sectionElements[i];
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= 150) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: "smooth", 
        block: "start"
      });
    }
  };

  return (
    <>
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }

        .terms-hero {
          position: relative;
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 6rem 0;
          text-align: center;
        }

        .terms-hero::before {
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

        .terms-hero::after {
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

        .terms-hero-content {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }

        .terms-title {
          font-size: 4.5rem !important;
          font-weight: 800 !important;
          line-height: 1.1;
          background: linear-gradient(135deg, #ffffff 0%, #e0e6ff 30%, #00f5ff 70%, #ff2d95 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: none;
          margin-bottom: 1.5rem;
          letter-spacing: -1px;
          animation: titleFadeIn 1s ease-out;
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

        .terms-subtitle {
          font-size: 1.4rem;
          color: rgba(255, 255, 255, 0.9);
          max-width: 700px;
          margin: 0 auto 2.5rem;
          line-height: 1.8;
          text-shadow: 0 2px 10px rgba(255, 255, 255, 0.1);
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

        .terms-badge {
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

        .terms-badge-icon {
          font-size: 1rem;
        }

        .terms-toc {
          position: sticky;
          top: 100px;
          max-height: calc(100vh - 150px);
          overflow-y: auto;
          padding-right: 1rem;
        }

        .terms-toc::-webkit-scrollbar {
          width: 3px;
        }

        .terms-toc::-webkit-scrollbar-thumb {
          background: var(--accent);
          border-radius: 3px;
        }

        .toc-card {
          background: rgba(20, 27, 45, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 1.5rem !important;
          backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }

        .toc-card:hover {
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 
            0 12px 48px rgba(0, 0, 0, 0.5),
            0 0 40px rgba(202, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .toc-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--text-dim);
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .toc-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem !important;
          border-radius: 0.75rem !important;
          cursor: pointer;
          transition: all 0.3s ease;
          color: var(--text-muted);
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          border: 1px solid transparent !important;
          user-select: none;
          background: rgba(255, 255, 255, 0.03);
          width: 100%;
          text-align: left;
          outline: none;
        }

        .toc-item:focus {
          outline: none;
          box-shadow: none;
        }

        .toc-item:active {
          transform: scale(0.98);
        }

        .toc-item:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
          transform: translateX(5px);
        }

        .toc-item.active {
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.25) 0%, rgba(202, 0, 0, 0.15) 100%);
          border-color: rgba(202, 0, 0, 0.4) !important;
          color: var(--text-primary);
          box-shadow: 0 4px 15px rgba(202, 0, 0, 0.2);
        }

        .toc-item.active .toc-icon {
          transform: scale(1.15);
        }

        .toc-icon {
          font-size: 0.9rem;
          width: 24px;
          text-align: center;
          transition: transform 0.25s ease;
        }

        .terms-content-card {
          background: rgba(20, 27, 45, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 1.5rem !important;
          backdrop-filter: blur(20px) saturate(180%);
          overflow: hidden;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }

        .terms-content-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 
            0 12px 48px rgba(0, 0, 0, 0.5),
            0 0 40px rgba(0, 245, 255, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .terms-section {
          padding: 2.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
          scroll-margin-top: 120px;
        }

        .terms-section:last-child {
          border-bottom: none;
        }

        .terms-section:hover {
          background: rgba(255, 255, 255, 0.02);
          transform: translateX(5px);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .section-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.25) 0%, rgba(0, 245, 255, 0.15) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          font-size: 1.5rem;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
        }

        .terms-section:hover .section-icon {
          transform: scale(1.1) rotate(5deg);
          box-shadow: 0 6px 20px rgba(202, 0, 0, 0.3);
        }

        .section-title {
          font-size: 1.75rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin: 0;
          background: linear-gradient(135deg, #ffffff 0%, #e0e6ff 50%, #00f5ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 2px 15px rgba(255, 255, 255, 0.2);
        }

        .section-content {
          color: rgba(255, 255, 255, 0.85);
          font-size: 1.05rem;
          line-height: 1.9;
          text-shadow: 0 1px 5px rgba(255, 255, 255, 0.1);
        }

        .section-content p {
          margin-bottom: 1rem;
        }

        .section-content ul {
          list-style: none;
          padding: 0;
          margin: 1rem 0;
        }

        .section-content li {
          position: relative;
          padding-left: 1.75rem;
          margin-bottom: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
        }

        .section-content li::before {
          content: "›";
          position: absolute;
          left: 0;
          color: var(--accent);
          font-weight: 700;
          font-size: 1.25rem;
          line-height: 1.4;
        }

        .highlight-box {
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.15) 0%, rgba(0, 245, 255, 0.1) 100%);
          border: 1px solid rgba(202, 0, 0, 0.3);
          border-radius: 1.25rem;
          padding: 1.5rem 2rem;
          margin: 1.5rem 0;
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
        }

        .highlight-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(202, 0, 0, 0.3);
        }

        .highlight-box p {
          margin: 0;
          color: var(--text-secondary);
        }

        .contact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          background: rgba(20, 27, 45, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1rem;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .contact-item:hover {
          background: rgba(20, 27, 45, 0.7);
          border-color: rgba(202, 0, 0, 0.4);
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }

        .contact-icon {
          font-size: 1.5rem;
        }

        .contact-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-dim);
          margin-bottom: 0.25rem;
        }

        .contact-value {
          color: var(--text-primary);
          font-weight: 500;
        }

        .terms-footer {
          text-align: center;
          padding: 3rem 0;
          margin-top: 2rem;
        }

        .footer-divider {
          width: 100px;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
          margin: 0 auto 2rem;
          border-radius: 3px;
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 2rem;
          flex-wrap: wrap;
          margin-top: 1.5rem;
        }

        .footer-link {
          color: var(--text-muted) !important;
          font-size: 0.9rem;
          transition: all 0.3s ease;
        }

        .footer-link:hover {
          color: var(--accent-secondary) !important;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }

        @media (max-width: 991px) {
          .terms-toc {
            position: relative;
            top: 0;
            max-height: none;
            margin-bottom: 2rem;
          }

          .toc-items {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }

          .terms-title {
            font-size: 2.5rem !important;
          }

          .terms-section {
            padding: 1.75rem;
          }
        }

        @media (max-width: 576px) {
          .terms-hero {
            padding: 3rem 0 2.5rem;
          }

          .terms-title {
            font-size: 2rem !important;
          }

          .terms-subtitle {
            font-size: 1rem;
          }

          .toc-items {
            grid-template-columns: 1fr;
          }

          .terms-section {
            padding: 1.25rem;
          }

          .section-icon {
            width: 40px;
            height: 40px;
            font-size: 1rem;
          }

          .section-title {
            font-size: 1.25rem !important;
          }

          .contact-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Hero Section */}
      <section className="terms-hero">
        <Container>
          <div className="terms-hero-content text-center animate-in">
            <div className="terms-badge">
              <span className="terms-badge-icon">📋</span>
              <span>Legal Documentation</span>
            </div>
            <h1 className="terms-title">Terms & Conditions</h1>
            <p className="terms-subtitle">
              Please read these Terms & Conditions carefully before using RoadHunter services. 
              By accessing our platform, you agree to be bound by these terms.
            </p>
          </div>
        </Container>
      </section>

      {/* Main Content */}
      <Container className="py-5">
        <Row>
          {/* Table of Contents - Sidebar */}
          <Col lg={3} className="animate-in delay-1">
            <div className="terms-toc">
              <Card className="toc-card border-0">
                <Card.Body className="p-3">
                  <div className="toc-title">Table of Contents</div>
                  <div className="toc-items">
                    {sections.map((section) => (
                      <button
                        type="button"
                        key={section.id}
                        className={`toc-item ${activeSection === section.id ? "active" : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToSection(section.id);
                        }}
                      >
                        <span className="toc-icon">{section.icon}</span>
                        <span>{section.title}</span>
                      </button>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </div>
          </Col>

          {/* Terms Content */}
          <Col lg={9} className="animate-in delay-2">
            <Card className="terms-content-card border-0">
              {/* Last Updated */}
              <div className="px-4 pt-4">
                <small style={{ color: "var(--text-dim)" }}>
                  Last Updated: December 10, 2025
                </small>
              </div>

              {/* Section 1: Acceptance */}
              <section id="acceptance" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">✓</div>
                  <h2 className="section-title">1. Acceptance of Terms</h2>
                </div>
                <div className="section-content">
                  <p>
                    Welcome to RoadHunter. By accessing or using our website, services, applications, 
                    or tools, you agree to the following Terms & Conditions. If you do not agree with 
                    these terms, please discontinue use of the platform.
                  </p>
                  <div className="highlight-box">
                    <p>
                      By using RoadHunter, you agree to be bound by these Terms & Conditions and any 
                      additional policies referenced herein. These terms apply to all visitors, users, 
                      and customers engaging with our services.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 2: Eligibility */}
              <section id="eligibility" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">👤</div>
                  <h2 className="section-title">2. Eligibility</h2>
                </div>
                <div className="section-content">
                  <p>
                    You must be at least 18 years old to access or use RoadHunter. By using our website, 
                    you confirm that:
                  </p>
                  <ul>
                    <li>You are legally able to enter into a binding agreement.</li>
                    <li>The information you provide is accurate and lawful.</li>
                    <li>You have the legal capacity to comply with these Terms.</li>
                  </ul>
                </div>
              </section>

              {/* Section 3: Use of Website */}
              <section id="use" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">🌐</div>
                  <h2 className="section-title">3. Use of the Website</h2>
                </div>
                <div className="section-content">
                  <p>Users agree not to:</p>
                  <ul>
                    <li>Violate any applicable laws or regulations.</li>
                    <li>Engage in unauthorized access, data scraping, or hacking attempts.</li>
                    <li>Upload harmful content including malware or abusive material.</li>
                    <li>Attempt to interfere with or disrupt the platform's functionality.</li>
                    <li>Impersonate any person or entity or misrepresent your affiliation.</li>
                  </ul>
                  <div className="highlight-box">
                    <p>
                      RoadHunter reserves the right to suspend or block access if misuse is detected, 
                      without prior notice or liability.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 4: Services & Disclaimers */}
              <section id="services" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">⚡</div>
                  <h2 className="section-title">4. Services & Disclaimers</h2>
                </div>
                <div className="section-content">
                  <p>
                    RoadHunter provides online tools, assistance, content, and resources. We reserve 
                    the right to modify, update, or discontinue parts of our services at any time 
                    without notice.
                  </p>
                  <p>We do not guarantee:</p>
                  <ul>
                    <li>Continuous availability of the website.</li>
                    <li>Accuracy, completeness, or timeliness of the provided information.</li>
                    <li>That the service will meet your specific requirements.</li>
                    <li>That the service will be uninterrupted, secure, or error-free.</li>
                  </ul>
                  <div className="highlight-box">
                    <p>All services are provided "as-is" and "as available" without warranties of any kind.</p>
                  </div>
                </div>
              </section>

              {/* Section 5: Intellectual Property */}
              <section id="intellectual" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">©</div>
                  <h2 className="section-title">5. Intellectual Property Rights</h2>
                </div>
                <div className="section-content">
                  <p>
                    All content on RoadHunter—including logos, text, graphics, videos, layouts, and 
                    digital materials—is the property of RoadHunter and protected by copyright laws.
                  </p>
                  <p>Users are not permitted to:</p>
                  <ul>
                    <li>Copy, reproduce, or distribute content without permission.</li>
                    <li>Use RoadHunter branding for commercial purposes.</li>
                    <li>Modify, create derivative works, or reverse engineer any content.</li>
                    <li>Remove any copyright or proprietary notices from materials.</li>
                  </ul>
                </div>
              </section>

              {/* Section 6: User Accounts */}
              <section id="accounts" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">🔐</div>
                  <h2 className="section-title">6. User Accounts</h2>
                </div>
                <div className="section-content">
                  <p>If RoadHunter offers account registration:</p>
                  <ul>
                    <li>You are responsible for maintaining confidentiality of your login details.</li>
                    <li>You must notify RoadHunter immediately of unauthorized access.</li>
                    <li>You are responsible for all activities under your account.</li>
                    <li>RoadHunter holds the right to terminate accounts at its discretion.</li>
                  </ul>
                  <div className="highlight-box">
                    <p>
                      Keep your account credentials secure. You are solely responsible for any activities 
                      that occur under your account.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 7: Limitation of Liability */}
              <section id="liability" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">⚖️</div>
                  <h2 className="section-title">7. Limitation of Liability</h2>
                </div>
                <div className="section-content">
                  <p>RoadHunter is not liable for:</p>
                  <ul>
                    <li>Direct, indirect, incidental, or consequential damages.</li>
                    <li>Loss of data, profits, or business opportunities.</li>
                    <li>Issues caused by third-party providers or unauthorized access.</li>
                    <li>Any damages resulting from your use or inability to use the service.</li>
                  </ul>
                  <div className="highlight-box">
                    <p>
                      Your use of the platform is at your own risk. RoadHunter's total liability shall 
                      not exceed the amount paid by you, if any, for accessing our services.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 8: Third-Party Links */}
              <section id="thirdparty" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">🔗</div>
                  <h2 className="section-title">8. Third-Party Links</h2>
                </div>
                <div className="section-content">
                  <p>
                    Our website may contain links to third-party websites. RoadHunter does not endorse 
                    or assume responsibility for third-party content, privacy practices, or services.
                  </p>
                  <p>
                    We encourage you to review the terms and privacy policies of any third-party 
                    websites you visit through links on our platform.
                  </p>
                </div>
              </section>

              {/* Section 9: Privacy Policy */}
              <section id="privacy" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">🛡️</div>
                  <h2 className="section-title">9. Privacy Policy</h2>
                </div>
                <div className="section-content">
                  <p>
                    Your data use is governed by the RoadHunter Privacy Policy. We are committed to 
                    protecting your personal information and maintaining transparency about our data 
                    practices.
                  </p>
                  <div className="highlight-box">
                    <p>
                      For detailed information about how we collect, use, and protect your data, 
                      please review our <Link href="/privacy" style={{ color: "var(--accent-secondary)" }}>Privacy Policy</Link>.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 10: Modifications */}
              <section id="modifications" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">📝</div>
                  <h2 className="section-title">10. Modifications to Terms</h2>
                </div>
                <div className="section-content">
                  <p>
                    RoadHunter may update these Terms & Conditions at any time. Changes become 
                    effective upon posting to this page.
                  </p>
                  <p>
                    Continued use of the website signifies acceptance of updated terms. We encourage 
                    you to periodically review this page for the latest information on our terms.
                  </p>
                </div>
              </section>

              {/* Section 11: Governing Law */}
              <section id="governing" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">📜</div>
                  <h2 className="section-title">11. Governing Law</h2>
                </div>
                <div className="section-content">
                  <p>
                    These Terms are governed by the laws of India. Any disputes will be handled in the 
                    appropriate courts of that jurisdiction.
                  </p>
                  <p>
                    You agree to submit to the exclusive jurisdiction of the courts located in India 
                    for the resolution of any disputes arising from these Terms.
                  </p>
                </div>
              </section>

              {/* Section 12: Contact */}
              <section id="contact" className="terms-section">
                <div className="section-header">
                  <div className="section-icon">📧</div>
                  <h2 className="section-title">12. Contact Information</h2>
                </div>
                <div className="section-content">
                  <p>
                    For questions about these Terms & Conditions, please contact us through the 
                    following channels:
                  </p>
                  <div className="contact-grid">
                    <div className="contact-item">
                      <span className="contact-icon">📧</span>
                      <div>
                        <div className="contact-label">Email</div>
                        <div className="contact-value">support@roadhunter.com</div>
                      </div>
                    </div>
                    <div className="contact-item">
                      <span className="contact-icon">🌐</span>
                      <div>
                        <div className="contact-label">Website</div>
                        <div className="contact-value">www.roadhunter.com</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </Card>

            {/* Footer */}
            <div className="terms-footer animate-in delay-3">
              <div className="footer-divider"></div>
              <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                © {new Date().getFullYear()} RoadHunter. All Rights Reserved.
              </p>
              <div className="footer-links">
                <Link href="/" className="footer-link">Home</Link>
                <Link href="/privacy" className="footer-link">Privacy Policy</Link>
                <Link href="/support" className="footer-link">Support</Link>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </>
  );
}

