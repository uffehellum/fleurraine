import { useState } from 'react';

interface ImageUploadProps {
  onUploadSuccess?: (photo: any) => void;
  category?: string;
  isReview?: boolean;
  showCategorySelect?: boolean;
  showFlowerFields?: boolean;
}

export default function ImageUpload({
  onUploadSuccess,
  category = '',
  isReview = false,
  showCategorySelect = false,
  showFlowerFields = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Form fields
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [flowerName, setFlowerName] = useState('');
  const [wikipediaUrl, setWikipediaUrl] = useState('');
  const [harvestSeason, setHarvestSeason] = useState('');
  const [rowNumber, setRowNumber] = useState('');
  const [description, setDescription] = useState('');

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
      
      if (selectedCategory) formData.append('category', selectedCategory);
      if (flowerName) formData.append('flower_name', flowerName);
      if (wikipediaUrl) formData.append('wikipedia_url', wikipediaUrl);
      if (harvestSeason) formData.append('harvest_season', harvestSeason);
      if (rowNumber) formData.append('row_number', rowNumber);
      if (description) formData.append('description', description);
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
      setFlowerName('');
      setWikipediaUrl('');
      setHarvestSeason('');
      setRowNumber('');
      setDescription('');
      
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
      <h2 className="font-heading text-xl mb-4">
        {isReview ? 'Upload Review Photo' : 'Upload Photo'}
      </h2>

      <form onSubmit={handleUpload} className="space-y-4">
        {/* File input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-green-50 file:text-green-700
              hover:file:bg-green-100"
          />
        </div>

        {/* Preview */}
        {preview && (
          <div className="mt-4">
            <img
              src={preview}
              alt="Preview"
              className="max-w-full h-auto max-h-64 rounded-lg"
            />
          </div>
        )}

        {/* Category select (for admins) */}
        {showCategorySelect && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Auto-detect with AI</option>
              <option value="stand">Flower Stand</option>
              <option value="bouquet">Bouquet</option>
              <option value="flower_type">Flower Type</option>
              <option value="garden_row">Garden Row</option>
            </select>
          </div>
        )}

        {/* Flower catalog fields */}
        {showFlowerFields && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                Flower Name
              </label>
              <input
                type="text"
                value={flowerName}
                onChange={(e) => setFlowerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., Sunflower"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Wikipedia URL
              </label>
              <input
                type="url"
                value={wikipediaUrl}
                onChange={(e) => setWikipediaUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://en.wikipedia.org/wiki/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Harvest Season
              </label>
              <input
                type="text"
                value={harvestSeason}
                onChange={(e) => setHarvestSeason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., Spring, Summer"
              />
            </div>
          </>
        )}

        {/* Row number (for garden rows) */}
        {selectedCategory === 'garden_row' && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Row Number
            </label>
            <input
              type="number"
              value={rowNumber}
              onChange={(e) => setRowNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              min="1"
            />
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={3}
            placeholder="Add a description..."
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!selectedFile || uploading}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md
            hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed
            font-medium transition-colors"
        >
          {uploading ? 'Uploading...' : 'Upload Photo'}
        </button>
      </form>
    </div>
  );
}
