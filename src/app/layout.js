import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

import { Space_Grotesk } from "next/font/google";

import AppShell from "./common/components/AppShell";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata = {
  title: "PartyVerse | Social Gaming Platform",
  description:
    "Real-time social gaming platform with secure wallets, referrals, and XP levels.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} bg-dark`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
