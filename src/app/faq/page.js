"use client";

import { Container, Row, Col, Card, Accordion, Badge } from "react-bootstrap";
import { useState } from "react";

const faqCategories = [
  {
    id: "payment",
    title: "Virtual Currency & Entertainment",
    icon: "💰",
    color: "#ffd700",
    questions: [
      {
        id: "payment-1",
        question: "What are Party Coins and how do I get them?",
        answer: "Party Coins are virtual currency used exclusively for entertainment purposes on our platform. They have no real-world monetary value and cannot be exchanged for real money. You can purchase Party Coins to enhance your entertainment experience, but please note: this platform is NOT a gambling, betting, or money-earning platform. All games and activities are for fun and entertainment only.",
      },
      {
        id: "payment-2",
        question: "Can I win real money or withdraw Party Coins as cash?",
        answer: "NO. Party Coins are virtual currency for entertainment purposes only. They cannot be converted to real money, withdrawn as cash, or used for any real-world financial transactions. This platform does NOT offer gambling, betting, or any form of real money gaming. All activities are purely for entertainment and fun.",
      },
      {
        id: "payment-3",
        question: "Is this a gambling or betting platform?",
        answer: "ABSOLUTELY NOT. RoadHunter is an entertainment and social gaming platform only. We do NOT promote, facilitate, or allow gambling, betting, or any luck-based or knowledge-based money-earning activities. All games are optional, for fun and challenge purposes only. Party Coins are virtual tokens with no real-world value.",
      },
      {
        id: "payment-4",
        question: "How long does it take for Party Coins to appear in my wallet?",
        answer: "Party Coins are added to your virtual wallet instantly after a successful purchase. If you don't see the coins within a few minutes, please refresh your wallet page or contact support. Remember: Party Coins are virtual currency for entertainment only and have no real monetary value.",
      },
      {
        id: "payment-5",
        question: "What payment methods are accepted for purchasing Party Coins?",
        answer: "We accept all major credit cards (Visa, Mastercard, American Express), debit cards, and digital wallets like PayPal. All transactions are encrypted and secure. Please note: Purchases are for virtual entertainment currency only. Party Coins cannot be converted to real money or used for gambling purposes.",
      },
    ],
  },
  {
    id: "platform",
    title: "Platform Related",
    icon: "🎮",
    color: "#000000",
    questions: [
      {
        id: "platform-1",
        question: "How do I create a party room?",
        answer: "To create a party room, go to the Party section and click the 'Create' button. Fill in the party name, description, and choose whether it's public or private. Once created, you can invite friends or let others join!",
      },
      {
        id: "platform-2",
        question: "How does the referral system work?",
        answer: "When you sign up, you receive a unique 10-digit referral code. Share this code with friends, and when they sign up and become active, you'll earn a 5% XP boost on all their activities. There's no limit to how many friends you can refer!",
      },
      {
        id: "platform-3",
        question: "How do I level up and earn XP?",
        answer: "You earn XP (Experience Points) by participating in party rooms, playing fun games, sending virtual gifts, and completing daily activities. The more active you are, the faster you level up. Higher levels unlock exclusive badges and virtual rewards for entertainment purposes only. This is NOT a money-earning system - all rewards are virtual and for fun only.",
      },
      {
        id: "platform-4",
        question: "Can I change my username after creating my account?",
        answer: "Yes, you can change your username from your profile settings. However, you can only change it once every 30 days to prevent abuse. Your referral code will remain the same even if you change your username.",
      },
      {
        id: "platform-5",
        question: "What happens if I forget my password?",
        answer: "If you forget your password, click 'Forgot Password' on the login page. Enter your email address, and we'll send you a password reset link. Make sure to check your spam folder if you don't see the email.",
      },
    ],
  },
  {
    id: "mobile",
    title: "Mobile Related",
    icon: "📱",
    color: "#ff7a18",
    questions: [
      {
        id: "mobile-1",
        question: "Is there a mobile app for RoadHunter?",
        answer: "Yes! RoadHunter has a native Android app available on Google Play Store. The app offers better performance, push notifications, and exclusive mobile features. An iOS app is coming soon!",
      },
      {
        id: "mobile-2",
        question: "Can I use RoadHunter on my mobile browser?",
        answer: "Absolutely! RoadHunter is fully responsive and works great on mobile browsers. You can access all features including party rooms, wallet, and games directly from your mobile browser.",
      },
      {
        id: "mobile-3",
        question: "How do I download the Android app?",
        answer: "You can download the RoadHunter Android app from the Google Play Store. Simply search for 'RoadHunter' or scan the QR code on our homepage. The app is free to download and install.",
      },
      {
        id: "mobile-4",
        question: "Will my progress sync between mobile app and web?",
        answer: "Yes! Your account, wallet balance, XP, and all progress are synced in real-time across all devices. You can seamlessly switch between the mobile app and web browser without losing any data.",
      },
      {
        id: "mobile-5",
        question: "What are the minimum requirements for the mobile app?",
        answer: "The RoadHunter Android app requires Android 8.0 (Oreo) or higher, at least 100MB of free storage space, and an active internet connection. The app is optimized to work on most modern Android devices.",
      },
    ],
  },
];

export default function FAQPage() {
  const [openCategory, setOpenCategory] = useState(null);

  return (
    <>
      <style jsx global>{`
        .faq-hero {
          position: relative;
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 5rem 0;
          text-align: center;
        }

        .faq-hero::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 30%, rgba(202, 0, 0, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(0, 0, 0, 0.15) 0%, transparent 50%);
          z-index: 0;
        }

        .hero-content {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(0, 0, 0, 0.4);
          padding: 0.6rem 1.25rem;
          border-radius: 3rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: #000000;
          margin-bottom: 1.5rem;
          backdrop-filter: blur(10px);
        }

        .hero-title {
          font-size: 4rem !important;
          font-weight: 800 !important;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          background: linear-gradient(135deg, #000000 0%, #1a1a1a 40%, #000000 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 1.35rem;
          color: rgba(255, 255, 255, 0.9);
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.7;
          text-shadow: 0 2px 10px rgba(255, 255, 255, 0.1);
        }

        .faq-section {
          padding: 5rem 0;
        }

        .category-card {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 1.5rem;
          padding: 2rem;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          margin-bottom: 2rem;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 rgba(255, 255, 255, 0.05);
        }

        .category-card:hover {
          transform: translateY(-5px);
          box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.25),
            inset 0 -1px 0 rgba(255, 255, 255, 0.1);
        }

        .category-card::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 1.5rem;
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.3) 0%, 
            rgba(255, 255, 255, 0.1) 25%,
            rgba(255, 255, 255, 0.05) 50%,
            rgba(255, 255, 255, 0.1) 75%,
            rgba(255, 255, 255, 0.3) 100%);
          z-index: -1;
          opacity: 0.7;
          animation: shimmer 3s ease-in-out infinite;
        }

        .category-card::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 1.5rem;
          background: transparent;
          z-index: -1;
          transition: all 0.4s ease;
        }

        /* Payment Category - Gold Theme */
        .category-card[data-category="payment"] {
          background: linear-gradient(135deg, 
            rgba(255, 215, 0, 0.15) 0%, 
            rgba(255, 215, 0, 0.08) 50%,
            rgba(255, 215, 0, 0.15) 100%);
          border: 1px solid rgba(255, 215, 0, 0.3);
          box-shadow: 
            0 8px 32px rgba(255, 215, 0, 0.2),
            inset 0 1px 0 rgba(255, 215, 0, 0.2),
            inset 0 -1px 0 rgba(255, 215, 0, 0.1);
        }

        .category-card[data-category="payment"]:hover {
          background: linear-gradient(135deg, 
            rgba(255, 215, 0, 0.2) 0%, 
            rgba(255, 215, 0, 0.12) 50%,
            rgba(255, 215, 0, 0.2) 100%);
          border-color: rgba(255, 215, 0, 0.4);
          box-shadow: 
            0 12px 40px rgba(255, 215, 0, 0.3),
            inset 0 1px 0 rgba(255, 215, 0, 0.3),
            inset 0 -1px 0 rgba(255, 215, 0, 0.15);
        }

        .category-card[data-category="payment"]::before {
          background: linear-gradient(135deg, 
            rgba(255, 215, 0, 0.4) 0%, 
            rgba(255, 215, 0, 0.15) 25%,
            rgba(255, 215, 0, 0.05) 50%,
            rgba(255, 215, 0, 0.15) 75%,
            rgba(255, 215, 0, 0.4) 100%);
        }

        /* Platform Category - Black Theme */
        .category-card[data-category="platform"] {
          background: linear-gradient(135deg, 
            rgba(0, 0, 0, 0.2) 0%, 
            rgba(0, 0, 0, 0.1) 50%,
            rgba(0, 0, 0, 0.2) 100%);
          border: 1px solid rgba(0, 0, 0, 0.4);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(0, 0, 0, 0.3),
            inset 0 -1px 0 rgba(0, 0, 0, 0.15);
        }

        .category-card[data-category="platform"]:hover {
          background: linear-gradient(135deg, 
            rgba(0, 0, 0, 0.25) 0%, 
            rgba(0, 0, 0, 0.15) 50%,
            rgba(0, 0, 0, 0.25) 100%);
          border-color: rgba(0, 0, 0, 0.5);
          box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(0, 0, 0, 0.4),
            inset 0 -1px 0 rgba(0, 0, 0, 0.2);
        }

        .category-card[data-category="platform"]::before {
          background: linear-gradient(135deg, 
            rgba(0, 0, 0, 0.5) 0%, 
            rgba(0, 0, 0, 0.2) 25%,
            rgba(0, 0, 0, 0.1) 50%,
            rgba(0, 0, 0, 0.2) 75%,
            rgba(0, 0, 0, 0.5) 100%);
        }

        /* Mobile Category - Orange Theme */
        .category-card[data-category="mobile"] {
          background: linear-gradient(135deg, 
            rgba(255, 122, 24, 0.15) 0%, 
            rgba(255, 122, 24, 0.08) 50%,
            rgba(255, 122, 24, 0.15) 100%);
          border: 1px solid rgba(255, 122, 24, 0.3);
          box-shadow: 
            0 8px 32px rgba(255, 122, 24, 0.2),
            inset 0 1px 0 rgba(255, 122, 24, 0.2),
            inset 0 -1px 0 rgba(255, 122, 24, 0.1);
        }

        .category-card[data-category="mobile"]:hover {
          background: linear-gradient(135deg, 
            rgba(255, 122, 24, 0.2) 0%, 
            rgba(255, 122, 24, 0.12) 50%,
            rgba(255, 122, 24, 0.2) 100%);
          border-color: rgba(255, 122, 24, 0.4);
          box-shadow: 
            0 12px 40px rgba(255, 122, 24, 0.3),
            inset 0 1px 0 rgba(255, 122, 24, 0.3),
            inset 0 -1px 0 rgba(255, 122, 24, 0.15);
        }

        .category-card[data-category="mobile"]::before {
          background: linear-gradient(135deg, 
            rgba(255, 122, 24, 0.4) 0%, 
            rgba(255, 122, 24, 0.15) 25%,
            rgba(255, 122, 24, 0.05) 50%,
            rgba(255, 122, 24, 0.15) 75%,
            rgba(255, 122, 24, 0.4) 100%);
        }

        @keyframes shimmer {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.8;
          }
        }

        .category-header {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          margin-bottom: 1.5rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          position: relative;
        }

        .category-header::after {
          content: "";
          position: absolute;
          bottom: -1px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.5) 50%,
            transparent 100%);
          transition: width 0.5s ease;
        }

        .category-card:hover .category-header::after {
          width: 100%;
        }

        .category-icon {
          font-size: 2.5rem;
          width: 70px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 1.25rem;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 
            0 4px 15px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .category-icon::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.3) 0%, 
            transparent 50%,
            rgba(255, 255, 255, 0.1) 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .category-card:hover .category-icon {
          transform: scale(1.1) rotate(5deg);
          box-shadow: 
            0 6px 20px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }

        .category-card:hover .category-icon::before {
          opacity: 1;
        }

        .category-title {
          font-size: 1.75rem !important;
          font-weight: 700 !important;
          color: rgba(255, 255, 255, 0.95) !important;
          margin: 0;
          text-shadow: 0 2px 15px rgba(255, 255, 255, 0.2);
        }

        .accordion-custom {
          --bs-accordion-bg: transparent;
          --bs-accordion-border-color: rgba(255, 255, 255, 0.1);
          --bs-accordion-border-radius: 0.75rem;
          --bs-accordion-inner-border-radius: 0.75rem;
          --bs-accordion-button-bg: transparent;
          --bs-accordion-button-active-bg: rgba(0, 0, 0, 0.4);
          --bs-accordion-button-active-color: rgba(255, 255, 255, 0.95);
          --bs-accordion-button-focus-border-color: rgba(255, 255, 255, 0.1);
          --bs-accordion-button-focus-box-shadow: none;
        }

        /* Override Bootstrap's default accordion button styles */
        .accordion-custom .accordion-button,
        .accordion-item-custom .accordion-button {
          background-color: transparent !important;
          background: transparent !important;
        }

        .accordion-custom .accordion-button:not(.collapsed),
        .accordion-item-custom .accordion-button:not(.collapsed) {
          background-color: rgba(0, 0, 0, 0.4) !important;
          background: rgba(0, 0, 0, 0.4) !important;
          color: rgba(255, 255, 255, 0.95) !important;
          box-shadow: 
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(255, 255, 255, 0.05) !important;
        }

        .accordion-custom .accordion-button:hover,
        .accordion-item-custom .accordion-button:hover {
          background-color: rgba(0, 0, 0, 0.3) !important;
          background: rgba(0, 0, 0, 0.3) !important;
        }

        .accordion-custom .accordion-button:not(.collapsed):hover,
        .accordion-item-custom .accordion-button:not(.collapsed):hover {
          background-color: rgba(0, 0, 0, 0.5) !important;
          background: rgba(0, 0, 0, 0.5) !important;
        }

        .accordion-custom .accordion-button:focus,
        .accordion-item-custom .accordion-button:focus {
          background-color: rgba(0, 0, 0, 0.4) !important;
          background: rgba(0, 0, 0, 0.4) !important;
          box-shadow: 0 0 0 0.25rem rgba(202, 0, 0, 0.25) !important;
        }

        .accordion-item-custom {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 1rem;
          margin-bottom: 1rem;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            0 4px 20px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          position: relative;
        }

        .accordion-item-custom::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.05) 0%, 
            transparent 50%,
            rgba(255, 255, 255, 0.02) 100%);
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
          z-index: 0;
        }

        .accordion-item-custom:hover::before {
          opacity: 1;
        }

        .accordion-item-custom:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 
            0 8px 30px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .accordion-item-custom:has(.accordion-button-custom:not(.collapsed)) {
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-color: rgba(255, 255, 255, 0.25);
          box-shadow: 
            0 8px 35px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            0 0 0 1px rgba(255, 255, 255, 0.1);
        }

        .accordion-button-custom,
        .accordion-custom .accordion-button {
          background: transparent !important;
          color: rgba(255, 255, 255, 0.95) !important;
          border: none;
          padding: 1.5rem 1.75rem;
          font-weight: 600;
          font-size: 1.05rem;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          text-shadow: 0 2px 10px rgba(255, 255, 255, 0.15);
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          letter-spacing: 0.3px;
        }

        .accordion-button-custom:not(.collapsed),
        .accordion-button-custom.active,
        .accordion-custom .accordion-button:not(.collapsed),
        .accordion-custom .accordion-button.active {
          background: rgba(0, 0, 0, 0.4) !important;
          background-color: rgba(0, 0, 0, 0.4) !important;
          color: rgba(255, 255, 255, 0.95) !important;
          box-shadow: 
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(255, 255, 255, 0.05) !important;
          text-shadow: 0 2px 10px rgba(255, 255, 255, 0.15);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .accordion-header .accordion-button-custom:not(.collapsed),
        .accordion-header .accordion-button-custom.active,
        .accordion-header .accordion-button:not(.collapsed),
        .accordion-header .accordion-button.active {
          background: rgba(0, 0, 0, 0.4) !important;
          background-color: rgba(0, 0, 0, 0.4) !important;
        }

        .accordion-button-custom:hover,
        .accordion-custom .accordion-button:hover {
          background: rgba(0, 0, 0, 0.3) !important;
          background-color: rgba(0, 0, 0, 0.3) !important;
          color: rgba(255, 255, 255, 0.95) !important;
          text-shadow: 0 2px 10px rgba(255, 255, 255, 0.2);
          transform: translateX(3px);
        }

        .accordion-button-custom:not(.collapsed):hover,
        .accordion-custom .accordion-button:not(.collapsed):hover {
          background: rgba(0, 0, 0, 0.5) !important;
          background-color: rgba(0, 0, 0, 0.5) !important;
          color: rgba(255, 255, 255, 0.95) !important;
        }

        .accordion-button-custom:focus,
        .accordion-custom .accordion-button:focus {
          background: rgba(0, 0, 0, 0.4) !important;
          background-color: rgba(0, 0, 0, 0.4) !important;
          box-shadow: 0 0 0 0.25rem rgba(202, 0, 0, 0.25) !important;
          border-color: var(--accent);
        }

        .accordion-button-custom::after {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23ffffff'%3e%3cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e");
          filter: drop-shadow(0 2px 4px rgba(255, 255, 255, 0.2));
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          width: 1.25rem;
          height: 1.25rem;
        }

        .accordion-button-custom:not(.collapsed)::after {
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23ffffff'%3e%3cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e");
          transform: rotate(180deg);
          filter: drop-shadow(0 2px 4px rgba(255, 255, 255, 0.3));
        }

        .accordion-button-custom * {
          color: rgba(255, 255, 255, 0.95) !important;
        }

        .accordion-button-custom:not(.collapsed) * {
          color: rgba(255, 255, 255, 0.98) !important;
        }

        .accordion-button-custom span {
          color: rgba(255, 255, 255, 0.95) !important;
        }

        .accordion-button-custom:not(.collapsed) span {
          color: rgba(255, 255, 255, 0.98) !important;
        }

        .accordion-body-custom {
          background: linear-gradient(180deg, 
            rgba(255, 255, 255, 0.08) 0%, 
            rgba(255, 255, 255, 0.03) 100%);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          color: rgba(255, 255, 255, 0.9) !important;
          padding: 2rem 1.75rem;
          line-height: 1.9;
          font-size: 1rem;
          text-shadow: 0 1px 5px rgba(255, 255, 255, 0.1);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          position: relative;
          animation: fadeIn 0.4s ease-out;
        }

        .accordion-body-custom::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.2) 50%,
            transparent 100%);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .question-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.25) 0%, 
            rgba(255, 255, 255, 0.15) 100%);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: 50%;
          font-size: 0.85rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.98);
          margin-right: 1rem;
          text-shadow: 0 2px 8px rgba(255, 255, 255, 0.3);
          border: 1.5px solid rgba(255, 255, 255, 0.3);
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
        }

        .accordion-button-custom:hover .question-number {
          transform: scale(1.1) rotate(5deg);
          box-shadow: 
            0 6px 16px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
        }

        .accordion-button-custom:not(.collapsed) .question-number {
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.35) 0%, 
            rgba(255, 255, 255, 0.25) 100%);
          color: rgba(255, 255, 255, 1) !important;
          border: 1.5px solid rgba(255, 255, 255, 0.4);
          text-shadow: 0 2px 10px rgba(255, 255, 255, 0.4);
          box-shadow: 
            0 6px 16px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            0 0 0 2px rgba(255, 255, 255, 0.1);
          transform: scale(1.05);
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
          color: rgba(255, 255, 255, 0.98) !important;
          text-shadow: 0 2px 20px rgba(255, 255, 255, 0.3), 0 0 30px rgba(255, 255, 255, 0.1);
        }

        .help-section {
          padding: 4rem 0;
          background: linear-gradient(135deg, rgba(202, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.08) 100%);
        }

        .help-card {
          background: rgba(20, 27, 45, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 1.5rem;
          padding: 2.5rem;
          text-align: center;
          backdrop-filter: blur(20px);
        }

        .help-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .help-title {
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          color: rgba(255, 255, 255, 0.95) !important;
          margin-bottom: 1rem;
          text-shadow: 0 2px 15px rgba(255, 255, 255, 0.2);
        }

        .help-text {
          color: rgba(255, 255, 255, 0.85) !important;
          margin-bottom: 1.5rem;
          line-height: 1.7;
          text-shadow: 0 1px 5px rgba(255, 255, 255, 0.1);
        }

        .help-button {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-tertiary) 100%);
          border: none;
          padding: 0.875rem 2rem;
          font-size: 1rem;
          font-weight: 700;
          border-radius: 3rem;
          color: white;
          text-transform: uppercase;
          letter-spacing: 1px;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          box-shadow: 0 8px 30px rgba(202, 0, 0, 0.4);
        }

        .help-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(202, 0, 0, 0.5);
          color: white;
        }

        @media (max-width: 991px) {
          .hero-title {
            font-size: 3rem !important;
          }

          .section-title {
            font-size: 2rem !important;
          }

          .category-card {
            padding: 1.5rem;
          }
        }

        @media (max-width: 576px) {
          .faq-hero {
            min-height: 50vh;
            padding: 3rem 0;
          }

          .hero-title {
            font-size: 2.25rem !important;
          }

          .hero-subtitle {
            font-size: 1.1rem;
          }

          .category-header {
            flex-direction: column;
            text-align: center;
          }

          .category-icon {
            margin: 0 auto;
          }

          .accordion-button-custom {
            padding: 1rem;
            font-size: 0.9rem;
          }

          .accordion-body-custom {
            padding: 1rem;
            font-size: 0.9rem;
          }

          .help-card {
            padding: 2rem 1.5rem;
          }
        }
      `}</style>

      {/* Hero Section */}
      <section className="faq-hero">
        <Container>
          <div className="hero-content">
            <div className="hero-badge">
              <span>❓</span>
              <span className="text-white">Frequently Asked Questions</span>
            </div>
            <h1 className=" text-white">
              Got Questions?<br />We've Got Answers
            </h1>
            <p className="hero-subtitle">
              Find answers to the most common questions about RoadHunter. 
              Can't find what you're looking for? Contact our support team!
            </p>
          </div>
        </Container>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <Container>
          <div className="text-center mb-5">
            <div className="section-badge">
              <span>📚</span>
              <span>Browse by Category</span>
            </div>
            <h2 className="section-title">Find Your Answer</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.85)', maxWidth: '600px', margin: '0 auto', fontSize: '1.1rem', textShadow: '0 1px 5px rgba(255, 255, 255, 0.1)' }}>
              Select a category below to find answers to your questions
            </p>
          </div>

          {faqCategories.map((category) => (
            <Card key={category.id} className="category-card border-0" data-category={category.id}>
              <div className="category-header">
                <div className="category-icon" style={{ background: `${category.color}25`, border: `1px solid ${category.color}50` }}>
                  {category.icon}
                </div>
                <h3 className="category-title">{category.title}</h3>
              </div>

              <Accordion className="accordion-custom" defaultActiveKey="0">
                {category.questions.map((faq, index) => (
                  <Accordion.Item
                    key={faq.id}
                    eventKey={index.toString()}
                    className="accordion-item-custom"
                  >
                    <Accordion.Header className="accordion-button-custom">
                      <span className="question-number">{index + 1}</span>
                      {faq.question}
                    </Accordion.Header>
                    <Accordion.Body className="accordion-body-custom">
                      {faq.answer}
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Card>
          ))}
        </Container>
      </section>

      {/* Help Section */}
      <section className="help-section">
        <Container>
          <Row className="justify-content-center">
            <Col lg={8}>
              <Card className="help-card border-0">
                <Card.Body>
                  <div className="help-icon">💬</div>
                  <h3 className="help-title">Still Have Questions?</h3>
                  <p className="help-text">
                    Can't find the answer you're looking for? Our support team is here to help! 
                    Reach out to us and we'll get back to you as soon as possible.
                  </p>
                  <a href="/contactus" className="help-button">
                    Contact Support
                  </a>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Footer Space */}
      <div style={{ height: '3rem' }}></div>
    </>
  );
}

