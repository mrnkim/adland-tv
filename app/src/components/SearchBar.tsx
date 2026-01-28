'use client';

import { FormEvent, useRef, useState } from 'react';

type SearchBarProps = {
  onSearch: (query: string) => void;
  placeholder?: string;
  defaultValue?: string;
  size?: 'normal' | 'large';
  className?: string;
};

export default function SearchBar({
  onSearch,
  placeholder = 'Search ads by description, theme, or style...',
  defaultValue = '',
  size = 'normal',
  className = '',
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSearch(inputValue.trim());
    }
  };

  const handleClear = () => {
    setInputValue('');
    searchInputRef.current?.focus();
  };

  const sizeClasses = size === 'large'
    ? 'h-16 text-lg rounded-2xl'
    : 'h-12 text-base rounded-xl';

  return (
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

        {/* Input */}
        <input
          ref={searchInputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none ml-3 text-gray-900 placeholder-gray-500"
        />

        {/* Clear button */}
        {inputValue && (
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

        {/* Search button */}
        <button
          type="submit"
          className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  );
}
