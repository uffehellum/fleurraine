import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PhotoDisplay from '../components/PhotoDisplay';
import ReviewForm from '../components/ReviewForm';

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
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    fetchLatestStandPhoto();
  }, []);

  const fetchLatestStandPhoto = async () => {
    try {
      const response = await fetch('/api/photos/latest-stand');
      
      if (response.status === 404) {
        // No photo yet - not an error
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
    <main className="p-4 max-w-4xl mx-auto">
      <div className="mb-6 text-center">
        <h1 className="font-heading text-3xl mb-2">Welcome to Fleurraine</h1>
        <p className="text-gray-600">
          Fresh, locally grown flowers, watered and cut in the early morning
        </p>
        
        {/* Submit Review Button - Only visible when authenticated */}
        {user && !showReviewForm && (
          <div className="mt-4">
            <button
              onClick={() => setShowReviewForm(true)}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700
                font-medium shadow-md inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Submit a Review
            </button>
          </div>
        )}
      </div>

      {/* Review Form Modal */}
      {showReviewForm && (
        <div className="mb-8">
          <ReviewForm
            onSuccess={() => setShowReviewForm(false)}
            onCancel={() => setShowReviewForm(false)}
          />
        </div>
      )}

      {/* Latest flower stand photo */}
      <section className="mb-8">
        <h2 className="font-heading text-2xl mb-4">Today's Flower Stand</h2>
        
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
            <p className="text-gray-600">
              No flower stand photo available yet. Check back soon!
            </p>
          </div>
        )}
      </section>

      {/* Information section */}
      <section className="bg-green-50 rounded-lg p-6">
        <h3 className="font-heading text-xl mb-3">Why Choose Fleurraine?</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✓</span>
            <span>Locally grown flowers, supporting sustainable gardening</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✓</span>
            <span>Cut fresh in the early morning for maximum longevity</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✓</span>
            <span>Flowers that can last over a week with proper care</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✓</span>
            <span>Beautiful varieties throughout the season</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
