import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Bouquet {
  id: string;
  bouquet_number: number;
  price_cents: number;
  storage_key_mobile: string;
  storage_key_thumb: string;
  description?: string;
  exif_taken_at?: string;
  detected_flowers?: string[];
  ai_analysis?: {
    description?: string;
    confidence?: number;
  };
}

export default function Bouquets() {
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBouquets();
  }, []);

  const fetchBouquets = async () => {
    try {
      const response = await fetch('/api/bouquets/available', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bouquets');
      }

      const data = await response.json();
      setBouquets(data || []);
    } catch (err) {
      console.error('Failed to fetch bouquets:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="p-4">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 max-w-7xl mx-auto">
      <h1 className="font-heading text-3xl mb-6">Bouquet Gallery</h1>
      
      {bouquets.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No bouquets available for purchase at the moment.</p>
          <p className="text-sm text-gray-500 mt-2">Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {bouquets.map((bouquet) => (
            <div
              key={bouquet.id}
              className="bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/bouquets/${bouquet.id}`)}
            >
              <div className="aspect-square bg-gray-100">
                <img
                  src={`/api/storage/${bouquet.storage_key_mobile}`}
                  alt={`Bouquet #${bouquet.bouquet_number}`}
                  className="w-full h-full object-cover"
                  style={{ imageOrientation: 'from-image' }}
                />
              </div>
              
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-gray-900">
                    #{bouquet.bouquet_number}
                  </span>
                  <span className="text-2xl font-bold text-green-600">
                    ${(bouquet.price_cents / 100).toFixed(2)}
                  </span>
                </div>
                
                {bouquet.detected_flowers && bouquet.detected_flowers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {bouquet.detected_flowers.slice(0, 3).map((flower, i) => (
                      <span
                        key={i}
                        className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full"
                      >
                        {flower}
                      </span>
                    ))}
                    {bouquet.detected_flowers.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{bouquet.detected_flowers.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
