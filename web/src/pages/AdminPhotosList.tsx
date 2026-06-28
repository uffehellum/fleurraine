import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Photo {
  id: string;
  category: string;
  status: string;
  storage_key_thumb: string;
  exif_taken_at?: string;
  uploaded_at: string;
  uploaded_by: string;
  detected_location?: string;
  exif_gps_lat?: number;
  exif_gps_lng?: number;
  camera_model?: string;
  flower_name?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function AdminPhotosList() {
  const { isAdmin } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');

  useEffect(() => {
    if (isAdmin) {
      fetchPhotos();
    }
  }, [isAdmin, filter]);

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/photos?limit=200', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      let data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error('API response is not an array:', data);
        setPhotos([]);
        return;
      }

      // Filter by date if needed
      const now = new Date();
      if (filter === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        data = data.filter((p: Photo) => new Date(p.uploaded_at) >= todayStart);
      } else if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        data = data.filter((p: Photo) => new Date(p.uploaded_at) >= weekAgo);
      }

      setPhotos(data || []);

      // Fetch user details for unique uploaders
      const uniqueUserIds = [...new Set(data.map((p: Photo) => p.uploaded_by))] as string[];
      const userMap = new Map<string, User>();
      
      // In a real implementation, you'd fetch user details from an API
      // For now, we'll just store the user IDs
      uniqueUserIds.forEach((id) => {
        userMap.set(id, { id, name: 'User', email: '' });
      });
      
      setUsers(userMap);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatLocation = (photo: Photo) => {
    if (photo.detected_location) {
      return photo.detected_location;
    }
    if (photo.exif_gps_lat && photo.exif_gps_lng) {
      return `${photo.exif_gps_lat.toFixed(4)}, ${photo.exif_gps_lng.toFixed(4)}`;
    }
    return 'No location';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!isAdmin) {
    return (
      <main className="p-4">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          Admin access required
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-3xl mb-4">Recent Photos</h1>
        
        {/* Filter tabs */}
        <div className="flex gap-2 border-b mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-medium ${
              filter === 'all'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('today')}
            className={`px-4 py-2 font-medium ${
              filter === 'today'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('week')}
            className={`px-4 py-2 font-medium ${
              filter === 'week'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            This Week
          </button>
        </div>
      </div>

      {/* Compact photo list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No photos found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Photo
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Taken
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploader
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {photos.map((photo) => (
                  <tr key={photo.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={`/api/storage/${photo.storage_key_thumb}`}
                          alt={photo.flower_name || 'Photo'}
                          className="h-12 w-12 rounded object-cover"
                          style={{ 
                            imageOrientation: 'from-image',
                            transform: 'rotate(0deg)' 
                          }}
                        />
                        {photo.flower_name && (
                          <span className="ml-3 text-sm text-gray-900">{photo.flower_name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        photo.category === 'stand' ? 'bg-blue-100 text-blue-800' :
                        photo.category === 'bouquet' ? 'bg-pink-100 text-pink-800' :
                        photo.category === 'flower_type' ? 'bg-purple-100 text-purple-800' :
                        photo.category === 'garden_row' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {photo.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                      {photo.exif_taken_at ? formatTime(photo.exif_taken_at) : formatTime(photo.uploaded_at)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={formatLocation(photo)}>
                        {formatLocation(photo)}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-700 font-medium text-xs">
                            {users.get(photo.uploaded_by)?.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="ml-2">
                          <div className="text-sm font-medium text-gray-900">
                            {users.get(photo.uploaded_by)?.name || 'Unknown'}
                          </div>
                          {photo.camera_model && (
                            <div className="text-xs text-gray-500 truncate max-w-[120px]" title={photo.camera_model}>
                              {photo.camera_model}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        photo.status === 'published' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {photo.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
