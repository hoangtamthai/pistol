import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay · Customer signals, clear decisions",
  description: "An evidence-backed decision workspace for customer and engineering teams. Hackathon demo with synthetic customer data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
