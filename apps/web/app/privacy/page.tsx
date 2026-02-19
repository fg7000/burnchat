import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — BurnChat",
  description: "BurnChat privacy policy. How we protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <a href="/" className="text-gray-300 hover:text-white">
            &larr; Back to BurnChat
          </a>
        </div>

        <h1 className="mb-8 text-3xl font-bold text-gray-100">
          Privacy Policy
        </h1>

        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-100">
              1. Document Processing
            </h2>
            <p>
              We process your documents in server memory to detect and replace
              personal information. The original document text is never stored,
              logged, or written to disk. Processing happens entirely in memory
              and is discarded immediately after the anonymized version is
              returned.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-100">
              2. What Gets Sent to AI Providers
            </h2>
            <p>
              Only the anonymized version of your document is sent to AI
              providers via OpenRouter. All personally identifiable information
              (names, addresses, phone numbers, SSNs, etc.) is replaced with
              fictional equivalents before any AI provider sees your content.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-100">
              3. Browser-Only Data
            </h2>
            <p>
              Your original text and the mapping between real and fake names
              exist only in your browser&apos;s memory (not localStorage or cookies).
              When you close the browser tab, all single-session data is
              permanently destroyed.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-100">
              4. Multi-Document Sessions
            </h2>
            <p>
              For multi-document sessions: only anonymized text chunks and their
              mathematical embeddings are stored in our database. The mapping
              between fake and real names is encrypted on your device before
              storage — we cannot read it. You can delete any saved session at
              any time, which permanently removes all associated data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-100">
              5. What We Store
            </h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Your Google account email (for account identification)</li>
              <li>Credit balance (you paid for these)</li>
              <li>Payment history (required by Stripe)</li>
              <li>Optionally: encrypted session data (you control this)</li>
            </ul>
            <p className="mt-2">That&apos;s it. Nothing else.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-100">
              6. AI Provider Policies
            </h2>
            <p>
              AI providers may retain anonymized conversations per their own
              policies. Since all PII has been stripped, this data contains no
              personally identifiable information. We recommend reviewing
              OpenRouter&apos;s and the specific model provider&apos;s privacy policies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-100">
              7. Data Deletion
            </h2>
            <p>
              Single sessions: close your browser tab. All data is gone.
              Multi-document sessions: click delete on any saved session to
              permanently remove all associated data from our servers. Account
              deletion: contact us and we&apos;ll remove everything.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-100">
              8. Security
            </h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>All connections are encrypted via HTTPS</li>
              <li>Server never stores raw document text</li>
              <li>No logging of document content or mapping tables</li>
              <li>JWT authentication expires after 24 hours</li>
              <li>Stripe webhook signatures are verified</li>
              <li>Rate limiting on all endpoints</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-gray-100">
              9. Contact
            </h2>
            <p>
              For privacy questions or data deletion requests, contact us at
              privacy@burnchat.ai.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-gray-800 pt-6 text-sm text-gray-500">
          Last updated: February 2026
        </div>
      </div>
    </div>
  );
}
