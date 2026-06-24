import { useState } from 'react';

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
  camera_model?: string;
  ai_analysis?: {
    description?: string;
    subjects?: string[];
    location?: string;
  };
}

interface PhotoDisplayProps {
  photo: Photo;
  showDetails?: boolean;
  onShare?: () => void;
}

export default function PhotoDisplay({ photo, showDetails = false, onShare }: PhotoDisplayProps) {
  const [showFullSize, setShowFullSize] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  // Generate storage URLs (assuming Tigris public URLs)
  const getImageUrl = (key: string) => {
    // In production, this would use the actual Tigris public URL
    // For now, we'll use a placeholder that the backend should serve
    return `/api/storage/${key}`;
  };

  const handleShare = () => {
    if (photo.share_token) {
      const shareUrl = `${window.location.origin}/share/${photo.share_token}`;
      
      if (navigator.share) {
        navigator.share({
          title: photo.flower_name || 'Fleurraine Photo',
          text: photo.description || 'Check out this photo from Fleurraine',
          url: shareUrl,
        }).catch(() => {
          // Fallback to clipboard
          copyToClipboard(shareUrl);
        });
      } else {
        copyToClipboard(shareUrl);
      }
    }
    
    if (onShare) {
      onShare();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Share link copied to clipboard!');
    });
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Image */}
      <div className="relative">
        <img
          src={getImageUrl(photo.storage_key_mobile)}
          alt={photo.flower_name || 'Photo'}
          className="w-full h-auto cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => setShowFullSize(true)}
        />
        
        {/* Category badge */}
        <div className="absolute top-2 left-2">
          <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
            {photo.category}
          </span>
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="p-4 space-y-3">
          {photo.flower_name && (
            <h3 className="font-heading text-lg font-semibold">
              {photo.flower_name}
            </h3>
          )}

          {photo.description && (
            <p className="text-gray-700 text-sm">{photo.description}</p>
          )}

          {photo.ai_analysis?.description && (
            <p className="text-gray-600 text-sm italic">
              AI: {photo.ai_analysis.description}
            </p>
          )}

          {photo.ai_analysis?.subjects && photo.ai_analysis.subjects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photo.ai_analysis.subjects.map((subject, idx) => (
                <span
                  key={idx}
                  className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                >
                  {subject}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleShare}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md
                hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Share
            </button>
            
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md
                hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              {showMetadata ? 'Hide' : 'Show'} Details
            </button>
          </div>

          {/* Metadata */}
          {showMetadata && (
            <div className="bg-gray-50 p-3 rounded-md text-xs space-y-1">
              {photo.exif_taken_at && (
                <div>
                  <span className="font-semibold">Taken:</span>{' '}
                  {new Date(photo.exif_taken_at).toLocaleString()}
                </div>
              )}
              {photo.camera_model && (
                <div>
                  <span className="font-semibold">Camera:</span> {photo.camera_model}
                </div>
              )}
              {photo.ai_analysis?.location && (
                <div>
                  <span className="font-semibold">Location:</span> {photo.ai_analysis.location}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full-size modal */}
      {showFullSize && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFullSize(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <img
              src={getImageUrl(photo.storage_key_orig)}
              alt={photo.flower_name || 'Photo'}
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setShowFullSize(false)}
              className="absolute top-4 right-4 bg-white text-gray-800 rounded-full p-2
                hover:bg-gray-100 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
