import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import StripeCheckoutButton from '../components/StripeCheckoutButton';
import PhotoDisplay from '../components/PhotoDisplay';
import { env } from '../lib/env';

interface StandPhoto {
  id: string;
  category: string;
  status: string;
  storage_key_thumb: string;
  storage_key_mobile: string;
  storage_key_orig: string;
  flower_name?: string;
  description?: string;
  share_token?: string;
  exif_taken_at?: string;
  camera_model?: string;
  ai_analysis?: {
    description?: string;
    subjects?: string[];
    location?: string;
  };
}

export default function Home() {
  const { user } = useAuth();
  const [latestPhoto, setLatestPhoto] = useState<StandPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestStandPhoto();
  }, []);

  const fetchLatestStandPhoto = async () => {
    try {
      const response = await fetch('/api/photos/latest-stand');

      if (response.status === 404) {
        // No photo yet — not an error
        setLatestPhoto(null);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch latest photo');
      }

      const data = await response.json();
      setLatestPhoto(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="text-center py-8">
        <h1 className="text-4xl font-serif text-rose-900 mb-4">Fleurraine</h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto">
          Fresh-cut flowers from Lorraine's garden, arranged with care and
          available at the neighborhood flower stand.
        </p>
      </section>

      {/* Latest flower stand photo */}
      <section className="max-w-4xl mx-auto">
        <h2 className="font-serif text-2xl text-rose-900 mb-4 text-center">
          Today's Flower Stand
        </h2>

        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-pulse">
              <div className="bg-gray-200 h-64 rounded-lg mb-4"></div>
              <div className="bg-gray-200 h-4 w-3/4 mx-auto rounded"></div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">
            {error}
          </div>
        )}

        {!loading && !error && latestPhoto && (
          <PhotoDisplay photo={latestPhoto} showDetails={true} />
        )}

        {!loading && !error && !latestPhoto && (
          <div className="bg-gray-50 rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No stand photos yet. Check back soon!</p>
          </div>
        )}
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
          Pay for Flowers
        </h2>
        <p className="text-gray-600 text-sm text-center mb-6">
          Pay ${env.DEFAULT_PRICE.toFixed(2)} for a fresh hand-tied bouquet.
          No account needed — Apple Pay and cards accepted.
        </p>

        <StripeCheckoutButton amount={env.DEFAULT_PRICE} />

        <p className="text-xs text-gray-400 text-center mt-4">
          Secure checkout powered by Stripe. Apple Pay on iPhone, cards everywhere.
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
          to="/terryscorner"
          className="block p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-center"
        >
          <h3 className="font-serif text-lg text-rose-900 mb-1">Terry's Corner</h3>
          <p className="text-sm text-gray-600">Pay in person at the stand</p>
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