import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import PullToRefresh from './PullToRefresh';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/flowers', label: 'Flowers' },
    { to: '/garden', label: 'Garden' },
    { to: '/orders', label: 'Orders' },
    { to: '/bio', label: 'Bio' },
    { to: '/subscribe', label: 'Subscribe' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-serif text-rose-900">Fleurraine</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(link.to)
                      ? 'bg-rose-100 text-rose-900'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {user && isAdmin && (
                <>
                  <Link
                    to="/admin/photos"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive('/admin/photos')
                        ? 'bg-rose-100 text-rose-900'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Admin
                  </Link>
                </>
              )}
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/signin"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Sign In
                </Link>
              )}
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="md:hidden bg-white border-t border-gray-200 px-4 py-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(link.to)
                    ? 'bg-rose-100 text-rose-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user && isAdmin && (
              <Link
                to="/admin/photos"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Admin
              </Link>
            )}
            {user ? (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleSignOut();
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Sign Out
              </button>
            ) : (
              <Link
                to="/signin"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Sign In
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <PullToRefresh>{children}</PullToRefresh>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>Fleurraine — Fresh flowers from the garden</p>
        </div>
      </footer>
    </div>
  );
}