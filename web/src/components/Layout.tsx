import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState, useEffect } from "react";
import PullToRefresh from "./PullToRefresh";
import { isDevEnvironment } from "../lib/env";

const basePublicLinks = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/stand/history", label: "History", icon: "📅" },
  { to: "/flowers", label: "Flowers", icon: "🌸" },
  { to: "/garden", label: "Garden", icon: "🌿" },
];

const adminLinks = [
  { to: "/admin/queue", label: "Queue", icon: "📋" },
  { to: "/admin/orders", label: "Orders", icon: "📊" },
  { to: "/admin/analytics", label: "Analytics", icon: "📈" },
  { to: "/admin/photos", label: "Photos", icon: "📸" },
];

export default function Layout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasAvailableBouquets, setHasAvailableBouquets] = useState(false);

  useEffect(() => {
    fetchBouquetAvailability();
    
    // Set development background if running in dev
    if (isDevEnvironment()) {
      document.documentElement.style.setProperty('--color-bg', '#FFF0F5'); // Light pink/lavenderblush
    }
  }, []);

  const fetchBouquetAvailability = async () => {
    try {
      const response = await fetch("/api/bouquets/available");
      if (response.ok) {
        const data = await response.json();
        setHasAvailableBouquets(data && data.length > 0);
      }
    } catch (err) {
      console.error("Failed to check bouquet availability:", err);
    }
  };

  const publicLinks = hasAvailableBouquets
    ? [...basePublicLinks, { to: "/bouquets", label: "Bouquets", icon: "💐" }]
    : basePublicLinks;

  return (
    <PullToRefresh>
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-text/10 bg-bg">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="font-heading text-xl tracking-wide text-accent flex items-center gap-2"
            >
              Fleurraine
              {isDevEnvironment() && (
                <span className="bg-pink-100 text-pink-700 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border border-pink-200 font-sans uppercase">
                  DEV
                </span>
              )}
            </Link>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden rounded-md p-2 hover:bg-text/5 min-h-[44px] min-w-[44px]"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Desktop navigation - icon only with hover labels */}
            <nav className="hidden md:flex items-center gap-x-1 text-sm">
              {publicLinks?.map(({ to, label, icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group relative rounded-md px-3 py-2 hover:bg-text/5 min-h-[44px] inline-flex items-center"
                  title={label}
                >
                  <span className="text-xl">{icon}</span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {label}
                  </span>
                </Link>
              ))}
              {isAdmin &&
                adminLinks?.map(({ to, label, icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="group relative rounded-md px-3 py-2 font-medium text-accent hover:bg-accent/10 min-h-[44px] inline-flex items-center"
                    title={label}
                  >
                    <span className="text-xl">{icon}</span>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-accent text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {label}
                    </span>
                  </Link>
                ))}
            </nav>

            {/* Desktop user menu */}
            <div className="hidden md:flex items-center gap-3 text-sm">
              {loading ? (
                <span className="text-text/50">…</span>
              ) : user ? (
                <>
                  <span className="hidden lg:inline text-text/70">
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

          {/* Mobile menu */}
          {menuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-text/10 pt-4">
              <nav className="flex flex-col gap-2">
                {publicLinks?.map(({ to, label, icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-md px-4 py-3 hover:bg-text/5 flex items-center gap-3 text-base"
                  >
                    <span className="text-xl">{icon}</span>
                    <span>{label}</span>
                  </Link>
                ))}
                {isAdmin &&
                  adminLinks?.map(({ to, label, icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-md px-4 py-3 font-medium text-accent hover:bg-accent/10 flex items-center gap-3 text-base"
                    >
                      <span className="text-xl">{icon}</span>
                      <span>{label}</span>
                    </Link>
                  ))}
                <div className="border-t border-text/10 mt-2 pt-2">
                  {loading ? (
                    <span className="text-text/50 px-4">…</span>
                  ) : user ? (
                    <>
                      <div className="px-4 py-2 text-text/70 text-sm">
                        {user.displayName}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          signOut();
                          setMenuOpen(false);
                        }}
                        className="w-full text-left rounded-md px-4 py-3 hover:bg-text/5 text-base"
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/sign-in"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-md bg-accent px-4 py-3 font-medium text-white text-center hover:bg-accent/90"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <footer className="border-t border-text/10 px-4 py-6 text-center text-sm text-text/70">
        <p>Payment is made via Venmo after you receive your bouquet.</p>
        <p className="mt-1">
          Venmo:{" "}
          <a
            href={`venmo://paycharge?txn=pay&recipients=${import.meta.env.VITE_VENMO_USERNAME || 'LorraineSHellum'}`}
            className="font-medium text-accent hover:underline"
            onClick={() => {
              // Fallback to web if app doesn't open
              const venmoUsername = import.meta.env.VITE_VENMO_USERNAME || 'LorraineSHellum';
              setTimeout(() => {
                window.open(`https://venmo.com/${venmoUsername}`, '_blank');
              }, 1000);
            }}
          >
            @{import.meta.env.VITE_VENMO_USERNAME || 'LorraineSHellum'}
          </a>
        </p>
      </footer>
      </div>
    </PullToRefresh>
  );
}
