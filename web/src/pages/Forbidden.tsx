import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="font-heading text-2xl">Access denied</h1>
      <p className="mt-3 text-sm text-text/70">
        This area is for Fleurraine administrators only.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white"
      >
        Back to home
      </Link>
    </main>
  );
}
