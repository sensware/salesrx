import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SalesRx — Walk in prepared",
  description:
    "AI sales intelligence: rep-personalized prospect briefs with NEPQ question ladders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
