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
  purchased_by?: string;
  sold_at?: string;
  ai_analysis?: {
    description?: string;
    confidence?: number;
  };
}

export default function Bouquets() {
  const [activeTab, setActiveTab] = useState<'available' | 'all'>('available');
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBouquets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchBouquets = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'available' ? '/api/bouquets/available' : '/api/bouquets/all';
      const response = await fetch(endpoint, {
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

  return (
    <main className="p-4 max-w-7xl mx-auto">
      <h1 className="font-heading text-3xl mb-6">Bouquet Gallery</h1>

      {/* Tabs bar */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('available')}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors duration-200 ${
            activeTab === 'available'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Available
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors duration-200 ${
            activeTab === 'all'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          All
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      ) : bouquets.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">
            {activeTab === 'available'
              ? 'No bouquets available for purchase at the moment.'
              : 'No bouquets found in the database.'}
          </p>
          <p className="text-sm text-gray-500 mt-2">Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {bouquets.map((bouquet) => {
            const isSold = !!bouquet.purchased_by;

            return (
              <div
                key={bouquet.id}
                className="bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-lg transition-shadow relative"
                onClick={() => navigate(`/bouquets/${bouquet.id}`)}
              >
                <div className="aspect-square bg-gray-100 relative">
                  <img
                    src={`/api/storage/${bouquet.storage_key_mobile}`}
                    alt={`Bouquet #${bouquet.bouquet_number}`}
                    className="w-full h-full object-cover"
                    style={{ imageOrientation: 'from-image' }}
                  />
                  {/* Status Overlay for "All" tab */}
                  {activeTab === 'all' && (
                    <div className="absolute top-2 right-2">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold shadow-sm ${
                          isSold
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-green-100 text-green-800 border border-green-200'
                        }`}
                      >
                        {isSold ? 'Sold' : 'Available'}
                      </span>
                    </div>
                  )}
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
            );
          })}
        </div>
      )}
    </main>
  );
}
