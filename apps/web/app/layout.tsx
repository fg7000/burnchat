import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "BurnChat — The VPN for AI",
  description: "A privacy proxy for AI. Upload sensitive documents, strip all PII, chat with any LLM. When you leave, everything burns.",
  keywords: ["AI privacy", "PII protection", "anonymous AI chat", "document anonymization"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Intercept fetch/XHR to rewrite any stale localhost:8000 URLs to relative paths.
            This fixes cached JS that may still reference the old direct backend URL. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var oldFetch = window.fetch;
            window.fetch = function(input, init) {
              if (typeof input === 'string' && input.indexOf('http://localhost:8000') === 0) {
                input = input.replace('http://localhost:8000', '/b');
              } else if (input instanceof Request && input.url.indexOf('http://localhost:8000') === 0) {
                input = new Request(input.url.replace('http://localhost:8000', '/b'), input);
              }
              return oldFetch.call(this, input, init);
            };
            var oldOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              if (typeof url === 'string' && url.indexOf('http://localhost:8000') === 0) {
                arguments[1] = url.replace('http://localhost:8000', '/b');
              }
              return oldOpen.apply(this, arguments);
            };
          })();
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}
      >
        <TooltipProvider delayDuration={200}>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
