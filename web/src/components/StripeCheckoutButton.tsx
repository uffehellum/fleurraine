import { useState } from 'react';
import { env } from '../lib/env';

interface StripeCheckoutButtonProps {
  amount?: number;
  label?: string;
  className?: string;
}

/**
 * Stripe Checkout button.
 *
 * Sends a POST to /api/payments/checkout with the amount (in cents) and label.
 * The backend creates a Stripe Checkout Session with a fixed 9% sales tax
 * line item (Camano Island) and returns a URL to redirect to.
 *
 * No login required — this is a public, guest checkout flow.
 */
export default function StripeCheckoutButton({
  amount = env.DEFAULT_PRICE,
  label = 'Bouquet from Fleurraine',
  className = '',
}: StripeCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: Math.round(amount * 100), // convert dollars to cents
          label,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Checkout failed');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 9a2 2 0 012-2h2l1.5-2h7L17 7h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            Buy Now · ${amount.toFixed(2)}
          </>
        )}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}