/**
 * InstallPrompt component
 * 
 * Shows instructions for installing the Fleurraine PWA on iPhone/iPad.
 * Displays a helpful banner with step-by-step instructions for adding
 * the app to the home screen.
 */

import { useState, useEffect } from "react";

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running on iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already installed (running in standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Show prompt if on iOS and not installed
    // Only show once per session
    const hasSeenPrompt = sessionStorage.getItem('hasSeenInstallPrompt');
    if (iOS && !standalone && !hasSeenPrompt) {
      // Delay showing the prompt slightly for better UX
      setTimeout(() => setShowPrompt(true), 2000);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('hasSeenInstallPrompt', 'true');
  };

  // Don't show if not iOS, already installed, or dismissed
  if (!isIOS || isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[--color-bg] border-t-2 border-[--color-accent] shadow-lg animate-slide-up">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3">
          {/* App Icon */}
          <div className="flex-shrink-0">
            <img 
              src="/icons/apple-touch-icon.png" 
              alt="Fleurraine" 
              className="w-12 h-12 rounded-lg shadow-sm"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg font-semibold text-[--color-text] mb-1">
              Install Fleurraine
            </h3>
            <p className="text-sm text-[--color-text-secondary] mb-3">
              Add this app to your home screen for quick access and a better experience.
            </p>

            {/* Instructions */}
            <div className="bg-white/50 rounded-lg p-3 mb-3 text-sm text-[--color-text-secondary]">
              <ol className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-[--color-accent]">1.</span>
                  <span>
                    Tap the <strong>Share</strong> button 
                    <svg className="inline-block w-4 h-4 mx-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
                    </svg>
                    at the bottom of your screen
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-[--color-accent]">2.</span>
                  <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-[--color-accent]">3.</span>
                  <span>Tap <strong>"Add"</strong> in the top right corner</span>
                </li>
              </ol>
            </div>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="text-sm text-[--color-text-secondary] hover:text-[--color-text] underline"
            >
              Maybe later
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-[--color-text-secondary] hover:text-[--color-text]"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
