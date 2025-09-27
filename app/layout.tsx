import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import SpeedInsightsProd from "@/components/SpeedInsightsProd";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeadlineNoon",
  description: "Survivor dashboards",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsightsProd />
      </body>
    </html>
  );
}
