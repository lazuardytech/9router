import "./globals.css";
import ServiceWorkerRegistrar from "@/shared/components/ServiceWorkerRegistrar";
import "@/lib/initCloudSync";
import "@/lib/network/initOutboundProxy";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="h-full bg-pitch-black text-porcelain custom-scrollbar">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
