/**
 * 4.3 "Sign in with Google" button
 * 4.4 "Sign in with Facebook" button
 *
 * Both buttons redirect the browser to the respective OAuth consent screen.
 * The redirect_uri always points to /auth/callback with a provider query param
 * so the AuthCallback page knows which backend endpoint to call.
 */

import { storeAuthReturnTo } from "../lib/authReturnTo";

interface SignInButtonsProps {
  returnTo?: string;
}

function buildGoogleAuthUrl(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const redirectUri = `${window.location.origin}/auth/callback?provider=google`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildFacebookAuthUrl(): string {
  const appId = import.meta.env.VITE_FACEBOOK_APP_ID as string;
  const redirectUri = `${window.location.origin}/auth/callback?provider=facebook`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "email,public_profile",
  });
  return `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
}

export function SignInButtons({ returnTo = "/" }: SignInButtonsProps) {
  function beginSignIn(url: string) {
    storeAuthReturnTo(returnTo);
    window.location.href = url;
  }

  function handleGoogle() {
    beginSignIn(buildGoogleAuthUrl());
  }

  function handleFacebook() {
    beginSignIn(buildFacebookAuthUrl());
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <button
        onClick={handleGoogle}
        className="flex items-center justify-center gap-3 rounded-lg border border-[--color-text] bg-white px-4 py-3 text-sm font-medium text-[--color-text] shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[44px]"
        aria-label="Sign in with Google"
      >
        {/* Google "G" icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
            fill="#4285F4"
          />
          <path
            d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            fill="#34A853"
          />
          <path
            d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
            fill="#FBBC05"
          />
          <path
            d="M9 3.583c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.583 9 3.583z"
            fill="#EA4335"
          />
        </svg>
        Sign in with Google
      </button>

      <button
        onClick={handleFacebook}
        className="flex items-center justify-center gap-3 rounded-lg bg-[#1877F2] px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-[#166FE5] active:bg-[#1464D8] transition-colors min-h-[44px]"
        aria-label="Sign in with Facebook"
      >
        {/* Facebook "f" icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          fill="white"
        >
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.253h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
        Sign in with Facebook
      </button>
    </div>
  );
}
