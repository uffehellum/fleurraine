import { useState } from 'react';

/**
 * Terry's Corner — a special landing page where flowers are sold, but
 * customers are directed to pay Terry's Corner directly (NOT through the app).
 *
 * A QR code is shown so customers can open the main app, with a clear notice
 * that payment must be made to Terry's Corner, not via the app's payment buttons.
 */
export default function TerrysCorner() {
  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
  // Use a public QR code API so no extra dependency is required.
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(appUrl)}`;
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(appUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // ignore
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-serif text-rose-900 mb-2">Terry's Corner</h1>
      <p className="text-gray-600 mb-6">Fresh flowers from the garden</p>

      <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <span aria-hidden="true">⚠️</span> Important: Pay Terry's Corner Directly
        </h2>
        <p className="text-amber-900 text-sm leading-relaxed">
          Flowers sold here are paid for <strong>directly to Terry's Corner</strong>.
          Please do <strong>not</strong> use the app's Venmo or Stripe buttons to pay
          for flowers from this location. The app is here to help you explore the
          garden, view flowers, and stay connected — but payment at Terry's Corner
          is handled in person.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 text-center">
        <h2 className="text-xl font-serif text-rose-900 mb-4">Connect to the App</h2>
        <p className="text-gray-600 text-sm mb-4">
          Scan this QR code to open the Fleur Raine app on your phone:
        </p>
        <div className="flex justify-center mb-4">
          <img
            src={qrCodeUrl}
            alt="QR code to open the Fleur Raine app"
            width={240}
            height={240}
            className="border border-gray-100 rounded"
          />
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="text-sm text-rose-600 hover:text-rose-800 underline"
        >
          {copied ? 'Link copied!' : 'Copy app link instead'}
        </button>
      </div>

      <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-serif text-rose-900 mb-3">What's in Bloom</h2>
        <p className="text-gray-700 text-sm leading-relaxed mb-3">
          Terry's Corner features fresh-cut bouquets arranged daily from
          Lorraine's garden. Each bouquet is unique and reflects what's
          blooming this week.
        </p>
        <a
          href="/flowers"
          className="inline-block text-rose-600 hover:text-rose-800 text-sm font-medium underline"
        >
          View current flowers →
        </a>
      </div>

      <div className="text-center">
        <a
          href="/"
          className="inline-block px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
        >
          Open the App
        </a>
      </div>
    </div>
  );
}