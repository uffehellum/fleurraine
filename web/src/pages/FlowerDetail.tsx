import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

interface Photo {
  id: string;
  storage_key_thumb: string;
  storage_key_mobile: string;
  flower_name?: string;
  flower_names?: string[];
  description?: string;
  uploaded_at: string;
  exif_taken_at?: string;
}

export default function FlowerDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (name) {
      fetchFlowerPhotos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const fetchFlowerPhotos = async () => {
    try {
      const response = await fetch('/api/photos?category=flower_type&status=published', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      const allPhotos: Photo[] = await response.json();

      // Filter photos that have the requested flower name in flower_names array
      // (or fall back to matching photo.flower_name)
      const decodedName = decodeURIComponent(name || '').toLowerCase();
      const filtered = allPhotos.filter((photo) => {
        if (photo.flower_names && photo.flower_names.length > 0) {
          return photo.flower_names.some((f) => f.toLowerCase() === decodedName);
        }
        return photo.flower_name?.toLowerCase() === decodedName;
      });

      // Sort by date descending
      filtered.sort((a, b) => {
        const dateA = new Date(a.exif_taken_at || a.uploaded_at).getTime();
        const dateB = new Date(b.exif_taken_at || b.uploaded_at).getTime();
        return dateB - dateA;
      });

      setPhotos(filtered);
    } catch (err) {
      console.error('Failed to load flower photos:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="p-4 max-w-7xl mx-auto text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
      </main>
    );
  }

  return (
    <main className="p-4 max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <div className="mb-4 text-sm text-gray-500">
        <Link to="/flowers" className="text-green-700 hover:underline">
          All Flowers
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-semibold">{name}</span>
      </div>

      <h1 className="font-heading text-3xl mb-2">{name} Gallery</h1>
      <p className="text-gray-600 mb-6">Viewing all captured photos featuring {name}.</p>

      {photos.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
          <p className="text-gray-600">No photos found for {name}.</p>
          <Link to="/flowers" className="text-green-700 hover:underline mt-2 inline-block">
            Back to All Flowers
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => navigate(`/photos/${photo.id}`)}
              className="bg-white rounded-lg shadow overflow-hidden cursor-pointer hover:shadow-md transition-shadow relative group"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden">
                <img
                  src={`/api/storage/${photo.storage_key_mobile}`}
                  alt={photo.flower_name || name}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                  style={{ imageOrientation: 'from-image' }}
                />
              </div>
              {photo.description && (
                <div className="p-2 border-t">
                  <p className="text-xs text-gray-600 truncate">{photo.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
