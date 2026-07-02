import { useState } from 'react';
import { env } from '../lib/env';

interface VenmoButtonProps {
  amount?: number;
  note?: string;
  className?: string;
  label?: string;
}

/**
 * Pay with Venmo via deep link.
 *
 * Venmo does not offer a public web payment API, so we use the standard
 * Venmo deep link (`https://venmo.com/username?txn=pay&amount=...&note=...`).
 * On mobile this opens the Venmo app; on desktop it opens the Venmo web profile.
 */
export default function VenmoButton({
  amount = env.DEFAULT_PRICE,
  note = 'Bouquet from Fleur Raine',
  className = '',
  label = 'Pay with Venmo',
}: VenmoButtonProps) {
  const [error, setError] = useState<string | null>(null);

  const handlePay = () => {
    setError(null);
    const handle = env.VENMO_HANDLE;
    if (!handle) {
      setError('Venmo handle is not configured.');
      return;
    }
    const encodedNote = encodeURIComponent(note);
    const url = `https://venmo.com/${handle}?txn=pay&amount=${amount}&note=${encodedNote}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handlePay}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#3D95CE] text-white font-semibold rounded-lg hover:bg-[#3385B8] transition-colors disabled:opacity-50"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.5 6.5c-.5 2.5-2.8 4.6-3.6 5.2-.8.6-1.1 1.2-1.3 2.1-.1.5-.5.8-1 .8H8.8c-.4 0-.7-.3-.6-.8.3-1.8 1.4-3.2 2.8-4.3.7-.5 1.3-1 1.5-1.6.2-.6-.2-1-.8-1-.4 0-.8.2-1.1.5-.2.2-.5.3-.8.2-.4-.1-.6-.5-.4-.9.5-1.1 1.8-1.9 3.2-1.9 1.6 0 2.7.9 2.4 2.7z"/>
        </svg>
        {label} · ${amount.toFixed(2)}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}