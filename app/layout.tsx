import type { Metadata, Viewport } from "next";
import ServiceWorkerRegistration from "@/components/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leave On Time",
  description: "Know when to leave to arrive on time.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Leave On Time", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#142b24",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
      <ServiceWorkerRegistration />
    </html>
  );
}
