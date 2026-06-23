import { Link, useSearchParams } from "react-router-dom";
import { SignInButtons } from "../components/SignInButtons";

export default function SignIn() {
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/";

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-heading text-2xl text-center">Sign in</h1>
      <p className="mt-3 text-center text-sm text-text/70">
        Sign in to place orders, subscribe to weekly bouquets, and manage your
        requests.
      </p>
      <div className="mt-8 flex justify-center">
        <SignInButtons returnTo={returnTo} />
      </div>
      <p className="mt-8 text-center text-sm">
        <Link to="/" className="text-accent underline-offset-2 hover:underline">
          Continue browsing without signing in
        </Link>
      </p>
    </main>
  );
}
