"use client";

import { Container, Row, Col, Card, Badge } from "react-bootstrap";
import { useState, useEffect } from "react";
import Image from "next/image";

const teamMembers = [
  {
    name: "Alex Rivera",
    role: "Founder & CEO",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    bio: "Visionary leader passionate about bringing people together through gaming.",
  },
  {
    name: "Sarah Chen",
    role: "Head of Design",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face",
    bio: "Creative mastermind behind our stunning user experiences.",
  },
  {
    name: "Marcus Johnson",
    role: "Lead Developer",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    bio: "Tech wizard making real-time gaming magic happen.",
  },
  {
    name: "Emily Park",
    role: "Community Manager",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face",
    bio: "Building and nurturing our amazing global community.",
  },
];

const stats = [
  { number: "50K+", label: "Active Players", icon: "🎮" },
  { number: "1M+", label: "Parties Hosted", icon: "🎉" },
  { number: "150+", label: "Countries", icon: "🌍" },
  { number: "24/7", label: "Live Support", icon: "💬" },
];

const values = [
  {
    icon: "🎯",
    title: "Fun First",
    description: "We believe gaming should be exciting, engaging, and most importantly - FUN!",
  },
  {
    icon: "🤝",
    title: "Community",
    description: "Building meaningful connections between players across the globe.",
  },
  {
    icon: "🔒",
    title: "Trust & Safety",
    description: "Your security and fair play are our top priorities.",
  },
  {
    icon: "🚀",
    title: "Innovation",
    description: "Constantly pushing boundaries to deliver cutting-edge experiences.",
  },
];

export default function AboutUsPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <>
      <style jsx global>{`
        .about-hero {
          position: relative;
          min-height: 70vh;
          display: flex;
          align-items: center;
          overflow: hidden;
          padding: 4rem 0;
        }

        .about-hero::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            linear-gradient(135deg, rgba(202, 0, 0, 0.2) 0%, transparent 50%),
            linear-gradient(225deg, rgba(0, 245, 255, 0.15) 0%, transparent 50%),
            url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1920&q=80') center/cover;
          filter: brightness(0.3);
          z-index: 0;
        }

        .about-hero::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(to bottom, transparent 0%, var(--bg-dark) 100%);
          z-index: 1;
        }

        .hero-content {
          position: relative;
          z-index: 2;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(202, 0, 0, 0.25);
          border: 1px solid rgba(202, 0, 0, 0.4);
          padding: 0.6rem 1.25rem;
          border-radius: 3rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
          backdrop-filter: blur(10px);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(202, 0, 0, 0.4); }
          50% { box-shadow: 0 0 20px 5px rgba(202, 0, 0, 0.2); }
        }

        .hero-title {
          font-size: 4rem !important;
          font-weight: 800 !important;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          background: linear-gradient(135deg, #ffffff 0%, #e0e6ff 40%, #00f5ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 1.35rem;
          color: var(--text-muted);
          max-width: 600px;
          line-height: 1.7;
          margin-bottom: 2rem;
        }

        .hero-image-container {
          position: relative;
          z-index: 2;
        }

        .hero-image {
          width: 100%;
          max-width: 500px;
          border-radius: 2rem;
          box-shadow: 
            0 25px 80px rgba(0, 0, 0, 0.5),
            0 0 60px rgba(202, 0, 0, 0.2),
            0 0 100px rgba(0, 245, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transform: perspective(1000px) rotateY(-5deg) rotateX(5deg);
          transition: transform 0.5s ease;
        }

        .hero-image:hover {
          transform: perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1.02);
        }

        .floating-emoji {
          position: absolute;
          font-size: 3rem;
          animation: float 3s ease-in-out infinite;
          filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
        }

        .emoji-1 { top: 10%; left: -10%; animation-delay: 0s; }
        .emoji-2 { top: 60%; right: -5%; animation-delay: 0.5s; }
        .emoji-3 { bottom: 10%; left: 20%; animation-delay: 1s; }

        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }

        .stats-section {
          padding: 5rem 0;
          position: relative;
        }

        .stat-card {
          background: linear-gradient(135deg, rgba(20, 27, 45, 0.8) 0%, rgba(20, 27, 45, 0.4) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.5rem;
          padding: 2rem;
          text-align: center;
          backdrop-filter: blur(20px);
          transition: all 0.4s ease;
          height: 100%;
        }

        .stat-card:hover {
          transform: translateY(-10px);
          border-color: rgba(202, 0, 0, 0.4);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(202, 0, 0, 0.2);
        }

        .stat-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          display: block;
        }

        .stat-number {
          font-size: 2.75rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          color: var(--text-muted);
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .story-section {
          padding: 6rem 0;
          position: relative;
        }

        .story-section::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          height: 100px;
          background: linear-gradient(to bottom, transparent, var(--accent), transparent);
        }

        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(0, 245, 255, 0.1);
          border: 1px solid rgba(0, 245, 255, 0.3);
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.8rem;
          color: var(--accent-secondary);
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .section-title {
          font-size: 2.75rem !important;
          font-weight: 700 !important;
          margin-bottom: 1.5rem;
          background: linear-gradient(135deg, #ffffff 0%, #e0e6ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .story-text {
          font-size: 1.15rem;
          color: var(--text-muted);
          line-height: 1.9;
          margin-bottom: 1.5rem;
        }

        .story-image {
          width: 100%;
          border-radius: 1.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .values-section {
          padding: 6rem 0;
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.05) 0%, rgba(0, 245, 255, 0.03) 100%);
        }

        .value-card {
          background: rgba(20, 27, 45, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.5rem;
          padding: 2.5rem;
          height: 100%;
          backdrop-filter: blur(20px);
          transition: all 0.4s ease;
          position: relative;
          overflow: hidden;
        }

        .value-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), var(--accent-secondary));
          transform: scaleX(0);
          transition: transform 0.4s ease;
        }

        .value-card:hover {
          transform: translateY(-8px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .value-card:hover::before {
          transform: scaleX(1);
        }

        .value-icon {
          font-size: 3rem;
          margin-bottom: 1.5rem;
          display: block;
        }

        .value-title {
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 1rem;
        }

        .value-description {
          color: var(--text-muted);
          font-size: 1rem;
          line-height: 1.7;
        }

        .team-section {
          padding: 6rem 0;
        }

        .team-card {
          background: rgba(20, 27, 45, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.5rem;
          overflow: hidden;
          transition: all 0.4s ease;
          height: 100%;
        }

        .team-card:hover {
          transform: translateY(-10px);
          border-color: rgba(202, 0, 0, 0.4);
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.4), 0 0 30px rgba(202, 0, 0, 0.15);
        }

        .team-image-container {
          position: relative;
          overflow: hidden;
        }

        .team-image {
          width: 100%;
          height: 280px;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .team-card:hover .team-image {
          transform: scale(1.1);
        }

        .team-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60%;
          background: linear-gradient(to top, rgba(10, 14, 26, 1) 0%, transparent 100%);
        }

        .team-info {
          padding: 1.5rem;
          text-align: center;
        }

        .team-name {
          font-size: 1.35rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 0.25rem;
        }

        .team-role {
          color: var(--accent-secondary);
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 1rem;
        }

        .team-bio {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .cta-section {
          padding: 6rem 0;
          text-align: center;
          position: relative;
        }

        .cta-card {
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.2) 0%, rgba(0, 245, 255, 0.1) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 2rem;
          padding: 4rem;
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
        }

        .cta-card::before {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at center, rgba(202, 0, 0, 0.1) 0%, transparent 50%);
          animation: rotateBg 20s linear infinite;
        }

        @keyframes rotateBg {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .cta-title {
          font-size: 2.5rem !important;
          font-weight: 700 !important;
          margin-bottom: 1rem;
          position: relative;
          z-index: 1;
        }

        .cta-text {
          color: var(--text-muted);
          font-size: 1.15rem;
          margin-bottom: 2rem;
          position: relative;
          z-index: 1;
        }

        .cta-button {
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
          position: relative;
          z-index: 1;
          box-shadow: 0 10px 40px rgba(202, 0, 0, 0.4);
        }

        .cta-button:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 15px 50px rgba(202, 0, 0, 0.5);
        }

        .animate-fade-in {
          opacity: 0;
          transform: translateY(30px);
          animation: fadeInUp 0.8s ease forwards;
        }

        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        .delay-4 { animation-delay: 0.4s; }

        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 991px) {
          .hero-title {
            font-size: 3rem !important;
          }

          .hero-image {
            transform: none;
            margin-top: 3rem;
          }

          .section-title {
            font-size: 2.25rem !important;
          }
        }

        @media (max-width: 576px) {
          .hero-title {
            font-size: 2.25rem !important;
          }

          .hero-subtitle {
            font-size: 1.1rem;
          }

          .stat-card {
            padding: 1.5rem;
          }

          .stat-number {
            font-size: 2rem;
          }

          .section-title {
            font-size: 1.75rem !important;
          }

          .cta-card {
            padding: 2.5rem 1.5rem;
          }

          .cta-title {
            font-size: 1.75rem !important;
          }

          .floating-emoji {
            display: none;
          }
        }
      `}</style>

      {/* Hero Section */}
      <section className="about-hero">
        <Container>
          <Row className="align-items-center">
            <Col lg={6} className={`hero-content ${isVisible ? 'animate-fade-in' : ''}`}>
              <div className="hero-badge">
                <span>🎉</span>
                <span>Welcome to the Party!</span>
              </div>
              <h1 className="hero-title">
                Where Gaming<br />Meets Fun
              </h1>
              <p className="hero-subtitle">
                We're on a mission to create the ultimate social gaming platform where 
                friends connect, compete, and celebrate together. Every party is an adventure!
              </p>
              <div className="d-flex gap-3 flex-wrap">
                <Badge bg="dark" className="px-3 py-2" style={{ 
                  background: 'rgba(202, 0, 0, 0.3)', 
                  border: '1px solid rgba(202, 0, 0, 0.5)',
                  fontSize: '0.9rem'
                }}>
                  🎮 Real-Time Gaming
                </Badge>
                <Badge bg="dark" className="px-3 py-2" style={{ 
                  background: 'rgba(0, 245, 255, 0.2)', 
                  border: '1px solid rgba(0, 245, 255, 0.4)',
                  fontSize: '0.9rem'
                }}>
                  💰 Secure Wallets
                </Badge>
                <Badge bg="dark" className="px-3 py-2" style={{ 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  fontSize: '0.9rem'
                }}>
                  🏆 XP & Rewards
                </Badge>
              </div>
            </Col>
            <Col lg={6} className={`hero-image-container ${isVisible ? 'animate-fade-in delay-2' : ''}`}>
              <div className="position-relative">
                <span className="floating-emoji emoji-1">🎊</span>
                <span className="floating-emoji emoji-2">🎮</span>
                <span className="floating-emoji emoji-3">🏆</span>
                <Image 
                  src="https://images.unsplash.com/photo-1511882150382-421056c89033?w=800&q=80"
                  alt="Gaming Party"
                  width={800}
                  height={600}
                  className="hero-image"
                  unoptimized
                />
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <Container>
          <Row className="g-4">
            {stats.map((stat, index) => (
              <Col md={6} lg={3} key={index} className={`animate-fade-in delay-${index + 1}`}>
                <div className="stat-card">
                  <span className="stat-icon">{stat.icon}</span>
                  <div className="stat-number">{stat.number}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Our Story Section */}
      <section className="story-section">
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={6} className="animate-fade-in">
              <Image 
                src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80"
                alt="Our Story"
                width={800}
                height={600}
                className="story-image"
                unoptimized
              />
            </Col>
            <Col lg={6} className="animate-fade-in delay-2">
              <div className="section-badge">
                <span>📖</span>
                <span>Our Story</span>
              </div>
              <h2 className="section-title">Born from a Love of Gaming</h2>
              <p className="story-text">
                RoadHunter started in 2023 with a simple idea: what if we could bring the excitement 
                of party games to the digital world? We wanted to create a space where distance doesn't 
                matter, where friends can gather, laugh, and compete no matter where they are.
              </p>
              <p className="story-text">
                Today, we're proud to host millions of gaming sessions, connecting players from over 
                150 countries. Every feature we build, every game we add, is designed with one goal 
                in mind – to bring more joy and connection to your gaming experience.
              </p>
              <div className="d-flex gap-3 mt-4">
                <div className="text-center">
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent)' }}>2023</div>
                  <small style={{ color: 'var(--text-dim)' }}>Founded</small>
                </div>
                <div className="text-center">
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-secondary)' }}>50+</div>
                  <small style={{ color: 'var(--text-dim)' }}>Team Members</small>
                </div>
                <div className="text-center">
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)' }}>∞</div>
                  <small style={{ color: 'var(--text-dim)' }}>Possibilities</small>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Our Values Section */}
      <section className="values-section">
        <Container>
          <div className="text-center mb-5 animate-fade-in">
            <div className="section-badge">
              <span>💎</span>
              <span>Our Values</span>
            </div>
            <h2 className="section-title">What Drives Us</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem' }}>
              These core values guide every decision we make and every feature we build.
            </p>
          </div>
          <Row className="g-4">
            {values.map((value, index) => (
              <Col md={6} lg={3} key={index} className={`animate-fade-in delay-${index + 1}`}>
                <div className="value-card">
                  <span className="value-icon">{value.icon}</span>
                  <h3 className="value-title">{value.title}</h3>
                  <p className="value-description">{value.description}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Team Section */}
      <section className="team-section">
        <Container>
          <div className="text-center mb-5 animate-fade-in">
            <div className="section-badge">
              <span>👥</span>
              <span>The Team</span>
            </div>
            <h2 className="section-title">Meet the Party Crew</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem' }}>
              The passionate people behind RoadHunter who work tirelessly to bring you the best gaming experience.
        </p>
      </div>
          <Row className="g-4">
            {teamMembers.map((member, index) => (
              <Col md={6} lg={3} key={index} className={`animate-fade-in delay-${index + 1}`}>
                <div className="team-card">
                  <div className="team-image-container">
                    <Image 
                      src={member.image}
                      alt={member.name}
                      width={400}
                      height={280}
                      className="team-image"
                      unoptimized
                    />
                    <div className="team-overlay"></div>
                  </div>
                  <div className="team-info">
                    <h4 className="team-name">{member.name}</h4>
                    <div className="team-role">{member.role}</div>
                    <p className="team-bio">{member.bio}</p>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* Party Gallery */}
      <section className="py-5">
        <Container>
          <div className="text-center mb-5 animate-fade-in">
            <div className="section-badge">
              <span>📸</span>
              <span>Gallery</span>
            </div>
            <h2 className="section-title">Party Moments</h2>
          </div>
          <Row className="g-3">
            <Col md={4} className="animate-fade-in delay-1">
              <Image 
                src="https://images.unsplash.com/photo-1529543544277-750e01beec4d?w=600&q=80"
                alt="Gaming moment"
                width={600}
                height={250}
                className="w-100 rounded-4"
                style={{ objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                unoptimized
              />
            </Col>
            <Col md={4} className="animate-fade-in delay-2">
              <Image 
                src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80"
                alt="Esports"
                width={600}
                height={250}
                className="w-100 rounded-4"
                style={{ objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                unoptimized
              />
            </Col>
            <Col md={4} className="animate-fade-in delay-3">
              <Image 
                src="https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=600&q=80"
                alt="Celebration"
                width={600}
                height={250}
                className="w-100 rounded-4"
                style={{ objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                unoptimized
              />
            </Col>
          </Row>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <Container>
          <div className="cta-card animate-fade-in">
            <h2 className="cta-title">Ready to Join the Party?</h2>
            <p className="cta-text">
              Thousands of players are already having the time of their lives. Don't miss out on the fun!
            </p>
            <button className="cta-button">
              🎮 Start Playing Now
            </button>
          </div>
        </Container>
    </section>

      {/* Footer Space */}
      <div style={{ height: '3rem' }}></div>
    </>
  );
}
