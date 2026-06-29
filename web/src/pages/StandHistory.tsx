import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface Photo {
  id: string;
  category: string;
  status: string;
  storage_key_thumb: string;
  storage_key_mobile: string;
  storage_key_orig: string;
  exif_taken_at?: string;
  uploaded_at: string;
  description?: string;
  flower_name?: string;
}

export default function StandHistory() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStandHistory();
  }, []);

  const fetchStandHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/photos?category=stand&status=published');
      if (!response.ok) {
        throw new Error('Failed to fetch stand history');
      }
      const data = await response.json();
      setPhotos(data || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load stand history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-4 max-w-6xl mx-auto">
      {/* Contextual Hierarchical Navigation Links */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-900 pr-3"
        >
          ← Back to Home
        </button>
      </div>

      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-2">Flower Stand Chronology</h1>
        <p className="text-gray-600 text-sm">
          A historical timeline of our physical flower stand status and daily offerings.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="text-gray-500 mt-4 text-sm font-medium">Loading history timeline...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center border border-dashed border-gray-300">
          <p className="text-gray-600 text-lg">No historical stand photos found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo) => {
            const dateStr = photo.exif_taken_at || photo.uploaded_at;
            const displayDate = new Date(dateStr).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            const displayTime = new Date(dateStr).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            });

            return (
              <Link
                key={photo.id}
                to={`/photos/${photo.id}`}
                className="bg-white rounded-xl shadow overflow-hidden cursor-pointer hover:shadow-md hover:border-accent/40 border border-gray-200 transition-all flex flex-col"
              >
                <div className="aspect-video bg-gray-100 relative overflow-hidden">
                  <img
                    src={`/api/storage/${photo.storage_key_mobile}`}
                    alt={photo.flower_name || 'Flower Stand Photo'}
                    className="w-full h-full object-cover hover:scale-101 transition-transform"
                    style={{ imageOrientation: 'from-image' }}
                  />
                  <div className="absolute bottom-2 left-2">
                    <span className="bg-black/60 text-white text-[11px] px-2 py-1 rounded font-medium backdrop-blur-xs">
                      {displayTime}
                    </span>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-heading text-base font-semibold text-gray-800 line-clamp-1 mb-1">
                      {displayDate}
                    </h3>
                    {photo.description && (
                      <p className="text-gray-600 text-xs line-clamp-2 italic mb-2">
                        "{photo.description}"
                      </p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-accent font-semibold hover:underline">
                    <span>View full resolution & details</span>
                    <span>→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
