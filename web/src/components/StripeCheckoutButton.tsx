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
  label = 'Bouquet from Fleur Raine',
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
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#635BFF] text-white font-semibold rounded-lg hover:bg-[#5249E5] transition-colors disabled:opacity-50"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 60 25" fill="none" aria-hidden="true">
              <path
                fill="currentColor"
                d="M59.64 14.26h-8.06c.19 1.93 1.68 2.55 3.35 2.55 1.69 0 3.02-.36 4.07-.93v3.34c-1.13.63-2.63.97-4.55.97-4.06 0-7.05-2.53-7.05-7.03 0-4.37 2.76-7.08 6.56-7.08 3.81 0 5.99 2.65 5.99 6.62 0 .35-.04 1.1-.31 2.56zm-5.66-5.05c-1.07 0-2.27.76-2.27 2.73h4.56c0-1.97-1.21-2.73-2.29-2.73zM40.95 5.38c-1.42 0-2.34.74-2.85 1.51l-.14-1.23h-3.56v18.04h3.58l.42-3.22c.5.79 1.42 1.51 2.85 1.51 2.55 0 4.96-2.04 4.96-7.04 0-4.55-2.41-6.58-4.96-6.58zm-.76 10.12c-.83 0-1.34-.42-1.61-.93l-.02-5.32c.29-.55.81-.95 1.63-.95 1.27 0 1.81 1.27 1.81 3.59 0 2.41-.53 3.61-1.81 3.61zM30.32 5.38c-1.42 0-2.34.74-2.85 1.51l-.14-1.23h-3.56v18.04h3.58l.42-3.22c.5.79 1.42 1.51 2.85 1.51 2.55 0 4.96-2.04 4.96-7.04 0-4.55-2.41-6.58-4.96-6.58zm-.76 10.12c-.29.55-.81.95-1.63.95-1.27 0-1.81-1.2-1.81-3.61 0-2.32.54-3.59 1.81-3.59.83 0 1.34.4 1.63.95v5.3zM21.5 5.66l-.42 3.23c-.5-.79-1.42-1.51-2.85-1.51-2.55 0-4.96 2.03-4.96 6.58 0 5 2.41 7.04 4.96 7.04 1.42 0 2.34-.72 2.85-1.51l.14 1.23h3.56V5.66h-3.58zm-.42 10.12c-.29.55-.81.95-1.63.95-1.27 0-1.81-1.2-1.81-3.61 0-2.32.54-3.59 1.81-3.59.83 0 1.34.4 1.63.95v5.3z"
              />
            </svg>
            Pay with Stripe · ${amount.toFixed(2)}
          </>
        )}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}