import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swingscore",
  description: "Live scoring for West Coast Swing contests.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon-180.png" },
  appleWebApp: { capable: true, title: "Swingscore", statusBarStyle: "default" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#26302c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
