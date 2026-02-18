"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/session-store";
import { apiClient } from "@/lib/api-client";

export default function AuthCallback() {
  const router = useRouter();
  const { setAuth } = useSessionStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setError("No authentication token received. Please try again.");
      return;
    }

    apiClient
      .getMe(token)
      .then((user) => {
        setAuth(token, user.user_id, user.email, user.credit_balance);
        router.push("/");
      })
      .catch(() => {
        setError("Authentication failed. Please try again.");
      });
  }, [router, setAuth]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="max-w-md rounded-lg border border-gray-700 bg-gray-900 p-8 text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="mb-2 text-xl font-semibold text-gray-100">
            Authentication Error
          </h1>
          <p className="mb-4 text-gray-400">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-md bg-teal-600 px-4 py-2 text-white hover:bg-teal-700"
          >
            Back to BurnChat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
        <p className="text-gray-400">Signing you in...</p>
      </div>
    </div>
  );
}
