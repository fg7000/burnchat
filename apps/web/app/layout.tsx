import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "BurnChat — The VPN for AI",
  description:
    "Chat with AI anonymously. All personal information stripped before it reaches any model. Nothing stored.",
  keywords: [
    "AI privacy",
    "PII protection",
    "anonymous AI chat",
    "document anonymization",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
