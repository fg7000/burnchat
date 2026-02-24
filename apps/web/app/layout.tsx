import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "BurnChat — The VPN for AI",
  description: "Chat with AI anonymously. All personal information stripped before it reaches any model. Nothing stored.",
  keywords: ["AI privacy", "PII protection", "anonymous AI chat", "document anonymization"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen" style={{ background: "#0a0a0b", color: "#e8e8e8", margin: 0, padding: 0 }}>
        <TooltipProvider delayDuration={200}>
          {children}
        </TooltipProvider>
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  );
}
