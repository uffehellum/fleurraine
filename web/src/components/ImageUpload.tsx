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
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select an image');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      if (isReview) formData.append('is_review', 'true');

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const photo = await response.json();
      
      // Reset form
      setSelectedFile(null);
      setPreview(null);
      
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
        {isReview ? 'Share Your Flowers' : 'Add Photo'}
      </h2>
      <p className="text-gray-600 text-sm mb-6">
        {isReview 
          ? 'Take a photo of your Fleurraine bouquet to share'
          : 'AI will automatically detect and categorize your photo'}
      </p>

      <form onSubmit={handleUpload} className="space-y-4">
        {/* Camera/File input - optimized for mobile */}
        <div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            id="photo-input"
          />
          <label
            htmlFor="photo-input"
            className="flex items-center justify-center gap-3 w-full bg-green-600 text-white py-4 px-6 rounded-lg
              hover:bg-green-700 active:bg-green-800 cursor-pointer font-medium text-lg
              transition-colors shadow-md"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {selectedFile ? 'Change Photo' : 'Take or Upload Photo'}
          </label>
        </div>

        {/* Preview */}
        {preview && (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-auto rounded-lg shadow-md"
            />
            <div className="mt-2 text-sm text-gray-600 text-center">
              ✨ AI will analyze this photo automatically
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Submit button */}
        {selectedFile && (
          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-accent text-white py-4 px-6 rounded-lg
              hover:bg-accent/90 disabled:bg-gray-300 disabled:cursor-not-allowed
              font-medium text-lg transition-colors shadow-md flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Uploading & Analyzing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Photo
              </>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
