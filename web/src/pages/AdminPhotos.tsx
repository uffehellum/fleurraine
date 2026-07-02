import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from '../components/ImageUpload';

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
  uploaded_by: string;
  uploaded_by_email?: string;
  uploaded_by_name?: string;
  is_review: boolean;
  review_approved?: boolean;
  camera_model?: string;
  detected_location?: string;
  exif_gps_lat?: number;
  exif_gps_lng?: number;
  ai_analysis?: {
    description?: string;
    subjects?: string[];
    confidence?: number;
    category?: string;
  };
  ai_suggestion?: string;
}

export default function AdminPhotos() {
  const { isAdmin } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'reviews'>('all');
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

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
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      let data = await response.json();
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('API response is not an array:', data);
        setPhotos([]);
        return;
      }
      
      // Filter reviews if needed
      if (filter === 'reviews') {
        data = data.filter((p: Photo) => p.is_review);
      }

      setPhotos(data || []);
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

  const handleDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      // Refresh the list
      fetchPhotos();
    } catch (err) {
      alert('Failed to delete photo');
    }
  };

  const handleCategoryChange = async (photoId: string, newCategory: string) => {
    try {
      const response = await fetch(`/api/photos/${photoId}/category`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: newCategory }),
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      // Refresh the list
      fetchPhotos();
    } catch (err) {
      alert('Failed to update category');
    }
  };

  const handleRotate = async (photoId: string, degrees: number) => {
    try {
      const response = await fetch(`/api/photos/${photoId}/edits`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rotation: degrees 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to rotate photo');
      }

      // Refresh the list
      fetchPhotos();
    } catch (err) {
      alert('Failed to rotate photo');
    }
  };

  const handleRerunAI = async (photoId: string) => {
    if (!confirm('Re-run AI classification for this photo? This will update the category suggestion.')) {
      return;
    }

    try {
      const response = await fetch(`/api/photos/${photoId}/reanalyze`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to re-run AI classification');
      }

      // Refresh the list
      fetchPhotos();
      alert('AI classification updated successfully!');
    } catch (err) {
      alert('Failed to re-run AI classification');
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 32MB)
    if (file.size > 32 * 1024 * 1024) {
      alert('Image must be smaller than 32MB');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = 'Upload failed';
        try {
          const data = JSON.parse(text);
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Refresh the photo list
      fetchPhotos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    }
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-3xl">Photo Management</h1>
        
        {/* Upload button — uses ImageUpload for iOS PWA compatibility */}
        <ImageUpload
          onPhotoSelected={handleFileUpload}
          label="Upload"
          className="flex items-center gap-2"
        />
      </div>

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
          Upload
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

      {/* Photos list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">No photos found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {photos?.map((photo) => {
            const isExpanded = expandedPhoto === photo.id;
            return (
              <div key={photo.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Compact row view */}
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail - properly oriented */}
                  <div 
                    className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded overflow-hidden cursor-pointer hover:opacity-90"
                    onClick={() => window.location.href = `/admin/photos/${photo.id}`}
                  >
                    <img
                      src={`/api/storage/${photo.storage_key_thumb}`}
                      alt={photo.flower_name || 'Photo'}
                      className="w-full h-full object-cover"
                      style={{ imageOrientation: 'from-image' }}
                    />
                  </div>

                  {/* Compact info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        photo.category === 'stand' ? 'bg-blue-100 text-blue-800' :
                        photo.category === 'flower_type' ? 'bg-purple-100 text-purple-800' :
                        photo.category === 'garden_row' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {photo.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        photo.status === 'published' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {photo.status}
                      </span>
                    </div>
                    
                    <div className="text-sm space-y-0.5">
                      {photo.exif_taken_at && (
                        <div className="text-gray-900 font-medium">
                          📅 {new Date(photo.exif_taken_at).toLocaleString('en-US', { 
                            timeZone: 'America/Los_Angeles',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                      {photo.detected_location && (
                        <div className="text-gray-700">
                          📍 {photo.detected_location}
                        </div>
                      )}
                      <div className="text-gray-600 text-xs">
                        👤 Uploader: {photo.uploaded_by_name || photo.uploaded_by_email || photo.uploaded_by.substring(0, 8) + '...'}
                      </div>
                    </div>
                  </div>

                  {/* Expand/collapse button */}
                  <button
                    onClick={() => setExpandedPhoto(isExpanded ? null : photo.id)}
                    className="flex-shrink-0 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  >
                    <svg 
                      className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-3">
                    {/* AI Classification */}
                    <div className="bg-white rounded p-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">AI Classification</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">AI Suggestion:</span>
                          <span className="font-medium">{photo.ai_suggestion || 'N/A'}</span>
                        </div>
                        {photo.ai_analysis?.confidence && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Confidence:</span>
                            <span className="font-medium">{(photo.ai_analysis.confidence * 100).toFixed(0)}%</span>
                          </div>
                        )}
                        {photo.ai_analysis?.description && (
                          <div>
                            <span className="text-gray-600">Description:</span>
                            <p className="text-gray-900 mt-1">{photo.ai_analysis.description}</p>
                          </div>
                        )}
                        {photo.ai_analysis?.subjects && photo.ai_analysis.subjects.length > 0 && (
                          <div>
                            <span className="text-gray-600">Detected subjects:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {photo.ai_analysis.subjects.map((subject, i) => (
                                <span key={i} className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                  {subject}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Full Metadata */}
                    <div className="bg-white rounded p-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Full Metadata</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Photo ID:</span>
                          <p className="text-gray-900 font-mono text-xs break-all">{photo.id}</p>
                        </div>
                        {photo.camera_model && (
                          <div>
                            <span className="text-gray-600">Camera:</span>
                            <p className="text-gray-900">{photo.camera_model}</p>
                          </div>
                        )}
                        {photo.exif_gps_lat && photo.exif_gps_lng && (
                          <div className="col-span-2">
                            <span className="text-gray-600">GPS Coordinates:</span>
                            <p className="text-gray-900 font-mono text-xs">
                              {photo.exif_gps_lat.toFixed(6)}, {photo.exif_gps_lng.toFixed(6)}
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Uploaded:</span>
                          <p className="text-gray-900">
                            {new Date(photo.uploaded_at).toLocaleString('en-US', {
                              timeZone: 'America/Los_Angeles',
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </p>
                        </div>
                        {photo.uploaded_by_name && (
                          <div>
                            <span className="text-gray-600">Uploader Name:</span>
                            <p className="text-gray-900">{photo.uploaded_by_name}</p>
                          </div>
                        )}
                        {photo.uploaded_by_email && (
                          <div>
                            <span className="text-gray-600">Uploader Email:</span>
                            <p className="text-gray-900">{photo.uploaded_by_email}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Uploader ID:</span>
                          <p className="text-gray-900 font-mono text-xs break-all">{photo.uploaded_by}</p>
                        </div>
                      </div>
                    </div>

                    {/* Category Override */}
                    {photo.status === 'pending' && !photo.is_review && (
                      <div className="bg-white rounded p-3">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Override Category</h4>
                        <select
                          value={photo.category}
                          onChange={(e) => handleCategoryChange(photo.id, e.target.value)}
                          className="w-full text-sm border rounded px-3 py-2"
                        >
                          <option value="stand">Stand</option>
                          <option value="flower_type">Flower Type</option>
                          <option value="garden_row">Garden Row</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleRotate(photo.id, 90)}
                        className="flex items-center gap-1 px-3 py-2 text-sm bg-white border rounded hover:bg-gray-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Rotate 90°
                      </button>
                      
                      <button
                        onClick={() => handleRerunAI(photo.id)}
                        className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Re-analyze
                      </button>

                      {photo.status === 'pending' && !photo.is_review && (
                        <>
                          <button
                            onClick={() => handlePublish(photo.id)}
                            className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Publish
                          </button>
                          <button
                            onClick={() => handleDelete(photo.id)}
                            className="flex items-center gap-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </>
                      )}

                      {photo.is_review && photo.review_approved === null && (
                        <>
                          <button
                            onClick={() => handleApproveReview(photo.id, true)}
                            className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Approve Review
                          </button>
                          <button
                            onClick={() => handleApproveReview(photo.id, false)}
                            className="flex items-center gap-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Reject Review
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}