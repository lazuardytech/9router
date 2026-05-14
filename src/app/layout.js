import "./globals.css";
import ServiceWorkerRegistrar from "@/shared/components/ServiceWorkerRegistrar";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import "@/lib/initCloudSync";
import "@/lib/network/initOutboundProxy";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Google Fonts preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter Variable */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
        />
        {/* IBM Plex Mono */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&display=swap" />
        {/* Material Symbols Outlined */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className="h-full bg-pitch-black text-porcelain custom-scrollbar">
        <ThemeProvider>
          <ServiceWorkerRegistrar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
