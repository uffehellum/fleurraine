import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from '../components/ImageUpload';
import PhotoDisplay from '../components/PhotoDisplay';

interface Photo {
  id: string;
  category: string;
  status: string;
  storage_key_thumb: string;
  storage_key_mobile: string;
  storage_key_orig: string;
  flower_name?: string;
  description?: string;
  share_token?: string;
  exif_taken_at?: string;
  uploaded_at: string;
  is_review: boolean;
  review_approved?: boolean;
  ai_analysis?: {
    description?: string;
    subjects?: string[];
    confidence?: number;
  };
}

export default function AdminPhotos() {
  const { isAdmin } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'reviews'>('all');
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchPhotos();
    }
  }, [isAdmin, filter]);

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      let url = '/api/photos?limit=100';
      
      if (filter === 'pending') {
        url += '&status=pending';
      } else if (filter === 'published') {
        url += '&status=published';
      } else if (filter === 'reviews') {
        url += '&status=pending';
      }

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      let data = await response.json();
      
      // Filter reviews if needed
      if (filter === 'reviews') {
        data = data.filter((p: Photo) => p.is_review);
      }

      setPhotos(data);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (photoId: string) => {
    try {
      const response = await fetch(`/api/photos/${photoId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to publish photo');
      }

      // Refresh the list
      fetchPhotos();
    } catch (err) {
      alert('Failed to publish photo');
    }
  };

  const handleApproveReview = async (photoId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/photos/${photoId}/approve-review`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approved }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve review');
      }

      // Refresh the list
      fetchPhotos();
    } catch (err) {
      alert('Failed to approve review');
    }
  };

  const handleUploadSuccess = () => {
    setShowUpload(false);
    fetchPhotos();
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
      <div className="mb-6 flex justify-between items-center">
        <h1 className="font-heading text-3xl">Photo Management</h1>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
        >
          {showUpload ? 'Hide Upload' : 'Upload Photo'}
        </button>
      </div>

      {/* Upload section */}
      {showUpload && (
        <div className="mb-6">
          <ImageUpload
            onUploadSuccess={handleUploadSuccess}
            showCategorySelect={true}
            showFlowerFields={true}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2 border-b">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium ${
            filter === 'all'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          All Photos
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 font-medium ${
            filter === 'pending'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('published')}
          className={`px-4 py-2 font-medium ${
            filter === 'published'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Published
        </button>
        <button
          onClick={() => setFilter('reviews')}
          className={`px-4 py-2 font-medium ${
            filter === 'reviews'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Reviews
        </button>
      </div>

      {/* Photos grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No photos found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo) => (
            <div key={photo.id} className="space-y-3">
              <PhotoDisplay photo={photo} showDetails={true} />
              
              {/* Admin actions */}
              <div className="bg-white rounded-lg shadow p-3 space-y-2">
                <div className="text-xs text-gray-600">
                  <div>Status: <span className="font-semibold">{photo.status}</span></div>
                  <div>Uploaded: {new Date(photo.uploaded_at).toLocaleDateString()}</div>
                  {photo.ai_analysis?.confidence && (
                    <div>AI Confidence: {(photo.ai_analysis.confidence * 100).toFixed(0)}%</div>
                  )}
                </div>

                {photo.status === 'pending' && !photo.is_review && (
                  <button
                    onClick={() => handlePublish(photo.id)}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md
                      hover:bg-green-700 text-sm font-medium"
                  >
                    Publish
                  </button>
                )}

                {photo.is_review && photo.review_approved === null && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveReview(photo.id, true)}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md
                        hover:bg-green-700 text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproveReview(photo.id, false)}
                      className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md
                        hover:bg-red-700 text-sm font-medium"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {photo.is_review && photo.review_approved !== null && (
                  <div className={`text-sm font-medium text-center py-2 rounded ${
                    photo.review_approved
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {photo.review_approved ? 'Approved' : 'Rejected'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
