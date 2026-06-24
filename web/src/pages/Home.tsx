import { useEffect, useState } from 'react';
import PhotoDisplay from '../components/PhotoDisplay';

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
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-2">Welcome to Fleurraine</h1>
        <p className="text-gray-600">
          Fresh, locally grown flowers cut in the early morning
        </p>
      </div>

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
            <span>Locally grown flowers, supporting sustainable agriculture</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✓</span>
            <span>Cut fresh in the early morning for maximum freshness</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✓</span>
            <span>Flowers that can last over a week with proper care</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✓</span>
            <span>Beautiful seasonal varieties throughout the year</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
