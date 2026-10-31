import type { Metadata, Viewport } from "next";
import AppShell from "@/components/app-shell";
import ServiceWorkerRegistration from "@/components/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeaveWise",
  description: "Know when to leave to arrive on time.",
  manifest: "/manifest.json",
  icons: {
    icon: { url: "/icon.svg", type: "image/svg+xml" },
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "LeaveWise", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
