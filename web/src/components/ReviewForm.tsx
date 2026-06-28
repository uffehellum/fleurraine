import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ReviewFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ReviewForm({ onSuccess, onCancel }: ReviewFormProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [daysSincePurchase, setDaysSincePurchase] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reviewText.trim() && !selectedFile) {
      alert('Please provide either a review text or a photo');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      
      if (selectedFile) {
        formData.append('image', selectedFile);
      }
      
      formData.append('is_review', 'true');
      formData.append('description', reviewText);
      
      if (daysSincePurchase) {
        formData.append('freshness_days', daysSincePurchase);
      }

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      alert('Thank you for your review! It will be visible to you immediately and to others after admin approval.');
      
      // Reset form
      setReviewText('');
      setDaysSincePurchase('');
      setSelectedFile(null);
      setPreviewUrl(null);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Review submission failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">Please sign in to submit a review.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-2xl">Submit a Review</h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Review Text */}
        <div>
          <label htmlFor="reviewText" className="block text-sm font-medium text-gray-700 mb-1">
            Your Review
          </label>
          <textarea
            id="reviewText"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Tell us about your experience with our flowers..."
          />
        </div>

        {/* Days Since Purchase */}
        <div>
          <label htmlFor="daysSincePurchase" className="block text-sm font-medium text-gray-700 mb-1">
            Days Since Purchase (Optional)
          </label>
          <input
            type="number"
            id="daysSincePurchase"
            value={daysSincePurchase}
            onChange={(e) => setDaysSincePurchase(e.target.value)}
            min="0"
            max="30"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="How many days have your flowers lasted?"
          />
          <p className="text-xs text-gray-500 mt-1">
            Help others know how long the flowers stayed fresh
          </p>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photo of Your Flowers (Optional)
          </label>
          
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-64 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PNG, JPG, HEIC up to 10MB</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
            </label>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Share a photo of your Fleurraine flowers! Only photos of fresh-cut flowers will be accepted.
          </p>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={uploading || (!reviewText.trim() && !selectedFile)}
            className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700
              disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg shadow-md
              flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Submit Review
              </>
            )}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center">
          Your review will be visible to you immediately. After admin approval, it will be shown to other visitors.
        </p>
      </form>
    </div>
  );
}
