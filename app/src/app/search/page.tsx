'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import SearchBar from '@/components/SearchBar';
import VideoCard from '@/components/VideoCard';
import VideoModal from '@/components/VideoModal';
import FilterSidebar from '@/components/FilterSidebar';
import LoadingSpinner from '@/components/LoadingSpinner';
import { SearchResult, ActiveFilters, VideoData } from '@/types';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialCollection = searchParams.get('collection') || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery || initialCategory);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [selectedVideo, setSelectedVideo] = useState<SearchResult | VideoData | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // Collection name mapping (must match page.tsx COLLECTIONS)
  const collectionNames: Record<string, string> = {
    superbowl: 'Super Bowl LX',
    'award-winners': 'Award Winners',
    classics: '90s Nostalgia',
  };

  // Set initial filter from URL
  useEffect(() => {
    if (initialCategory) {
      setActiveFilters({ product_category: [initialCategory] });
      setSubmittedQuery(initialCategory);
    }
  }, [initialCategory]);

  // Collection query - fetch videos by metadata filter
  const { data: collectionData, isLoading: collectionLoading, error: collectionError } = useQuery({
    queryKey: ['collection', initialCollection],
    queryFn: async () => {
      const response = await fetch(`/api/videos?collection=${encodeURIComponent(initialCollection)}&pageLimit=50`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch collection');
      }
      return response.json();
    },
    enabled: !!initialCollection,
  });

  // Search query - semantic search via TwelveLabs
  const { data: searchData, isLoading: searchLoading, error: searchError } = useQuery({
    queryKey: ['search', submittedQuery, activeFilters],
    queryFn: async () => {
      if (!submittedQuery) return { results: [], pageInfo: { total_results: 0 } };

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: submittedQuery,
          filters: activeFilters,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Search failed');
      }

      return response.json();
    },
    enabled: !!submittedQuery && !initialCollection,
  });

  // Determine which data to use
  const isCollectionMode = !!initialCollection;
  const data = isCollectionMode ? collectionData : searchData;
  const isLoading = isCollectionMode ? collectionLoading : searchLoading;
  const error = isCollectionMode ? collectionError : searchError;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSubmittedQuery(query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleFilterChange = (category: string, value: string) => {
    setActiveFilters((prev) => {
      const current = prev[category] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      if (updated.length === 0) {
        const { [category]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [category]: updated };
    });
  };

  const handleClearFilters = () => {
    setActiveFilters({});
  };

  const handleVideoClick = (video: SearchResult | VideoData) => {
    setSelectedVideo(video);
  };

  // Type guard to check if video is SearchResult
  const isSearchResult = (video: SearchResult | VideoData): video is SearchResult => {
    return 'video_id' in video;
  };

  // Helper to get video properties from either type
  const getVideoUrl = (video: SearchResult | VideoData | null) => {
    if (!video) return undefined;
    if (isSearchResult(video)) return video.video_url;
    return video.hls?.video_url;
  };

  const getVideoTitle = (video: SearchResult | VideoData | null) => {
    if (!video) return undefined;
    if (isSearchResult(video)) return video.video_title || video.metadata?.title;
    return video.user_metadata?.title || video.system_metadata?.video_title;
  };

  const getVideoMetadata = (video: SearchResult | VideoData | null) => {
    if (!video) return undefined;
    if (isSearchResult(video)) return video.metadata;
    return video.user_metadata;
  };

  // Helper to get clip start/end times (only for SearchResult)
  const getClipStartTime = (video: SearchResult | VideoData | null) => {
    if (!video || !isSearchResult(video)) return undefined;
    return video.start;
  };

  const getClipEndTime = (video: SearchResult | VideoData | null) => {
    if (!video || !isSearchResult(video)) return undefined;
    return video.end;
  };

  // Get results - collection returns 'videos', search returns 'results'
  const results = isCollectionMode ? (data?.videos || []) : (data?.results || []);
  const totalResults = data?.pageInfo?.total_results ?? results.length;
  const displayTitle = isCollectionMode
    ? collectionNames[initialCollection] || initialCollection
    : submittedQuery;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white border-b border-gray-200 py-4 px-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <SearchBar
            onSearch={handleSearch}
            defaultValue={searchQuery}
            placeholder="Search ads by description, theme, or style..."
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar - Desktop */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <FilterSidebar
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
              onClearAll={handleClearFilters}
              className="sticky top-24"
            />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                {(submittedQuery || isCollectionMode) && (
                  <h1 className="text-xl font-semibold text-gray-900">
                    {isLoading ? (
                      isCollectionMode ? 'Loading collection...' : 'Searching...'
                    ) : (
                      <>
                        {totalResults.toLocaleString()} {isCollectionMode ? 'videos in' : 'results for'} &quot;{displayTitle}&quot;
                      </>
                    )}
                  </h1>
                )}
              </div>
              <div className="flex items-center gap-4">
                {/* Mobile filter toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                </button>
                <select className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
                  <option>Sort: Relevance</option>
                  <option>Sort: Newest</option>
                  <option>Sort: Oldest</option>
                </select>
              </div>
            </div>

            {/* Mobile Filters */}
            {showFilters && (
              <div className="lg:hidden mb-6">
                <FilterSidebar
                  activeFilters={activeFilters}
                  onFilterChange={handleFilterChange}
                  onClearAll={handleClearFilters}
                />
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-gray-500">Searching videos...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600 font-medium">
                  {error instanceof Error ? error.message : 'Search failed'}
                </p>
                <button
                  onClick={() => setSubmittedQuery(submittedQuery)}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && (submittedQuery || isCollectionMode) && results.length === 0 && (
              <div className="text-center py-20">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {isCollectionMode ? 'No videos in this collection' : 'No results found'}
                </h2>
                <p className="text-gray-500 mb-4">
                  {isCollectionMode
                    ? 'This collection doesn\'t have any videos yet'
                    : 'Try adjusting your search or filters to find what you\'re looking for'}
                </p>
                {!isCollectionMode && (
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {/* No Query State */}
            {!submittedQuery && !isCollectionMode && (
              <div className="text-center py-20">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Start searching</h2>
                <p className="text-gray-500">
                  Enter a search query above to find TV advertisements
                </p>
              </div>
            )}

            {/* Results Grid */}
            {!isLoading && results.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((result: SearchResult | VideoData, index: number) => (
                  <VideoCard
                    key={`${'video_id' in result ? result.video_id : result._id}-${index}`}
                    video={result}
                    onClick={() => handleVideoClick(result)}
                    showScore={!isCollectionMode}
                  />
                ))}
              </div>
            )}

            {/* Load More */}
            {results.length > 0 && results.length < totalResults && (
              <div className="mt-8 text-center">
                <button className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Load More Results
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      <VideoModal
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        videoUrl={getVideoUrl(selectedVideo)}
        title={getVideoTitle(selectedVideo)}
        metadata={getVideoMetadata(selectedVideo)}
        startTime={getClipStartTime(selectedVideo)}
        endTime={getClipEndTime(selectedVideo)}
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
