"use client";

import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const steps = [
  {
    number: "01",
    icon: "🚀",
    title: "Create Your Account",
    subtitle: "Quick & Secure Setup",
    description: "Sign up in seconds with your email or Google account. Our secure authentication powered by Firebase keeps your data safe.",
    features: ["Email or Google Sign-in", "Secure Firebase Auth", "Instant Account Activation"],
    color: "#ff2d95",
  },
  {
    number: "02",
    icon: "👤",
    title: "Complete Your Profile",
    subtitle: "Unlock All Features",
    description: "Set up your gaming identity with a unique username and avatar. Complete your profile to unlock wallet access and referral codes.",
    features: ["Choose Your Username", "Upload Custom Avatar", "Unlock Premium Features"],
    color: "#00f5ff",
  },
  {
    number: "03",
    icon: "💰",
    title: "Load Your Wallet",
    subtitle: "Get Party Coins",
    description: "Add Party Coins to your secure wallet. Track your balance, view transaction history, and manage your gaming funds all in one place.",
    features: ["Instant Coin Loading", "Real-time Balance Updates", "Full Transaction History"],
    color: "#ffd700",
  },
  {
    number: "04",
    icon: "🎉",
    title: "Join the Party",
    subtitle: "Create or Join Rooms",
    description: "Browse active party rooms or create your own. Host public parties for everyone or private rooms for your squad.",
    features: ["Browse Live Parties", "Create Custom Rooms", "Public or Private Options"],
    color: "#ff7a18",
  },
  {
    number: "05",
    icon: "🎮",
    title: "Play & Compete",
    subtitle: "Real-time Gaming",
    description: "Engage in exciting games with real-time competition. Send gifts, interact with other players, and climb the leaderboards.",
    features: ["Live Multiplayer Games", "Send Virtual Gifts", "Real-time Interactions"],
    color: "#9d4edd",
  },
  {
    number: "06",
    icon: "⭐",
    title: "Earn & Level Up",
    subtitle: "Rewards & Progression",
    description: "Earn XP from every activity. Level up to unlock exclusive badges, higher withdrawal limits, and special perks.",
    features: ["XP Progression System", "Exclusive Badges", "Level-based Rewards"],
    color: "#00d9ff",
  },
  {
    number: "07",
    icon: "🤝",
    title: "Invite Friends",
    subtitle: "Referral Bonuses",
    description: "Share your unique 10-digit referral code. Earn 5% XP boost on every friend's activity. Build your network and earn together!",
    features: ["Unique Referral Code", "5% XP Commission", "Unlimited Referrals"],
    color: "#ff2d95",
  },
];

const features = [
  { icon: "⚡", title: "Real-time Sync", description: "Lightning-fast updates with Socket.IO technology" },
  { icon: "🔒", title: "Secure Wallets", description: "Bank-grade security for your Party Coins" },
  { icon: "🌍", title: "Global Access", description: "Play with friends from 150+ countries" },
  { icon: "📱", title: "Mobile Ready", description: "Seamless experience on any device" },
];

export default function HowItWorksPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const stepsRef = useRef([]);

  useEffect(() => {
    setIsVisible(true);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = stepsRef.current.indexOf(entry.target);
            if (index !== -1) {
              setActiveStep(index);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    stepsRef.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style jsx global>{`
        .hiw-hero {
          position: relative;
          min-height: 80vh;
          display: flex;
          align-items: center;
          overflow: hidden;
          padding: 5rem 0;
        }

        .hiw-hero::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 50%, rgba(255, 45, 149, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(0, 245, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 50% 100%, rgba(255, 122, 24, 0.1) 0%, transparent 50%);
          z-index: 0;
        }

        .hero-content {
          position: relative;
          z-index: 2;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(0, 245, 255, 0.15);
          border: 1px solid rgba(0, 245, 255, 0.3);
          padding: 0.6rem 1.25rem;
          border-radius: 3rem;
          font-size: 0.9rem;
          color: var(--accent-secondary);
          margin-bottom: 1.5rem;
          backdrop-filter: blur(10px);
        }

        .hero-title {
          font-size: 4.5rem !important;
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
          max-width: 550px;
          line-height: 1.7;
        }

        .steps-nav {
          background: rgba(20, 27, 45, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          padding: 1.5rem;
          backdrop-filter: blur(20px);
          width: 100%;
          max-width: 320px;
        }

        .steps-nav-title {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--text-dim);
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .steps-counter {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .step-nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 1px solid transparent;
          background: transparent;
          width: 100%;
          text-align: left;
        }

        .step-nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .step-nav-item.active {
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.15) 0%, rgba(0, 245, 255, 0.1) 100%);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .step-dot {
          width: 36px;
          height: 36px;
          min-width: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          transition: all 0.3s ease;
          position: relative;
        }

        .step-nav-item.active .step-dot {
          background: var(--step-color);
          border-color: var(--step-color);
          box-shadow: 0 0 20px var(--step-color);
          transform: scale(1.1);
        }

        .step-nav-item:hover .step-dot {
          border-color: rgba(255, 255, 255, 0.4);
        }

        .step-nav-info {
          flex: 1;
          min-width: 0;
        }

        .step-nav-number {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-dim);
          margin-bottom: 0.15rem;
        }

        .step-nav-item.active .step-nav-number {
          color: var(--step-color);
        }

        .step-nav-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.3s ease;
        }

        .step-nav-item.active .step-nav-name {
          color: var(--text-primary);
        }

        .step-nav-item:hover .step-nav-name {
          color: var(--text-secondary);
        }

        .step-nav-arrow {
          opacity: 0;
          transform: translateX(-5px);
          transition: all 0.3s ease;
          color: var(--accent-secondary);
        }

        .step-nav-item.active .step-nav-arrow,
        .step-nav-item:hover .step-nav-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        .step-connector {
          width: 2px;
          height: 20px;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2));
          margin-left: 1.75rem;
        }

        .steps-section {
          padding: 4rem 0;
          position: relative;
        }

        .step-card {
          position: relative;
          padding: 4rem 0;
        }

        .step-number {
          font-size: 8rem;
          font-weight: 900;
          position: absolute;
          top: 0;
          opacity: 0.08;
          line-height: 1;
          pointer-events: none;
        }

        .step-number.left {
          left: -2rem;
        }

        .step-number.right {
          right: -2rem;
        }

        .step-content-card {
          background: rgba(20, 27, 45, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 2rem;
          padding: 3rem;
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
          transition: all 0.4s ease;
          height: 100%;
        }

        .step-content-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: var(--step-color);
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .step-content-card:hover {
          transform: translateY(-8px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
        }

        .step-content-card:hover::before {
          opacity: 1;
        }

        .step-icon-wrapper {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          margin-bottom: 1.5rem;
          position: relative;
        }

        .step-icon-wrapper::after {
          content: "";
          position: absolute;
          inset: -3px;
          border-radius: 1.75rem;
          background: var(--step-color);
          opacity: 0.3;
          filter: blur(15px);
          z-index: -1;
        }

        .step-subtitle {
          color: var(--step-color);
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 0.5rem;
        }

        .step-title {
          font-size: 2rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 1rem;
        }

        .step-description {
          color: var(--text-muted);
          font-size: 1.1rem;
          line-height: 1.8;
          margin-bottom: 1.5rem;
        }

        .step-features {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .step-features li {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .step-features li::before {
          content: "✓";
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: rgba(0, 245, 255, 0.15);
          color: var(--accent-secondary);
          border-radius: 50%;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .step-image-wrapper {
          position: relative;
          height: 100%;
          display: flex;
          align-items: center;
        }

        .step-image {
          width: 100%;
          height: 350px;
          object-fit: cover;
          border-radius: 1.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: transform 0.5s ease;
        }

        .step-image:hover {
          transform: scale(1.02);
        }

        /* Hero Image Section */
        .hero-image-section {
          padding: 4rem 0;
          position: relative;
        }

        .main-image-wrapper {
          position: relative;
        }

        .main-hero-image {
          width: 100%;
          height: 450px;
          object-fit: cover;
          border-radius: 2rem;
          box-shadow: 
            0 30px 80px rgba(0, 0, 0, 0.5),
            0 0 60px rgba(202, 0, 0, 0.15),
            0 0 100px rgba(0, 245, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .image-overlay-badge {
          position: absolute;
          top: 1.5rem;
          left: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          padding: 0.75rem 1.25rem;
          border-radius: 3rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .image-stats {
          position: absolute;
          bottom: -1.5rem;
          right: 1.5rem;
          display: flex;
          gap: 1rem;
        }

        .image-stat {
          background: rgba(20, 27, 45, 0.95);
          backdrop-filter: blur(20px);
          padding: 1rem 1.5rem;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          text-align: center;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .image-stat .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .image-stat .stat-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .quick-stats-row {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .quick-stat {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(20, 27, 45, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1rem 1.25rem;
          border-radius: 1rem;
          backdrop-filter: blur(10px);
        }

        .quick-stat-icon {
          font-size: 1.5rem;
        }

        .quick-stat-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .quick-stat-label {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Step Grid Cards */
        .step-grid-card {
          background: rgba(20, 27, 45, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.5rem;
          padding: 2rem;
          backdrop-filter: blur(20px);
          transition: all 0.4s ease;
          height: 100%;
          position: relative;
          overflow: hidden;
        }

        .step-grid-card:hover {
          transform: translateY(-8px);
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
        }

        .step-grid-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .step-grid-number {
          font-size: 0.75rem;
          font-weight: 800;
          color: white;
          padding: 0.35rem 0.75rem;
          border-radius: 2rem;
        }

        .step-grid-icon {
          font-size: 2.5rem;
        }

        .step-grid-subtitle {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 0.5rem;
        }

        .step-grid-title {
          font-size: 1.35rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 0.75rem;
        }

        .step-grid-description {
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.7;
          margin-bottom: 1rem;
        }

        .step-grid-features {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .step-grid-features li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .feature-check {
          font-weight: 700;
        }

        .step-grid-line {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
        }

        /* Step CTA Card */
        .step-cta-card {
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.2) 0%, rgba(0, 245, 255, 0.1) 100%);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 1.5rem;
          padding: 2.5rem 2rem;
          backdrop-filter: blur(20px);
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .step-cta-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .step-cta-title {
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 0.75rem;
        }

        .step-cta-text {
          color: var(--text-muted);
          font-size: 0.95rem;
          margin-bottom: 1.5rem;
        }

        .step-cta-button {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-tertiary) 100%);
          border: none;
          padding: 0.85rem 2rem;
          font-size: 0.9rem;
          font-weight: 700;
          border-radius: 3rem;
          color: white !important;
          text-transform: uppercase;
          letter-spacing: 1px;
          transition: all 0.3s ease;
          text-decoration: none;
          box-shadow: 0 8px 30px rgba(202, 0, 0, 0.4);
        }

        .step-cta-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(202, 0, 0, 0.5);
          color: white !important;
        }

        /* Features Image */
        .features-image-wrapper {
          position: relative;
        }

        .features-main-image {
          width: 100%;
          height: 400px;
          object-fit: cover;
          border-radius: 2rem;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .features-image-float {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(20, 27, 45, 0.95);
          backdrop-filter: blur(20px);
          padding: 0.75rem 1.25rem;
          border-radius: 3rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          animation: floatBadge 3s ease-in-out infinite;
        }

        .features-float-1 {
          top: 2rem;
          right: -1rem;
          animation-delay: 0s;
        }

        .features-float-2 {
          bottom: 3rem;
          left: -1rem;
          animation-delay: 1.5s;
        }

        @keyframes floatBadge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        /* Feature Mini Cards */
        .feature-mini-card {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          background: rgba(20, 27, 45, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1.25rem;
          border-radius: 1rem;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          height: 100%;
        }

        .feature-mini-card:hover {
          background: rgba(20, 27, 45, 0.7);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-3px);
        }

        .feature-mini-icon {
          font-size: 1.75rem;
          min-width: 40px;
        }

        .feature-mini-title {
          font-size: 1rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 0.25rem;
        }

        .feature-mini-description {
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1.5;
          margin: 0;
        }

        .features-section {
          padding: 6rem 0;
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

        .feature-card {
          background: rgba(20, 27, 45, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.5rem;
          padding: 2rem;
          text-align: center;
          backdrop-filter: blur(20px);
          transition: all 0.4s ease;
          height: 100%;
        }

        .feature-card:hover {
          transform: translateY(-8px);
          border-color: rgba(0, 245, 255, 0.3);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 30px rgba(0, 245, 255, 0.1);
        }

        .feature-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          display: block;
        }

        .feature-title {
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          color: var(--text-primary) !important;
          margin-bottom: 0.5rem;
        }

        .feature-description {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .cta-section {
          padding: 6rem 0;
          text-align: center;
        }

        .cta-card {
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.2) 0%, rgba(0, 245, 255, 0.1) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 2rem;
          padding: 5rem 3rem;
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
        }

        .cta-card::before {
          content: "";
          position: absolute;
          top: -100%;
          left: -100%;
          width: 300%;
          height: 300%;
          background: conic-gradient(from 0deg, transparent, rgba(202, 0, 0, 0.1), transparent, rgba(0, 245, 255, 0.1), transparent);
          animation: rotateCTA 15s linear infinite;
        }

        @keyframes rotateCTA {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .cta-content {
          position: relative;
          z-index: 1;
        }

        .cta-title {
          font-size: 3rem !important;
          font-weight: 700 !important;
          margin-bottom: 1rem;
        }

        .cta-text {
          color: var(--text-muted);
          font-size: 1.2rem;
          margin-bottom: 2.5rem;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        .cta-buttons {
          display: flex;
          justify-content: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .cta-button-primary {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-tertiary) 100%);
          border: none;
          padding: 1rem 2.5rem;
          font-size: 1.1rem;
          font-weight: 700;
          border-radius: 3rem;
          color: white;
          text-transform: uppercase;
          letter-spacing: 1px;
          transition: all 0.3s ease;
          box-shadow: 0 10px 40px rgba(202, 0, 0, 0.4);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .cta-button-primary:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 15px 50px rgba(202, 0, 0, 0.5);
          color: white;
        }

        .cta-button-secondary {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 1rem 2.5rem;
          font-size: 1.1rem;
          font-weight: 600;
          border-radius: 3rem;
          color: var(--text-primary);
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .cta-button-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-3px);
          color: white;
        }

        .journey-line {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: linear-gradient(to bottom, 
            rgba(255, 45, 149, 0.5) 0%,
            rgba(0, 245, 255, 0.5) 50%,
            rgba(255, 122, 24, 0.5) 100%);
          transform: translateX(-50%);
          z-index: 0;
        }

        .animate-fade-in {
          opacity: 0;
          transform: translateY(40px);
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

          .main-hero-image {
            height: 350px;
          }

          .image-stats {
            position: relative;
            bottom: auto;
            right: auto;
            margin-top: 1rem;
            justify-content: center;
          }

          .features-main-image {
            height: 300px;
            margin-bottom: 2rem;
          }

          .features-float-1,
          .features-float-2 {
            display: none;
          }

          .section-title {
            font-size: 2rem !important;
          }

          .cta-title {
            font-size: 2rem !important;
          }

          .journey-line {
            display: none;
          }

          .quick-stats-row {
            justify-content: center;
          }
        }

        @media (max-width: 576px) {
          .hiw-hero {
            min-height: 60vh;
            padding: 3rem 0;
          }

          .hero-title {
            font-size: 2.25rem !important;
          }

          .hero-subtitle {
            font-size: 1.1rem;
          }

          .hero-image-section {
            padding: 2rem 0;
          }

          .main-hero-image {
            height: 250px;
          }

          .image-stats {
            flex-direction: row;
            gap: 0.75rem;
          }

          .image-stat {
            padding: 0.75rem 1rem;
          }

          .image-stat .stat-value {
            font-size: 1.25rem;
          }

          .quick-stats-row {
            gap: 0.75rem;
          }

          .quick-stat {
            padding: 0.75rem 1rem;
            flex: 1;
            min-width: 0;
          }

          .quick-stat-value {
            font-size: 1rem;
          }

          .step-grid-card {
            padding: 1.5rem;
          }

          .step-grid-icon {
            font-size: 2rem;
          }

          .step-grid-title {
            font-size: 1.15rem !important;
          }

          .features-main-image {
            height: 220px;
          }

          .feature-mini-card {
            padding: 1rem;
          }

          .feature-mini-icon {
            font-size: 1.5rem;
            min-width: 32px;
          }

          .step-card {
            padding: 2rem 0;
          }

          .step-number {
            font-size: 4rem;
            top: -1rem;
          }

          .step-content-card {
            padding: 1.5rem;
          }

          .step-icon-wrapper {
            width: 60px;
            height: 60px;
            font-size: 1.75rem;
          }

          .step-image {
            height: 200px;
          }

          .cta-card {
            padding: 3rem 1.5rem;
          }

          .cta-buttons {
            flex-direction: column;
          }
        }
      `}</style>

      {/* Hero Section */}
      <section className="hiw-hero">
        <Container>
          <Row className="align-items-center">
            <Col lg={7} className={`hero-content ${isVisible ? 'animate-fade-in' : ''}`}>
              <div className="hero-badge">
                <span>📚</span>
                <span>Step-by-Step Guide</span>
              </div>
              <h1 className="hero-title">
                How RoadHunter<br />Works
              </h1>
              <p className="hero-subtitle">
                From signup to party time in minutes. Follow our simple guide to start 
                gaming, earning, and connecting with players worldwide.
              </p>
              <div className="d-flex gap-3 mt-4 flex-wrap">
                <Link href="/user/signup" className="cta-button-primary">
                  🚀 Get Started Free
                </Link>
                <Link href="/party" className="cta-button-secondary">
                  🎮 Browse Parties
                </Link>
              </div>
            </Col>
            <Col lg={5} className={`d-none d-lg-flex justify-content-center ${isVisible ? 'animate-fade-in delay-2' : ''}`}>
              <div className="steps-nav">
                <div className="steps-nav-title">
                  <span>🗺️</span>
                  <span>Your Journey</span>
                </div>
                <div className="steps-counter">
                  {steps.map((step, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`step-nav-item ${activeStep === index ? 'active' : ''}`}
                      onClick={() => {
                        const element = stepsRef.current[index];
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      style={{ '--step-color': step.color }}
                    >
                      <div className="step-dot">
                        {step.icon}
                      </div>
                      <div className="step-nav-info">
                        <div className="step-nav-number">Step {step.number}</div>
                        <div className="step-nav-name">{step.title}</div>
                      </div>
                      <span className="step-nav-arrow">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Hero Image Section */}
      <section className="hero-image-section">
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={6} className="animate-fade-in">
              <div className="main-image-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1511882150382-421056c89033?w=800&q=80"
                  alt="Gaming Experience"
                  className="main-hero-image"
                />
                <div className="image-overlay-badge">
                  <span>🎮</span>
                  <span>Real-time Gaming</span>
                </div>
                <div className="image-stats">
                  <div className="image-stat">
                    <span className="stat-value">50K+</span>
                    <span className="stat-label">Players</span>
                  </div>
                  <div className="image-stat">
                    <span className="stat-value">1M+</span>
                    <span className="stat-label">Parties</span>
                  </div>
                </div>
              </div>
            </Col>
            <Col lg={6} className="animate-fade-in delay-2">
              <div className="section-badge mb-3">
                <span>🎯</span>
                <span>Simple Process</span>
              </div>
              <h2 className="section-title">Start Gaming in Minutes</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.15rem', lineHeight: '1.8', marginBottom: '2rem' }}>
                Our streamlined process gets you from signup to your first party in just 7 easy steps. 
                No complicated setup, no hidden fees – just pure gaming fun.
              </p>
              <div className="quick-stats-row">
                <div className="quick-stat">
                  <div className="quick-stat-icon">⚡</div>
                  <div>
                    <div className="quick-stat-value">2 min</div>
                    <div className="quick-stat-label">Setup Time</div>
                  </div>
                </div>
                <div className="quick-stat">
                  <div className="quick-stat-icon">🔒</div>
                  <div>
                    <div className="quick-stat-value">100%</div>
                    <div className="quick-stat-label">Secure</div>
                  </div>
                </div>
                <div className="quick-stat">
                  <div className="quick-stat-icon">🆓</div>
                  <div>
                    <div className="quick-stat-value">Free</div>
                    <div className="quick-stat-label">To Start</div>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Steps Section - Grid Layout */}
      <section className="steps-section">
        <Container>
          <div className="text-center mb-5">
            <div className="section-badge mb-3">
              <span>📋</span>
              <span>Step by Step</span>
            </div>
            <h2 className="section-title">Your Journey to Fun</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem' }}>
              Follow these simple steps to unlock the full RoadHunter experience
            </p>
          </div>
          <Row className="g-4">
            {steps.map((step, index) => (
              <Col md={6} lg={4} key={index}>
                <div 
                  ref={(el) => (stepsRef.current[index] = el)}
                  className="step-grid-card"
                  style={{ '--step-color': step.color }}
                >
                  <div className="step-grid-header">
                    <div className="step-grid-number" style={{ background: step.color }}>
                      {step.number}
                    </div>
                    <div className="step-grid-icon">
                      {step.icon}
                    </div>
                  </div>
                  <p className="step-grid-subtitle" style={{ color: step.color }}>{step.subtitle}</p>
                  <h3 className="step-grid-title">{step.title}</h3>
                  <p className="step-grid-description">{step.description}</p>
                  <ul className="step-grid-features">
                    {step.features.map((feature, idx) => (
                      <li key={idx}>
                        <span className="feature-check" style={{ color: step.color }}>✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="step-grid-line" style={{ background: `linear-gradient(90deg, ${step.color}, transparent)` }}></div>
                </div>
              </Col>
            ))}
            {/* Last card - CTA */}
            <Col md={6} lg={4}>
              <div className="step-cta-card">
                <div className="step-cta-icon">🚀</div>
                <h3 className="step-cta-title">Ready to Start?</h3>
                <p className="step-cta-text">Join thousands of players and start your gaming journey today!</p>
                <Link href="/user/signup" className="step-cta-button">
                  Get Started Free
                </Link>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Features Section with Image */}
      <section className="features-section">
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={5} className="order-lg-2">
              <div className="features-image-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80"
                  alt="Gaming Community"
                  className="features-main-image"
                />
                <div className="features-image-float features-float-1">
                  <span>🏆</span>
                  <span>Level Up!</span>
                </div>
                <div className="features-image-float features-float-2">
                  <span>💰</span>
                  <span>Earn Coins</span>
                </div>
              </div>
            </Col>
            <Col lg={7} className="order-lg-1">
              <div className="section-badge mb-3">
                <span>⚡</span>
                <span>Platform Features</span>
              </div>
              <h2 className="section-title">Why Choose RoadHunter?</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '2rem' }}>
                Built with cutting-edge technology for the ultimate gaming experience
              </p>
              <Row className="g-3">
                {features.map((feature, index) => (
                  <Col sm={6} key={index}>
                    <div className="feature-mini-card">
                      <span className="feature-mini-icon">{feature.icon}</span>
                      <div>
                        <h4 className="feature-mini-title">{feature.title}</h4>
                        <p className="feature-mini-description">{feature.description}</p>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Quick Start Guide */}
      <section className="py-5">
        <Container>
          <Row className="align-items-center g-5">
            <Col lg={6}>
              <Card className="glass-card border-0 p-4">
                <Card.Body>
                  <h3 className="fw-bold mb-4" style={{ color: 'var(--text-secondary)' }}>
                    🎯 Quick Start Checklist
                  </h3>
                  <div className="d-flex flex-column gap-3">
                    {[
                      { done: true, text: "Create your free account" },
                      { done: true, text: "Complete your gaming profile" },
                      { done: true, text: "Add Party Coins to wallet" },
                      { done: false, text: "Join your first party room" },
                      { done: false, text: "Invite friends with your code" },
                      { done: false, text: "Reach Level 10 for rewards" },
                    ].map((item, idx) => (
                      <div 
                        key={idx}
                        className="d-flex align-items-center gap-3 p-3"
                        style={{
                          background: item.done ? 'rgba(0, 245, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '1rem',
                          border: `1px solid ${item.done ? 'rgba(0, 245, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                        }}
                      >
                        <span style={{ 
                          fontSize: '1.25rem',
                          color: item.done ? 'var(--accent-secondary)' : 'var(--text-dim)'
                        }}>
                          {item.done ? '✅' : '⬜'}
                        </span>
                        <span style={{ 
                          color: item.done ? 'var(--text-primary)' : 'var(--text-muted)',
                          textDecoration: item.done ? 'line-through' : 'none',
                          opacity: item.done ? 0.8 : 1
                        }}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={6}>
              <div className="section-badge mb-3">
                <span>🏆</span>
                <span>Rewards</span>
              </div>
              <h2 className="section-title">Level Up, Earn More</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: '1.8', marginBottom: '2rem' }}>
                Every action earns XP. The more you play, the faster you level up. 
                Higher levels unlock exclusive features and bigger rewards.
              </p>
              <Row className="g-3">
                <Col xs={6}>
                  <div className="glass-card p-3 text-center">
                    <div style={{ fontSize: '2rem' }}>🥉</div>
                    <div className="fw-bold mt-2" style={{ color: 'var(--text-secondary)' }}>Level 1-10</div>
                    <small style={{ color: 'var(--text-muted)' }}>Starter Rewards</small>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="glass-card p-3 text-center">
                    <div style={{ fontSize: '2rem' }}>🥈</div>
                    <div className="fw-bold mt-2" style={{ color: 'var(--text-secondary)' }}>Level 11-25</div>
                    <small style={{ color: 'var(--text-muted)' }}>Pro Benefits</small>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="glass-card p-3 text-center">
                    <div style={{ fontSize: '2rem' }}>🥇</div>
                    <div className="fw-bold mt-2" style={{ color: 'var(--text-secondary)' }}>Level 26-50</div>
                    <small style={{ color: 'var(--text-muted)' }}>Elite Status</small>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="glass-card p-3 text-center">
                    <div style={{ fontSize: '2rem' }}>💎</div>
                    <div className="fw-bold mt-2" style={{ color: 'var(--text-secondary)' }}>Level 50+</div>
                    <small style={{ color: 'var(--text-muted)' }}>VIP Access</small>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <Container>
          <div className="cta-card">
            <div className="cta-content">
              <h2 className="cta-title">Ready to Start Your Journey?</h2>
              <p className="cta-text">
                Join thousands of players already having the time of their lives on RoadHunter!
              </p>
              <div className="cta-buttons">
                <Link href="/user/signup" className="cta-button-primary">
                  🎮 Create Free Account
                </Link>
                <Link href="/aboutus" className="cta-button-secondary">
                  📖 Learn More
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Footer Space */}
      <div style={{ height: '3rem' }}></div>
    </>
  );
}

