export default function Bio() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-serif text-rose-900 mb-6">About Lorraine</h1>

      <div className="prose prose-lg max-w-none">
        <p className="text-gray-700 leading-relaxed mb-4">
          Lorraine works full time, but her true passion is growing flowers.
          Every spare moment outside of work is spent in the garden — tending,
          planting, and nurturing blooms that eventually find their way into
          hand-tied bouquets.
        </p>

        <p className="text-gray-700 leading-relaxed mb-4">
          What started as a small patch of color by the front door has grown
          into a beloved neighborhood flower stand. Each bouquet is arranged
          by hand, with flowers cut fresh from the garden that morning.
        </p>

        <p className="text-gray-700 leading-relaxed mb-4">
          This little app helps Lorraine keep track of her flowers, share the
          beauty of each season, and connect with the community that has
          supported her passion project.
        </p>

        <p className="text-gray-500 italic text-sm mt-8">
          More of Lorraine's story coming soon.
        </p>
      </div>

      <div className="mt-8">
        <a
          href="/"
          className="inline-block px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}