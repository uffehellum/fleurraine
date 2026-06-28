import { useState } from 'react';

interface ImageUploadProps {
  onUploadSuccess?: (photo: any) => void;
  isReview?: boolean;
}

export default function ImageUpload({
  onUploadSuccess,
  isReview = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 32MB)
    if (file.size > 32 * 1024 * 1024) {
      setError('Image must be smaller than 32MB');
      return;
    }

    setError(null);

    // Auto-upload immediately after file selection
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (isReview) formData.append('is_review', 'true');

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

      const text = await response.text();
      if (!text) {
        throw new Error('Server returned empty response');
      }
      
      const photo = JSON.parse(text);
      
      if (onUploadSuccess) {
        onUploadSuccess(photo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="font-heading text-2xl mb-2">
        {isReview ? 'Share Your Flowers' : 'Upload Photo'}
      </h2>
      <p className="text-gray-600 text-sm mb-6">
        {isReview 
          ? 'Take a photo of your Fleurraine bouquet to share'
          : 'Photo will be uploaded and analyzed automatically'}
      </p>

      <div className="space-y-4">
        {/* Camera/File input - auto-uploads on selection */}
        <div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            id="photo-input"
            disabled={uploading}
          />
          <label
            htmlFor="photo-input"
            className={`flex items-center justify-center gap-3 w-full py-4 px-6 rounded-lg
              font-medium text-lg transition-colors shadow-md ${
                uploading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 cursor-pointer'
              }`}
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading & Analyzing...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Take or Upload Photo
              </>
            )}
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
