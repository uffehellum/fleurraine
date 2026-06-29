import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Bouquet {
  id: string;
  bouquet_number: number;
  price_cents: number;
  storage_key_mobile: string;
  storage_key_orig: string;
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

export default function BouquetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bouquet, setBouquet] = useState<Bouquet | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBouquet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchBouquet = async () => {
    try {
      const response = await fetch(`/api/photos/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch bouquet');
      }

      const data = await response.json();
      
      // Verify it's a numbered bouquet
      if (!data.bouquet_number) {
        navigate('/bouquets');
        return;
      }

      setBouquet(data);
    } catch (err) {
      console.error('Failed to fetch bouquet:', err);
      navigate('/bouquets');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = `Check out Bouquet #${bouquet?.bouquet_number} for $${((bouquet?.price_cents || 0) / 100).toFixed(2)}!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bouquet #${bouquet?.bouquet_number}`,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error occurred
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      } catch (err) {
        setShowShareMenu(true);
      }
    }
  };

  const handleVenmo = () => {
    if (!bouquet) return;
    
    const venmoUsername = import.meta.env.VITE_VENMO_USERNAME || 'LorraineSHellum';
    const note = `Bouquet #${bouquet.bouquet_number}`;
    const amount = (bouquet.price_cents / 100).toFixed(2);
    
    // Venmo deep link
    const venmoUrl = `venmo://paycharge?txn=pay&recipients=${venmoUsername}&amount=${amount}&note=${encodeURIComponent(note)}`;
    
    // Try to open Venmo app, fallback to web
    window.location.href = venmoUrl;
    
    // Fallback to web after a delay if app doesn't open
    setTimeout(() => {
      window.open(`https://venmo.com/${venmoUsername}?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`, '_blank');
    }, 1000);
  };

  const handleApplePay = async () => {
    if (!bouquet) return;
    
    if (!user) {
      alert('Please sign in to complete your purchase.');
      // Save current path to return back after authentication
      localStorage.setItem('authReturnTo', window.location.pathname);
      navigate('/sign-in');
      return;
    }

    if (bouquet.purchased_by) {
      alert('This bouquet has already been sold.');
      return;
    }

    const confirmPurchase = window.confirm(`Confirm your purchase of Bouquet #${bouquet.bouquet_number} for $${(bouquet.price_cents / 100).toFixed(2)} with Apple Pay?`);
    if (!confirmPurchase) return;

    setPurchasing(true);

    try {
      const response = await fetch(`/api/bouquets/${id}/purchase`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Payment failed');
      }

      alert(`Thank you! You have successfully purchased Bouquet #${bouquet.bouquet_number}! An email confirmation has been sent to Lorraine.`);
      fetchBouquet();
    } catch (err) {
      console.error('Purchase failed:', err);
      alert(err instanceof Error ? err.message : 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
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

  if (!bouquet) {
    return (
      <main className="p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          Bouquet not found
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/bouquets')}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Gallery
      </button>

      {/* Large photo */}
      <div className="mb-6 rounded-lg overflow-hidden shadow-lg">
        <img
          src={`/api/storage/${bouquet.storage_key_mobile}`}
          alt={`Bouquet #${bouquet.bouquet_number}`}
          className="w-full"
          style={{ imageOrientation: 'from-image' }}
        />
      </div>

      {/* Bouquet details */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">
            Bouquet #{bouquet.bouquet_number}
          </h1>
          <div className="text-3xl font-bold text-green-600">
            ${(bouquet.price_cents / 100).toFixed(2)}
          </div>
        </div>

        {/* Photo date */}
        {bouquet.exif_taken_at && (
          <div className="mb-3 text-gray-600">
            📅 Photographed: {new Date(bouquet.exif_taken_at).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
        )}

        {/* Detected flowers */}
        {bouquet.detected_flowers && bouquet.detected_flowers.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              🌸 Flowers Detected:
            </h3>
            <div className="flex flex-wrap gap-2">
              {bouquet.detected_flowers.map((flower, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                >
                  {flower}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI description */}
        {bouquet.ai_analysis?.description && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              Description:
            </h3>
            <p className="text-gray-600">
              {bouquet.ai_analysis.description}
            </p>
          </div>
        )}
      </div>

      {/* Sold Out Banner if sold */}
      {bouquet.purchased_by && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-center font-semibold text-lg mb-4 animate-pulse">
          🔴 Sold Out — This unique bouquet has already been purchased!
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Apple Pay button */}
        <button
          onClick={handleApplePay}
          disabled={purchasing || !!bouquet.purchased_by}
          className={`w-full text-white py-4 rounded-lg text-lg font-semibold flex items-center justify-center gap-2 ${
            bouquet.purchased_by
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-black hover:bg-gray-800'
          }`}
        >
          {purchasing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
          )}
          {bouquet.purchased_by ? 'Sold Out' : 'Buy with Apple Pay'}
        </button>

        {/* Venmo button */}
        <button
          onClick={handleVenmo}
          disabled={!!bouquet.purchased_by}
          className={`w-full text-white py-4 rounded-lg text-lg font-semibold flex items-center justify-center gap-2 ${
            bouquet.purchased_by
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#008CFF] hover:bg-[#0074D9]'
          }`}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.83 4.18c.93 1.31 1.36 2.87 1.36 4.72 0 5.88-5.03 13.51-9.16 13.51-1.67 0-3.08-1.09-3.08-3.18 0-.46.06-.98.19-1.56l1.43-7.54-3.23-.01L8.01 7.8h3.23l.34-1.78c.58-3.02 2.57-5.02 5.66-5.02.93 0 1.81.13 2.59.38l-.82 3.02c-.52-.19-1.04-.29-1.56-.29-1.31 0-2.12.73-2.47 2.18l-.26 1.51h3.23l-.52 2.72h-3.23l-1.43 7.54c-.06.31-.09.58-.09.79 0 .58.31.88.79.88 1.67 0 4.72-4.72 4.72-9.44 0-1.31-.29-2.39-.88-3.23l1.49-1.9z"/>
          </svg>
          {bouquet.purchased_by ? 'Sold Out' : 'Pay with Venmo'}
        </button>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share with a Friend
        </button>
      </div>

      {/* Share menu fallback */}
      {showShareMenu && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Share this bouquet</h3>
            <div className="mb-4">
              <input
                type="text"
                value={window.location.href}
                readOnly
                className="w-full px-3 py-2 border rounded"
                onClick={(e) => e.currentTarget.select()}
              />
            </div>
            <button
              onClick={() => setShowShareMenu(false)}
              className="w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
