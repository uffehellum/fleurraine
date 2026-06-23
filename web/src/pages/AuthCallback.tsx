import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import { consumeAuthReturnTo } from "../lib/authReturnTo";

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const provider = params.get("provider");
    const oauthError = params.get("error");

    if (oauthError) {
      setError("Sign-in was cancelled or denied. Please try again.");
      return;
    }

    if (!code || (provider !== "google" && provider !== "facebook")) {
      setError("Invalid sign-in response. Please try again.");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback?provider=${provider}`;
    const endpoint =
      provider === "google" ? "/api/auth/google" : "/api/auth/facebook";

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, redirectUri }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? "Sign-in failed"
          );
        }
        await refreshSession();
        navigate(consumeAuthReturnTo(), { replace: true });
      })
      .catch((err: Error) => {
        setError(err.message || "Sign-in failed. Please try again.");
      });
  }, [params, navigate, refreshSession]);

  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-heading text-2xl">Sign-in failed</h1>
        <p className="mt-3 text-sm text-text/70">{error}</p>
        <Link
          to="/sign-in"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white"
        >
          Try again
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-text/60">Completing sign-in…</p>
    </main>
  );
}
