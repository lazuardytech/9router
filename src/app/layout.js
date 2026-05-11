import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import ServiceWorkerRegistrar from "@/shared/components/ServiceWorkerRegistrar";
import "@/lib/initCloudSync"; // Auto-initialize cloud sync
import "@/lib/network/initOutboundProxy"; // Auto-initialize outbound proxy env
import { initConsoleLogCapture } from "@/lib/consoleLogBuffer";
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="h-full bg-surface text-text-main custom-scrollbar">
        <ThemeProvider>
          <ServiceWorkerRegistrar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
