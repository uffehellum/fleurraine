import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import VenmoButton from '../components/VenmoButton';
import StripeCheckoutButton from '../components/StripeCheckoutButton';
import { env } from '../lib/env';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-8">
        <h1 className="text-4xl font-serif text-rose-900 mb-4">Fleur Raine</h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          Fresh-cut flowers from Lorraine's garden, arranged with care and
          available at the neighborhood flower stand.
        </p>
      </section>

      {/* History link — kept on the front page as requested */}
      <section className="text-center">
        <Link
          to="/history"
          className="inline-block text-rose-600 hover:text-rose-800 font-medium underline"
        >
          View Stand History →
        </Link>
      </section>

      {/* Payment section — public, no login required */}
      <section className="max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-serif text-rose-900 mb-2 text-center">
          Buy a Bouquet
        </h2>
        <p className="text-gray-600 text-sm text-center mb-6">
          Pay ${env.DEFAULT_PRICE.toFixed(2)} for a fresh hand-tied bouquet.
          No account needed.
        </p>

        <div className="space-y-3">
          <VenmoButton amount={env.DEFAULT_PRICE} />
          <StripeCheckoutButton amount={env.DEFAULT_PRICE} />
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Secure checkout powered by Stripe. Test mode — no real charges.
        </p>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
        <Link
          to="/flowers"
          className="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-center"
        >
          <h3 className="font-serif text-lg text-rose-900 mb-1">Flowers</h3>
          <p className="text-sm text-gray-600">See what's blooming now</p>
        </Link>
        <Link
          to="/garden"
          className="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-center"
        >
          <h3 className="font-serif text-lg text-rose-900 mb-1">Garden</h3>
          <p className="text-sm text-gray-600">Explore the garden beds</p>
        </Link>
        <Link
          to="/bouquets"
          className="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-center"
        >
          <h3 className="font-serif text-lg text-rose-900 mb-1">Bouquets</h3>
          <p className="text-sm text-gray-600">Browse available bouquets</p>
        </Link>
      </section>

      {/* Auth prompt for signed-out users */}
      {!user && (
        <section className="text-center py-4">
          <p className="text-gray-600 text-sm mb-2">
            Want to track your orders and save your preferences?
          </p>
          <Link
            to="/signin"
            className="inline-block px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm"
          >
            Sign In
          </Link>
        </section>
      )}
    </div>
  );
}