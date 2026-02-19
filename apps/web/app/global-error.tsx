"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <pre className="max-w-lg overflow-auto rounded bg-gray-900 p-4 text-sm text-red-400">
            {error.message}
          </pre>
          <button
            onClick={reset}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
