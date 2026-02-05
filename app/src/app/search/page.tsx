'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useInfiniteQuery, useMutation } from '@tanstack/react-query';
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
  const [browseCategory, setBrowseCategory] = useState(initialCategory);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [selectedVideo, setSelectedVideo] = useState<SearchResult | VideoData | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [imageSearchMode, setImageSearchMode] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState<SearchResult[] | null>(null);
  const [isImageUrlSearching, setIsImageUrlSearching] = useState(false);

  // Collection name mapping (must match page.tsx COLLECTIONS)
  const collectionNames: Record<string, string> = {
    superbowl: 'Super Bowl LX',
    'award-winners': 'Award Winners',
    classics: '90s Nostalgia',
  };

  // Set initial filter from URL
  useEffect(() => {
    if (initialCategory) {
      setBrowseCategory(initialCategory);
      setActiveFilters({ product_category: [initialCategory] });
    }
  }, [initialCategory]);

  // Browse mode - fetch all videos for browsing/filtering
  const { data: browseData, isLoading: browseLoading, error: browseError } = useQuery({
    queryKey: ['browse', activeFilters],
    queryFn: async () => {
      // Build filter query params
      const params = new URLSearchParams();
      params.set('pageLimit', '100');

      // Add filters as query params
      Object.entries(activeFilters).forEach(([key, values]) => {
        if (values && values.length > 0) {
          params.set(key, values.join(','));
        }
      });

      const response = await fetch(`/api/videos?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch videos');
      }
      return response.json();
    },
    enabled: !submittedQuery && !initialCollection && !imageSearchMode,
  });

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
  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
  } = useInfiniteQuery({
    queryKey: ['search', submittedQuery, activeFilters],
    queryFn: async () => {
      if (!submittedQuery) return { results: [], pageInfo: { total_results: 0 } };

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: submittedQuery,
          filters: activeFilters,
          pageLimit: 50,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Search failed');
      }

      return response.json();
    },
    initialPageParam: undefined,
    getNextPageParam: () => undefined,
    enabled: !!submittedQuery && !initialCollection && !imageSearchMode,
  });

  // Image search mutation
  const imageSearchMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('pageLimit', '50');

      const response = await fetch('/api/search/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Image search failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setImageSearchResults(data.results);
    },
  });

  // Determine which mode we're in
  const isCollectionMode = !!initialCollection;
  const isSearchMode = !!submittedQuery;
  const isBrowseMode = !isCollectionMode && !isSearchMode && !imageSearchMode;

  // Determine which data/loading/error to use based on mode
  const isLoading = isCollectionMode
    ? collectionLoading
    : isSearchMode
      ? searchLoading
      : imageSearchMode
        ? (imageSearchMutation.isPending || isImageUrlSearching)
        : browseLoading;

  const error = isCollectionMode
    ? collectionError
    : isSearchMode
      ? searchError
      : imageSearchMode
        ? imageSearchMutation.error
        : browseError;

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSubmittedQuery(query);
    setImageSearchMode(false);
    setImageSearchResults(null);
    setBrowseCategory(''); // exit category mode when searching
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const handleImageSearch = (file: File) => {
    setImageSearchMode(true);
    setSubmittedQuery('');
    setSearchQuery('');
    imageSearchMutation.mutate(file);
  };

  const handleImageUrlSearch = async (url: string) => {
    setImageSearchMode(true);
    setSubmittedQuery('');
    setSearchQuery('');
    setIsImageUrlSearching(true);

    // Use FormData with imageUrl
    const formData = new FormData();
    formData.append('imageUrl', url);
    formData.append('pageLimit', '50');

    try {
      const response = await fetch('/api/search/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Image search failed');
      }

      const data = await response.json();
      setImageSearchResults(data.results);
    } catch (error) {
      console.error('Image URL search error:', error);
      setImageSearchResults([]);
    } finally {
      setIsImageUrlSearching(false);
    }
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

  const handleClearCategory = (category: string) => {
    setActiveFilters((prev) => {
      const { [category]: _, ...rest } = prev;
      return rest;
    });
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

  // Get results based on current mode
  const searchResults = searchData?.pages?.flatMap((page) => page.results) || [];
  const browseResults = browseData?.videos || [];

  const results = imageSearchMode
    ? (imageSearchResults || [])
    : isCollectionMode
      ? (collectionData?.videos || [])
      : isSearchMode
        ? searchResults
        : browseResults;

  const totalResults = imageSearchMode
    ? (imageSearchResults?.length || 0)
    : isCollectionMode
      ? (collectionData?.pageInfo?.total_results ?? results.length)
      : isSearchMode
        ? (searchData?.pages?.[0]?.pageInfo?.total_results ?? results.length)
        : (browseData?.pageInfo?.total_results ?? results.length);

  const displayTitle = imageSearchMode
    ? 'image'
    : isCollectionMode
      ? collectionNames[initialCollection] || initialCollection
      : submittedQuery;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white border-b border-gray-200 py-4 px-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <SearchBar
            onSearch={handleSearch}
            onImageSearch={handleImageSearch}
            onImageUrlSearch={handleImageUrlSearch}
            defaultValue={searchQuery}
            placeholder="Search ads by description, theme, or style..."
            isLoading={searchLoading}
            isImageSearching={imageSearchMutation.isPending || isImageUrlSearching}
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
              onClearCategory={handleClearCategory}
              className="sticky top-24"
            />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {isLoading ? (
                    imageSearchMode ? 'Searching by image...' : isCollectionMode ? 'Loading collection...' : isSearchMode ? 'Searching...' : 'Loading videos...'
                  ) : (
                    <>
                      {totalResults.toLocaleString()} {
                        imageSearchMode
                          ? 'similar videos found'
                          : isCollectionMode
                            ? `videos in "${displayTitle}"`
                            : isSearchMode
                              ? `results for "${displayTitle}"`
                              : Object.keys(activeFilters).length > 0
                                ? 'filtered videos'
                                : 'videos'
                      }
                    </>
                  )}
                </h1>
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
                  onClearCategory={handleClearCategory}
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

            {/* Empty State - For search/collection/image modes */}
            {!isLoading && !error && (isSearchMode || isCollectionMode || imageSearchMode) && results.length === 0 && (
              <div className="text-center py-20">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {imageSearchMode ? 'No similar videos found' : isCollectionMode ? 'No videos in this collection' : 'No results found'}
                </h2>
                <p className="text-gray-500 mb-4">
                  {imageSearchMode
                    ? 'Try uploading a different image'
                    : isCollectionMode
                      ? 'This collection doesn\'t have any videos yet'
                      : 'Try adjusting your search or filters to find what you\'re looking for'}
                </p>
                {!isCollectionMode && !imageSearchMode && (
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {/* Empty Browse State - Only show if browse mode with filters has no results */}
            {!isLoading && !error && isBrowseMode && results.length === 0 && Object.keys(activeFilters).length > 0 && (
              <div className="text-center py-20">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No videos match your filters</h2>
                <p className="text-gray-500 mb-4">
                  Try adjusting your filters to find what you&apos;re looking for
                </p>
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Clear All Filters
                </button>
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
                    showScore={isSearchMode || imageSearchMode}
                  />
                ))}
              </div>
            )}

            {/* End of results indicator */}
            {!isLoading && results.length > 0 && results.length >= totalResults && (
              <div className="mt-8 text-center text-gray-400 text-sm">
                Showing all {results.length} results
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      <VideoModal
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        videoId={selectedVideo ? (isSearchResult(selectedVideo) ? selectedVideo.video_id : selectedVideo._id) : undefined}
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
