import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const publicLinks = [
  { to: "/", label: "Home" },
  { to: "/flowers", label: "Flowers" },
  { to: "/garden", label: "Garden" },
  { to: "/bouquets", label: "Bouquets" },
  { to: "/season", label: "Season" },
  { to: "/orders", label: "Orders" },
  { to: "/subscribe", label: "Subscribe" },
];

const adminLinks = [
  { to: "/admin/queue", label: "Queue" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/analytics", label: "Analytics" },
];

export default function Layout() {
  const { user, isAdmin, loading, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-text/10 bg-bg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link
            to="/"
            className="font-heading text-xl tracking-wide text-accent"
          >
            Fleurraine
          </Link>

          <nav className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
            {publicLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="rounded-md px-3 py-2 hover:bg-text/5 min-h-[44px] inline-flex items-center"
              >
                {label}
              </Link>
            ))}
            {isAdmin &&
              adminLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="rounded-md px-3 py-2 font-medium text-accent hover:bg-accent/10 min-h-[44px] inline-flex items-center"
                >
                  {label}
                </Link>
              ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            {loading ? (
              <span className="text-text/50">…</span>
            ) : user ? (
              <>
                <span className="hidden sm:inline text-text/70">
                  {user.displayName}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-md border border-text/20 px-3 py-2 min-h-[44px] hover:bg-text/5"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/sign-in"
                className="rounded-md bg-accent px-4 py-2 font-medium text-white min-h-[44px] inline-flex items-center hover:bg-accent/90"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <footer className="border-t border-text/10 px-4 py-6 text-center text-sm text-text/70">
        <p>Payment is made via Venmo after you receive your bouquet.</p>
        <p className="mt-1">
          Venmo:{" "}
          <span className="font-medium text-text">@Lorraine-Fleurraine</span>
        </p>
      </footer>
    </div>
  );
}
