"use client";

import { Shield } from "lucide-react";
import { useSessionStore } from "@/store/session-store";

const steps = [
  {
    number: 1,
    title: "You send a message or upload a document",
    description:
      "Type naturally or attach files. BurnChat works with PDFs, DOCX, images, URLs, and more.",
  },
  {
    number: 2,
    title: "We strip out all personal information",
    description:
      "Names, emails, phone numbers, SSNs, addresses \u2014 all detected and replaced with realistic fakes before anything leaves your device.",
  },
  {
    number: 3,
    title: "The AI never sees who you are or where your data came from",
    description:
      "BurnChat acts like a VPN for AI. The model receives a fully anonymized version \u2014 no real names, no source attribution, no way to trace it back to you.",
  },
  {
    number: 4,
    title: "We put the real names back in the response",
    description:
      "When the AI responds, BurnChat swaps the fake names back to the originals so you see a natural result.",
  },
];

export function WelcomeMessage() {
  const { creditBalance } = useSessionStore();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gray-700 bg-gray-800">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-100">
            Welcome to BurnChat &mdash; a VPN for AI.
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            We anonymize your data so AI never sees who you are or where your
            information came from. Your identity stays hidden, your sources stay
            private.
          </p>
        </div>

        {/* Steps */}
        <div className="mb-6 space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-600 text-sm font-medium text-gray-300">
                {step.number}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-200">{step.title}</p>
                <p className="mt-0.5 text-sm text-gray-400">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="space-y-2 border-t border-gray-800 pt-4 text-center">
          <p className="text-sm text-gray-300">
            You have{" "}
            <span className="font-semibold text-white">
              {creditBalance}
            </span>{" "}
            free credits to try it out.
          </p>
          <p className="text-xs text-gray-500">
            No sign-up required to try. No data stored. Ever.
          </p>
        </div>
      </div>
    </div>
  );
}
