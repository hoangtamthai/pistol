import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay · Customer issue intelligence",
  description: "An evidence-driven customer issue workspace with persistent triage, reviewed decisions, and account-specific recovery. Includes clearly labeled simulations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
