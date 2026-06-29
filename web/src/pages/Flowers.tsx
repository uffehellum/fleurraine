import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Photo {
  id: string;
  category: string;
  storage_key_thumb: string;
  storage_key_mobile: string;
  flower_name?: string;
  flower_names?: string[];
  uploaded_at: string;
  exif_taken_at?: string;
}

interface FlowerGroup {
  name: string;
  newestPhoto: Photo;
  count: number;
}

export default function Flowers() {
  const [flowerGroups, setFlowerGroups] = useState<FlowerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFlowers();
  }, []);

  const fetchFlowers = async () => {
    try {
      const response = await fetch('/api/photos?category=flower_type&status=published', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      const photos: Photo[] = await response.json();

      // Group photos by each name in flower_names array (or fall back to single flower_name)
      const groupsMap: Record<string, Photo[]> = {};

      photos.forEach((photo) => {
        const names = photo.flower_names && photo.flower_names.length > 0 
          ? photo.flower_names 
          : (photo.flower_name ? [photo.flower_name] : []);

        names.forEach((name) => {
          const normalized = name.trim();
          if (normalized === '') return;
          if (!groupsMap[normalized]) {
            groupsMap[normalized] = [];
          }
          groupsMap[normalized].push(photo);
        });
      });

      // Construct groups, sorting each group's photos by date descending to find the newest
      const groups: FlowerGroup[] = Object.keys(groupsMap).map((name) => {
        const groupPhotos = groupsMap[name];
        // Sort by capture/upload date descending
        groupPhotos.sort((a, b) => {
          const dateA = new Date(a.exif_taken_at || a.uploaded_at).getTime();
          const dateB = new Date(b.exif_taken_at || b.uploaded_at).getTime();
          return dateB - dateA;
        });

        return {
          name,
          newestPhoto: groupPhotos[0],
          count: groupPhotos.length,
        };
      });

      // Sort flower groups alphabetically by name
      groups.sort((a, b) => a.name.localeCompare(b.name));

      setFlowerGroups(groups);
    } catch (err) {
      console.error('Failed to load flowers:', err);
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
      <h1 className="font-heading text-3xl mb-2">Flower Gallery</h1>
      <p className="text-gray-600 mb-6">Explore the beautiful flower varieties grown and arranged in our beds.</p>

      {flowerGroups.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
          <p className="text-gray-600">No flower types documented yet.</p>
          <p className="text-sm text-gray-500 mt-2">Check back as our flower harvest season progresses!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {flowerGroups.map((group) => (
            <div
              key={group.name}
              onClick={() => navigate(`/flowers/${encodeURIComponent(group.name)}`)}
              className="bg-white rounded-xl shadow overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-100 group"
            >
              <div className="aspect-square bg-gray-100 overflow-hidden">
                <img
                  src={`/api/storage/${group.newestPhoto.storage_key_mobile}`}
                  alt={group.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  style={{ imageOrientation: 'from-image' }}
                />
              </div>
              
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-xl group-hover:text-accent transition-colors">
                    {group.name}
                  </h2>
                  <span className="text-xs text-gray-500">{group.count} {group.count === 1 ? 'photo' : 'photos'}</span>
                </div>
                <span className="text-xl text-accent">🌸</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
