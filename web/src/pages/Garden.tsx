import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Photo {
  id: string;
  category: string;
  storage_key_thumb: string;
  storage_key_mobile: string;
  row_number?: number;
  row_numbers?: number[];
  uploaded_at: string;
  exif_taken_at?: string;
}

interface BedGroup {
  rowNumber: number;
  newestPhoto: Photo;
  count: number;
}

export default function Garden() {
  const [bedGroups, setBedGroups] = useState<BedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGarden();
  }, []);

  const fetchGarden = async () => {
    try {
      const response = await fetch('/api/photos?category=garden_row&status=published', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      const photos: Photo[] = await response.json();

      // Group photos by each number in row_numbers array (or fall back to row_number)
      const groupsMap: Record<number, Photo[]> = {};

      photos.forEach((photo) => {
        const rows = photo.row_numbers && photo.row_numbers.length > 0 
          ? photo.row_numbers 
          : (photo.row_number ? [photo.row_number] : []);

        rows.forEach((row) => {
          if (!groupsMap[row]) {
            groupsMap[row] = [];
          }
          groupsMap[row].push(photo);
        });
      });

      // Construct groups, sorting each group's photos by date descending to find the newest
      const groups: BedGroup[] = Object.keys(groupsMap).map((rowStr) => {
        const rowNumber = parseInt(rowStr, 10);
        const groupPhotos = groupsMap[rowNumber];
        
        groupPhotos.sort((a, b) => {
          const dateA = new Date(a.exif_taken_at || a.uploaded_at).getTime();
          const dateB = new Date(b.exif_taken_at || b.uploaded_at).getTime();
          return dateB - dateA;
        });

        return {
          rowNumber,
          newestPhoto: groupPhotos[0],
          count: groupPhotos.length,
        };
      });

      // Sort groups by bed/row number ascending
      groups.sort((a, b) => a.rowNumber - b.rowNumber);

      setBedGroups(groups);
    } catch (err) {
      console.error('Failed to load garden:', err);
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
      <h1 className="font-heading text-3xl mb-2">Garden Gallery</h1>
      <p className="text-gray-600 mb-6">Take a virtual walk through our rows of growing flower beds.</p>

      {bedGroups.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
          <p className="text-gray-600">No garden beds documented yet.</p>
          <p className="text-sm text-gray-500 mt-2">Check back as we publish growing progress photos of our rows!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {bedGroups.map((group) => (
            <div
              key={group.rowNumber}
              onClick={() => navigate(`/garden/${group.rowNumber}`)}
              className="bg-white rounded-xl shadow overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-100 group"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden">
                <img
                  src={`/api/storage/${group.newestPhoto.storage_key_mobile}`}
                  alt={`Bed #${group.rowNumber}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  style={{ imageOrientation: 'from-image' }}
                />
              </div>
              
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-xl group-hover:text-accent transition-colors">
                    Flower Bed #{group.rowNumber}
                  </h2>
                  <span className="text-xs text-gray-500">{group.count} {group.count === 1 ? 'photo' : 'photos'}</span>
                </div>
                <span className="text-xl text-accent">🌿</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
