import { useEffect, useRef, useState } from "react";

interface PullToRefreshProps {
  children: React.ReactNode;
}

export default function PullToRefresh({ children }: PullToRefreshProps) {
  // Visual state (triggers re-render for the indicator/content transform)
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs that the touch handlers read/write so listeners can stay stable
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);

  // Sync helper: update both the ref and the visual state
  const setPull = (value: number) => {
    pullDistanceRef.current = value;
    setPullDistance(value);
  };
  const setRefreshing = (value: boolean) => {
    isRefreshingRef.current = value;
    setIsRefreshing(value);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only track if we are at the very top of the page
      if (window.scrollY > 5 || isRefreshingRef.current) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      isDraggingRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current || !isDraggingRef.current || isRefreshingRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Ensure it is primarily a vertical pull down, not a horizontal swipe
      if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
        // If we are at scroll position 0, prevent native scrolling and bouncy behavior
        if (window.scrollY <= 0) {
          if (e.cancelable) {
            e.preventDefault();
          }

          // Apply elastic/spring resistance (damping)
          const resistance = 0.4;
          const distance = deltaY * resistance;

          // Clamp visual pull distance to 80px max
          const clampedDistance = Math.min(80, distance);
          setPull(clampedDistance);
        }
      } else if (deltaY < 0) {
        // Pulling up, cancel any pull down tracking
        setPull(0);
        isDraggingRef.current = false;
      }
    };

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      // Threshold to trigger refresh
      if (pullDistanceRef.current >= 50 && !isRefreshingRef.current) {
        setRefreshing(true);
        setPull(60); // Keep it visible at 60px while refreshing

        // Trigger reload after brief animation delay for great UX
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        // Snap back to 0
        setPull(0);
      }
      touchStartRef.current = null;
    };

    // Passive false is crucial to allow preventDefault() on touchmove in modern mobile browsers
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, []); // Stable listeners for the entire gesture lifecycle

  // Handle transition when resetting or locking
  const transitionStyle = isDraggingRef.current
    ? "none"
    : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease";

  // Calculate rotation and scale based on pull distance
  const progress = Math.min(1, pullDistance / 50);
  const scale = 0.5 + progress * 0.5;
  const rotate = progress * 360;

  return (
    <div ref={containerRef} className="relative w-full min-h-screen">
      {/* Pull Indicator overlay */}
      <div
        className="absolute left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
        style={{
          height: "60px",
          top: "-60px",
          transform: `translateY(${pullDistance}px)`,
          opacity: progress,
          transition: transitionStyle,
        }}
      >
        <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-md border border-text/5">
          {isRefreshing ? (
            // Spinning loading ring
            <svg
              className="w-6 h-6 animate-spin text-accent"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            // Pull down arrow that rotates to show completion progress
            <svg
              className="w-5 h-5 text-accent transition-transform duration-100"
              style={{
                transform: `rotate(${rotate}deg) scale(${scale})`,
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Main app content with slight springy translation when pulling */}
      <div
        style={{
          transform: `translateY(${pullDistance * 0.35}px)`,
          transition: transitionStyle,
        }}
        className="w-full min-h-screen flex flex-col"
      >
        {children}
      </div>
    </div>
  );
}