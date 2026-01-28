'use client';

import { useState } from 'react';
import { FILTER_OPTIONS, FilterCategory, ActiveFilters } from '@/types';

interface FilterSidebarProps {
  activeFilters: ActiveFilters;
  onFilterChange: (category: string, value: string) => void;
  onClearAll: () => void;
  className?: string;
}

const FILTER_LABELS: Record<FilterCategory, string> = {
  theme: 'Theme',
  emotion: 'Emotion',
  visual_style: 'Visual Style',
  sentiment: 'Sentiment',
  product_category: 'Product Category',
  era_decade: 'Era/Decade',
};

export default function FilterSidebar({
  activeFilters,
  onFilterChange,
  onClearAll,
  className = '',
}: FilterSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['theme', 'emotion', 'product_category'])
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const isFilterActive = (category: string, value: string) => {
    return activeFilters[category]?.includes(value) || false;
  };

  const getActiveCount = (category: string) => {
    return activeFilters[category]?.length || 0;
  };

  const totalActiveFilters = Object.values(activeFilters).reduce(
    (sum, filters) => sum + filters.length,
    0
  );

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Filters</h3>
        {totalActiveFilters > 0 && (
          <button
            onClick={onClearAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all ({totalActiveFilters})
          </button>
        )}
      </div>

      {/* Filter Categories */}
      <div className="space-y-3">
        {(Object.keys(FILTER_OPTIONS) as FilterCategory[]).map((category) => {
          const isExpanded = expandedCategories.has(category);
          const activeCount = getActiveCount(category);

          return (
            <div key={category} className="border-b border-gray-100 pb-3 last:border-0">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <span className="font-medium text-gray-800">
                  {FILTER_LABELS[category]}
                  {activeCount > 0 && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {activeCount}
                    </span>
                  )}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {FILTER_OPTIONS[category].map((value) => {
                    const isActive = isFilterActive(category, value);
                    return (
                      <label
                        key={value}
                        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => onFilterChange(category, value)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-sm ${isActive ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                          {value}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* TwelveLabs CTA */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">
          Powered by TwelveLabs Video AI
        </p>
        <a
          href="https://playground.twelvelabs.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          Try with your own videos
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
