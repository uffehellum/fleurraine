import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  bouquet_number?: number;
  price_cents?: number;
  row_numbers?: number[];
  flower_names?: string[];
}

export default function PhotoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'mobile' | 'original' | 'thumbnail'>('mobile');

  // Admin edit form states
  const [editMode, setEditMode] = useState(false);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [bouquetNumber, setBouquetNumber] = useState<number | ''>('');
  const [price, setPrice] = useState<string>('');
  const [flowerNamesStr, setFlowerNamesStr] = useState('');
  const [rowNumbersStr, setRowNumbersStr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPhoto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      // Initialize edit states
      setCategory(data.category || 'other');
      setDescription(data.description || '');
      setBouquetNumber(data.bouquet_number ?? '');
      setPrice(data.price_cents ? (data.price_cents / 100).toFixed(2) : '');
      setFlowerNamesStr(data.flower_names ? data.flower_names.join(', ') : (data.flower_name ? data.flower_name : ''));
      setRowNumbersStr(data.row_numbers ? data.row_numbers.join(', ') : (data.row_number ? String(data.row_number) : ''));
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

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) return;

    setSaving(true);
    try {
      // Parse flower names array
      const flowerNames = flowerNamesStr
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f !== '');

      // Parse bed/row numbers array of integers
      const rowNumbers = rowNumbersStr
        .split(',')
        .map((r) => parseInt(r.trim(), 10))
        .filter((r) => !isNaN(r));

      // Parse price cents
      const priceCents = price ? Math.round(parseFloat(price) * 100) : null;

      const response = await fetch(`/api/photos/${photo.id}/metadata`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          bouquet_number: bouquetNumber === '' ? null : Number(bouquetNumber),
          price_cents: priceCents,
          flower_names: flowerNames,
          row_numbers: rowNumbers,
          description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update metadata');
      }

      alert('Metadata updated successfully!');
      setEditMode(false);
      fetchPhoto();
    } catch (err) {
      console.error('Failed to update metadata:', err);
      alert(err instanceof Error ? err.message : 'Failed to update metadata');
    } finally {
      setSaving(false);
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
      {/* Contextual Hierarchical Navigation Links */}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-900 pr-3 border-r border-gray-300"
        >
          ← Back
        </button>

        {photo.category === 'flower_type' && (
          <>
            {photo.flower_names && photo.flower_names.length > 0 ? (
              photo.flower_names.map((flower) => (
                <Link
                  key={flower}
                  to={`/flowers/${encodeURIComponent(flower)}`}
                  className="text-green-700 hover:underline bg-green-50 px-2 py-0.5 rounded border border-green-200"
                >
                  🌸 Flower: {flower}
                </Link>
              ))
            ) : photo.flower_name ? (
              <Link
                to={`/flowers/${encodeURIComponent(photo.flower_name)}`}
                className="text-green-700 hover:underline bg-green-50 px-2 py-0.5 rounded border border-green-200"
              >
                🌸 Flower: {photo.flower_name}
              </Link>
            ) : null}
            <Link to="/flowers" className="text-gray-500 hover:underline px-2 py-0.5">
              All Flowers
            </Link>
          </>
        )}

        {photo.category === 'garden_row' && (
          <>
            {photo.row_numbers && photo.row_numbers.length > 0 ? (
              photo.row_numbers.map((row) => (
                <Link
                  key={row}
                  to={`/garden/${row}`}
                  className="text-green-700 hover:underline bg-green-50 px-2 py-0.5 rounded border border-green-200"
                >
                  🌿 Bed #{row}
                </Link>
              ))
            ) : photo.row_number ? (
              <Link
                to={`/garden/${photo.row_number}`}
                className="text-green-700 hover:underline bg-green-50 px-2 py-0.5 rounded border border-green-200"
              >
                🌿 Bed #{photo.row_number}
              </Link>
            ) : null}
            <Link to="/garden" className="text-gray-500 hover:underline px-2 py-0.5">
              All Beds
            </Link>
          </>
        )}

        {photo.category === 'bouquet' && (
          <Link
            to="/bouquets"
            className="text-green-700 hover:underline bg-green-50 px-2 py-0.5 rounded border border-green-200"
          >
            💐 Bouquet Gallery
          </Link>
        )}

        {photo.category === 'stand' && (
          <Link
            to="/stand-history"
            className="text-green-700 hover:underline bg-green-50 px-2 py-0.5 rounded border border-green-200"
          >
            🏠 Stand History
          </Link>
        )}
      </div>

      {/* Action Bar */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl truncate">
          {photo.category === 'bouquet' && photo.bouquet_number ? `Bouquet #${photo.bouquet_number}` : (photo.flower_name || 'Photo Details')}
        </h1>
        
        <div className="flex gap-2">
          <button
            onClick={copyShareLink}
            className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-1"
          >
            📤 Copy Link
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90"
              >
                {editMode ? 'Cancel Edit' : '✏️ Edit Metadata'}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                🗑️ Delete
              </button>
            </div>
          )}
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
              className={`flex-1 px-4 py-2 rounded text-center text-sm ${
                viewMode === 'mobile'
                  ? 'bg-green-600 text-white font-medium'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mobile
            </button>
            <button
              onClick={() => setViewMode('original')}
              className={`flex-1 px-4 py-2 rounded text-center text-sm ${
                viewMode === 'original'
                  ? 'bg-green-600 text-white font-medium'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setViewMode('thumbnail')}
              className={`flex-1 px-4 py-2 rounded text-center text-sm ${
                viewMode === 'thumbnail'
                  ? 'bg-green-600 text-white font-medium'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Thumbnail
            </button>
          </div>
        </div>

        {/* Info or Edit Panel */}
        <div className="space-y-4">
          {editMode && isAdmin ? (
            /* ADMIN METADATA EDIT CARD */
            <div className="bg-white rounded-lg shadow p-6 border border-accent/25">
              <h2 className="text-xl font-heading text-accent mb-4">Fix AI Recognized Attributes</h2>
              
              <form onSubmit={handleSaveMetadata} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  >
                    <option value="stand">Stand</option>
                    <option value="bouquet">Bouquet</option>
                    <option value="flower_type">Flower Type</option>
                    <option value="garden_row">Garden Row</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {category === 'bouquet' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bouquet # (Sticker)</label>
                      <input
                        type="number"
                        value={bouquetNumber}
                        onChange={(e) => setBouquetNumber(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="e.g. 1024"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price ($ USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="e.g. 15.00"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Flower Name(s)</label>
                  <input
                    type="text"
                    value={flowerNamesStr}
                    onChange={(e) => setFlowerNamesStr(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    placeholder="e.g. Roses, Lilies, Eucalyptus"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate multiple flowers with commas. AI detected flowers will populate here by default.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bed Number(s)</label>
                  <input
                    type="text"
                    value={rowNumbersStr}
                    onChange={(e) => setRowNumbersStr(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    placeholder="e.g. 3, 4"
                  />
                  <p className="text-xs text-gray-500 mt-1">Specify multiple beds if the picture covers more than one bed row.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                    placeholder="Tell us about these flowers..."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium shadow"
                  >
                    {saving ? 'Saving...' : '💾 Save Attributes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* PHOTO DETAILS CARD */
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Photo Information</h2>
              
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-gray-500 block uppercase tracking-wider">Category</span>
                  <span className="font-semibold text-lg capitalize">{photo.category}</span>
                </div>

                <div>
                  <span className="text-xs text-gray-500 block uppercase tracking-wider">Status</span>
                  <span className={`font-semibold ${
                    photo.status === 'published' ? 'text-green-600' : 'text-yellow-600'
                  } capitalize`}>
                    {photo.status}
                  </span>
                </div>

                {photo.category === 'bouquet' && photo.bouquet_number && (
                  <div className="grid grid-cols-2 gap-4 bg-green-50/50 p-3 rounded-lg border border-green-100">
                    <div>
                      <span className="text-xs text-gray-500 block uppercase tracking-wider">Bouquet #</span>
                      <span className="font-bold text-xl text-gray-900">#{photo.bouquet_number}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block uppercase tracking-wider">Price</span>
                      <span className="font-bold text-xl text-green-700">
                        ${photo.price_cents ? (photo.price_cents / 100).toFixed(2) : '15.00'}
                      </span>
                    </div>
                  </div>
                )}

                {photo.flower_names && photo.flower_names.length > 0 ? (
                  <div>
                    <span className="text-xs text-gray-500 block uppercase tracking-wider mb-1">Flowers Represented</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {photo.flower_names.map((flower) => (
                        <Link
                          key={flower}
                          to={`/flowers/${encodeURIComponent(flower)}`}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1 rounded-full text-sm font-medium"
                        >
                          {flower}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : photo.flower_name ? (
                  <div>
                    <span className="text-xs text-gray-500 block uppercase tracking-wider">Flower Type</span>
                    <Link
                      to={`/flowers/${encodeURIComponent(photo.flower_name)}`}
                      className="text-blue-600 hover:underline font-medium text-lg block mt-0.5"
                    >
                      {photo.flower_name}
                    </Link>
                  </div>
                ) : null}

                {photo.row_numbers && photo.row_numbers.length > 0 ? (
                  <div>
                    <span className="text-xs text-gray-500 block uppercase tracking-wider mb-1">Flower Bed(s)</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {photo.row_numbers.map((row) => (
                        <Link
                          key={row}
                          to={`/garden/${row}`}
                          className="bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 px-3 py-1 rounded-full text-sm font-medium"
                        >
                          🌿 Bed #{row}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : photo.row_number ? (
                  <div>
                    <span className="text-xs text-gray-500 block uppercase tracking-wider">Flower Bed Row</span>
                    <Link
                      to={`/garden/${photo.row_number}`}
                      className="text-blue-600 hover:underline font-medium text-lg block mt-0.5"
                    >
                      Bed #{photo.row_number}
                    </Link>
                  </div>
                ) : null}

                {photo.description && (
                  <div>
                    <span className="text-xs text-gray-500 block uppercase tracking-wider">Description</span>
                    <p className="text-gray-700 mt-1">{photo.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Classification Info (read-only for context) */}
          {photo.ai_analysis && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-3">AI Diagnostic Notes</h2>
              
              <div className="space-y-3 text-sm">
                {photo.ai_suggestion && (
                  <div>
                    <span className="text-gray-500 block">AI Category Suggestion</span>
                    <p className="font-medium capitalize">{photo.ai_suggestion}</p>
                  </div>
                )}

                {photo.ai_analysis.confidence && (
                  <div>
                    <span className="text-gray-500 block">Confidence Score</span>
                    <p className="font-medium">{(photo.ai_analysis.confidence * 100).toFixed(0)}%</p>
                  </div>
                )}

                {photo.ai_analysis.description && (
                  <div>
                    <span className="text-gray-500 block">AI Content Summary</span>
                    <p className="text-gray-600 mt-0.5">{photo.ai_analysis.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* EXIF Metadata Card */}
          <div className="bg-white rounded-lg shadow p-6 text-sm">
            <h2 className="text-lg font-semibold mb-3">Camera & File Details</h2>
            
            <div className="space-y-2 text-gray-600">
              {photo.exif_taken_at && (
                <div className="flex justify-between">
                  <span>Photo Date:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(photo.exif_taken_at).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
              )}

              {photo.camera_model && (
                <div className="flex justify-between">
                  <span>Camera Model:</span>
                  <span className="font-medium text-gray-900">{photo.camera_model}</span>
                </div>
              )}

              {photo.detected_location && (
                <div className="flex justify-between">
                  <span>Detected Location:</span>
                  <span className="font-medium text-gray-900">{photo.detected_location}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Upload Date:</span>
                <span className="font-medium text-gray-900">
                  {new Date(photo.uploaded_at).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
