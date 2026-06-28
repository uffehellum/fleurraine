import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
  published_at?: string;
  is_review: boolean;
  review_approved?: boolean;
  camera_model?: string;
  detected_location?: string;
  exif_gps_lat?: number;
  exif_gps_lng?: number;
  exif_metadata?: Record<string, any>;
  ai_analysis?: {
    description?: string;
    subjects?: string[];
    confidence?: number;
    category?: string;
  };
  ai_suggestion?: string;
  perceptual_hash?: string;
  wikipedia_url?: string;
  harvest_season?: string;
  row_number?: number;
  photo_edits?: Record<string, any>;
}

export default function PhotoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'mobile' | 'original' | 'thumbnail'>('mobile');

  useEffect(() => {
    if (id) {
      fetchPhoto();
    }
  }, [id]);

  const fetchPhoto = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/photos/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photo');
      }

      const data = await response.json();
      setPhoto(data);
    } catch (err) {
      setError('Failed to load photo');
      console.error('Failed to fetch photo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!photo) return;
    try {
      const response = await fetch(`/api/photos/${photo.id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to publish photo');
      }

      fetchPhoto();
    } catch (err) {
      alert('Failed to publish photo');
    }
  };

  const handleDelete = async () => {
    if (!photo) return;
    if (!confirm('Are you sure you want to delete this photo? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      navigate('/admin/photos');
    } catch (err) {
      alert('Failed to delete photo');
    }
  };

  const handleReanalyze = async () => {
    if (!photo) return;
    if (!confirm('Re-run AI classification for this photo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/photos/${photo.id}/reanalyze`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to re-analyze photo');
      }

      fetchPhoto();
      alert('AI classification updated successfully!');
    } catch (err) {
      console.error('Re-analyze error:', err);
      alert(`Failed to re-analyze photo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCategoryChange = async (newCategory: string) => {
    if (!photo) return;
    try {
      const response = await fetch(`/api/photos/${photo.id}/category`, {
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

      fetchPhoto();
    } catch (err) {
      alert('Failed to update category');
    }
  };

  const copyShareLink = () => {
    if (!photo?.share_token) return;
    const url = `${window.location.origin}/photos/share/${photo.share_token}`;
    navigator.clipboard.writeText(url);
    alert('Share link copied to clipboard!');
  };

  if (loading) {
    return (
      <main className="p-4 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        </div>
      </main>
    );
  }

  if (error || !photo) {
    return (
      <main className="p-4 max-w-6xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error || 'Photo not found'}
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={copyShareLink}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            📤 Share
          </button>
          {isAdmin && photo.status === 'pending' && (
            <button
              onClick={handlePublish}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image Display */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <img
              src={`/api/storage/${
                viewMode === 'original' ? photo.storage_key_orig :
                viewMode === 'thumbnail' ? photo.storage_key_thumb :
                photo.storage_key_mobile
              }`}
              alt={photo.flower_name || 'Photo'}
              className="w-full h-auto"
              style={{ imageOrientation: 'from-image' }}
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('mobile')}
              className={`flex-1 px-4 py-2 rounded text-center ${
                viewMode === 'mobile'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mobile
            </button>
            <button
              onClick={() => setViewMode('original')}
              className={`flex-1 px-4 py-2 rounded text-center ${
                viewMode === 'original'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setViewMode('thumbnail')}
              className={`flex-1 px-4 py-2 rounded text-center ${
                viewMode === 'thumbnail'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Thumbnail
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4">Photo Information</h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Category</label>
                {isAdmin && photo.status === 'pending' ? (
                  <select
                    value={photo.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full mt-1 border rounded px-3 py-2"
                  >
                    <option value="stand">Stand</option>
                    <option value="bouquet">Bouquet</option>
                    <option value="flower_type">Flower Type</option>
                    <option value="garden_row">Garden Row</option>
                    <option value="other">Other</option>
                  </select>
                ) : (
                  <p className="font-medium">{photo.category}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-gray-600">Status</label>
                <p className={`font-medium ${
                  photo.status === 'published' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {photo.status}
                </p>
              </div>

              {photo.flower_name && (
                <div>
                  <label className="text-sm text-gray-600">Flower Name</label>
                  <p className="font-medium">{photo.flower_name}</p>
                </div>
              )}

              {photo.description && (
                <div>
                  <label className="text-sm text-gray-600">Description</label>
                  <p className="text-gray-900">{photo.description}</p>
                </div>
              )}

              {photo.wikipedia_url && (
                <div>
                  <label className="text-sm text-gray-600">Wikipedia</label>
                  <a
                    href={photo.wikipedia_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline block"
                  >
                    {photo.wikipedia_url}
                  </a>
                </div>
              )}

              {photo.harvest_season && (
                <div>
                  <label className="text-sm text-gray-600">Harvest Season</label>
                  <p className="text-gray-900">{photo.harvest_season}</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Classification */}
          {photo.ai_analysis && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4">AI Classification</h2>
              
              <div className="space-y-3">
                {photo.ai_suggestion && (
                  <div>
                    <label className="text-sm text-gray-600">AI Suggestion</label>
                    <p className="font-medium">{photo.ai_suggestion}</p>
                  </div>
                )}

                {photo.ai_analysis.confidence && (
                  <div>
                    <label className="text-sm text-gray-600">Confidence</label>
                    <p className="font-medium">{(photo.ai_analysis.confidence * 100).toFixed(0)}%</p>
                  </div>
                )}

                {photo.ai_analysis.description && (
                  <div>
                    <label className="text-sm text-gray-600">AI Description</label>
                    <p className="text-gray-900">{photo.ai_analysis.description}</p>
                  </div>
                )}

                {photo.ai_analysis.subjects && photo.ai_analysis.subjects.length > 0 && (
                  <div>
                    <label className="text-sm text-gray-600">Detected Subjects</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {photo.ai_analysis.subjects.map((subject, i) => (
                        <span key={i} className="bg-gray-100 px-2 py-1 rounded text-sm">
                          {subject}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* EXIF Metadata */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4">EXIF Metadata</h2>
            
            <div className="space-y-2 text-sm">
              {photo.exif_taken_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Taken:</span>
                  <span className="font-medium">
                    {new Date(photo.exif_taken_at).toLocaleString('en-US', {
                      timeZone: 'America/Los_Angeles',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
              )}

              {photo.camera_model && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Camera:</span>
                  <span className="font-medium">{photo.camera_model}</span>
                </div>
              )}

              {photo.detected_location && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium">{photo.detected_location}</span>
                </div>
              )}

              {photo.exif_gps_lat && photo.exif_gps_lng && (
                <div className="flex justify-between">
                  <span className="text-gray-600">GPS:</span>
                  <span className="font-mono text-xs">
                    {photo.exif_gps_lat.toFixed(6)}, {photo.exif_gps_lng.toFixed(6)}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Uploaded:</span>
                <span className="font-medium">
                  {new Date(photo.uploaded_at).toLocaleString('en-US', {
                    timeZone: 'America/Los_Angeles',
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </span>
              </div>

              {photo.uploaded_by_name && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Uploaded by:</span>
                  <span className="font-medium">{photo.uploaded_by_name}</span>
                </div>
              )}
              
              {photo.uploaded_by_email && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="text-sm">{photo.uploaded_by_email}</span>
                </div>
              )}

              {photo.published_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Published:</span>
                  <span className="font-medium">
                    {new Date(photo.published_at).toLocaleString('en-US', {
                      timeZone: 'America/Los_Angeles',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Raw EXIF Data */}
            {photo.exif_metadata && Object.keys(photo.exif_metadata).length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  View Raw EXIF Data
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(photo.exif_metadata, null, 2)}
                </pre>
              </details>
            )}
          </div>

          {/* Admin Actions */}
          {isAdmin && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold mb-4">Admin Actions</h2>
              
              <div className="space-y-2">
                <button
                  onClick={handleReanalyze}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  🔄 Re-run AI Classification
                </button>
                
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  🗑️ Delete Photo
                </button>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
                <p className="font-medium mb-1">Photo ID:</p>
                <p className="font-mono break-all">{photo.id}</p>
                {photo.perceptual_hash && (
                  <>
                    <p className="font-medium mt-2 mb-1">Perceptual Hash:</p>
                    <p className="font-mono break-all">{photo.perceptual_hash}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
