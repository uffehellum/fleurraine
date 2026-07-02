import React, { useRef, useState } from 'react';

interface ImageUploadProps {
  onPhotoSelected: (file: File) => void;
  onPhotoUrl?: (url: string) => void;
  label?: string;
  className?: string;
}

export default function ImageUpload({
  onPhotoSelected,
  onPhotoUrl: _onPhotoUrl,
  label = 'Upload Photo',
  className = '',
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await onPhotoSelected(file);
    } catch (err) {
      setError('Failed to process photo');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset so the same file can be selected again
    e.target.value = '';
  };

  // Synchronous click handler — iOS requires input.click() to happen
  // directly within a user gesture, with no async/await before it.
  const handleButtonClick = () => {
    if (uploading) return;
    const input = fileInputRef.current;
    if (!input) return;
    // Reset value before opening the picker so onChange fires reliably
    input.value = '';
    input.click();
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={false}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        // capture is intentionally omitted so iOS shows the
        // "Take Photo / Choose from Library" dialog.
      />
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={uploading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Uploading...
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9a2 2 0 012-2h2l1.5-2h7L17 7h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {label}
          </>
        )}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}