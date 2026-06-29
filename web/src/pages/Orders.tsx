import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import ReviewForm from '../components/ReviewForm';

interface PurchasedBouquet {
  id: string;
  bouquet_number: number;
  price_cents: number;
  storage_key_mobile: string;
  storage_key_thumb: string;
  description?: string;
  uploaded_at: string;
  sold_at?: string;
  purchased_by?: string;
}

interface CustomOrder {
  id: string;
  description: string;
  price_cents: number;
  submitted_at: string;
  status: string;
}

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [bouquets, setBouquets] = useState<PurchasedBouquet[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/sign-in');
      return;
    }

    if (user) {
      fetchPurchaseHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const fetchPurchaseHistory = async () => {
    setLoading(true);
    try {
      // 1. Fetch purchased bouquets
      const response = await fetch('/api/bouquets/all', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // Filter only bouquets purchased by current logged in user
        const userPurchases = (data || []).filter(
          (b: PurchasedBouquet) => b.purchased_by === user?.id
        );
        setBouquets(userPurchases);
      }

      // 2. Fetch custom grab-and-go orders from localStorage
      const savedCustom = JSON.parse(
        localStorage.getItem('fleurraine_custom_orders') || '[]'
      );
      setCustomOrders(savedCustom);
    } catch (err) {
      console.error('Failed to load purchase history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="p-4 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="text-gray-500 mt-4 text-sm">Loading purchase history...</p>
        </div>
      </main>
    );
  }

  // Combine both types of orders for display sorting by date
  const combinedHistory = [
    ...bouquets.map((b) => ({
      id: b.id,
      type: 'bouquet',
      title: `Numbered Bouquet #${b.bouquet_number}`,
      price_cents: b.price_cents,
      date: b.sold_at || b.uploaded_at,
      image: `/api/storage/${b.storage_key_thumb}`,
      description: b.description || 'Freshly assembled floral bouquet',
    })),
    ...customOrders.map((o) => ({
      id: o.id,
      type: 'custom',
      title: o.description,
      price_cents: o.price_cents,
      date: o.submitted_at,
      image: null,
      description: 'Grabbed and paid directly from physical stand',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl mb-1">My Orders & Receipts</h1>
          <p className="text-gray-600 text-sm">
            Thank you for supporting local flowers! Here is your purchase history.
          </p>
        </div>

        {user && !showReviewForm && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="bg-accent text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-accent/90 shadow-sm"
          >
            ✍️ Post Review
          </button>
        )}
      </div>

      {showReviewForm && (
        <div className="mb-8 p-4 border border-green-200 bg-green-50/50 rounded-xl">
          <ReviewForm
            onSuccess={() => {
              setShowReviewForm(false);
              alert('Review submitted successfully! Thank you!');
            }}
            onCancel={() => setShowReviewForm(false)}
          />
        </div>
      )}

      {combinedHistory.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center border border-dashed border-gray-300">
          <p className="text-gray-600 text-lg mb-2">No purchases recorded yet</p>
          <p className="text-gray-500 text-sm mb-6">
            Pick up a gorgeous fresh bouquet or flower jar from the stand to get started!
          </p>
          <Link
            to="/"
            className="bg-accent text-white px-6 py-3 rounded-lg font-medium hover:bg-accent/90 shadow-sm"
          >
            Browse Today's Stand
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {combinedHistory.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 items-center shadow-xs hover:border-accent/40 transition-colors"
            >
              {/* Product Thumbnail (if bouquet) */}
              {item.image ? (
                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    style={{ imageOrientation: 'from-image' }}
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg bg-accent/10 text-accent text-2xl flex items-center justify-center flex-shrink-0 font-bold">
                  🍯
                </div>
              )}

              {/* Product Info */}
              <div className="flex-1">
                <div className="flex flex-wrap justify-between items-start gap-1">
                  <h3 className="font-heading text-lg text-gray-900 font-semibold">
                    {item.title}
                  </h3>
                  <span className="text-lg font-bold text-green-600">
                    ${(item.price_cents / 100).toFixed(2)}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5">
                  Ordered on:{' '}
                  {new Date(item.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-gray-600 text-sm mt-1">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
