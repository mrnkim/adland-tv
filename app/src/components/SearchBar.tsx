'use client';

import { FormEvent, useRef, useState } from 'react';
import ImageUploadModal from './ImageUploadModal';

type SearchBarProps = {
  onSearch: (query: string) => void;
  onImageSearch?: (file: File) => void;
  onImageUrlSearch?: (url: string) => void;
  placeholder?: string;
  defaultValue?: string;
  size?: 'normal' | 'large';
  className?: string;
  isLoading?: boolean;
  isImageSearching?: boolean;
};

export default function SearchBar({
  onSearch,
  onImageSearch,
  onImageUrlSearch,
  placeholder = 'Search ads by description, theme, or style...',
  defaultValue = '',
  size = 'normal',
  className = '',
  isLoading = false,
  isImageSearching = false,
}: SearchBarProps) {
  const isSearching = isLoading || isImageSearching;
  const [inputValue, setInputValue] = useState(defaultValue);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setPreviewImage(null);
      onSearch(inputValue.trim());
    }
  };

  const handleClear = () => {
    setInputValue('');
    setPreviewImage(null);
    searchInputRef.current?.focus();
  };

  const handleImageClick = () => {
    setShowImageModal(true);
  };

  const handleImageSelect = (file: File) => {
    if (onImageSearch) {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      setInputValue('');
      setShowImageModal(false);
      onImageSearch(file);
    }
  };

  const handleImageUrlSubmit = (url: string) => {
    if (onImageUrlSearch) {
      setPreviewImage(url);
      setInputValue('');
      setShowImageModal(false);
      onImageUrlSearch(url);
    } else if (onImageSearch) {
      // Fallback: fetch the image and convert to file
      setPreviewImage(url);
      setInputValue('');
      setShowImageModal(false);
      // For URL, we'll pass to the parent to handle
      fetch(url)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'image.jpg', { type: blob.type });
          onImageSearch(file);
        })
        .catch(console.error);
    }
  };

  const sizeClasses = size === 'large'
    ? 'h-16 text-lg rounded-2xl'
    : 'h-12 text-base rounded-xl';

  return (
    <>
      <form onSubmit={handleSubmit} className={`w-full ${className}`}>
        <div className={`relative flex items-center bg-gray-100 ${sizeClasses} px-4 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white border border-transparent focus-within:border-blue-500 transition-all`}>
          {/* Search Icon */}
          <svg
            className="w-5 h-5 text-gray-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          {/* Image Preview */}
          {previewImage && (
            <div className="relative ml-2 flex-shrink-0">
              <img
                src={previewImage}
                alt="Search image"
                className="h-8 w-8 object-cover rounded"
              />
              <button
                type="button"
                onClick={() => {
                  setPreviewImage(null);
                  handleClear();
                }}
                className="absolute -top-1 -right-1 bg-gray-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-gray-700"
              >
                ×
              </button>
            </div>
          )}

          {/* Input */}
          <input
            ref={searchInputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={previewImage ? 'Searching by image...' : placeholder}
            className="flex-1 bg-transparent border-none outline-none ml-3 text-gray-900 placeholder-gray-500"
            disabled={!!previewImage || isSearching}
          />

          {/* Clear button */}
          {(inputValue || previewImage) && !isSearching && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Image Upload Button */}
          {(onImageSearch || onImageUrlSearch) && (
            <button
              type="button"
              onClick={handleImageClick}
              disabled={isSearching}
              className="ml-2 p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              title="Search by image"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          {/* Search button */}
          <button
            type="submit"
            disabled={isSearching || (!inputValue.trim() && !previewImage)}
            className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Image Upload Modal */}
      <ImageUploadModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onImageSelect={handleImageSelect}
        onUrlSubmit={handleImageUrlSubmit}
        isLoading={isImageSearching}
      />
    </>
  );
}
