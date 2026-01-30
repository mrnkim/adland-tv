'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import VideoCard from '@/components/VideoCard';
import AnalysisPanel from '@/components/AnalysisPanel';
import HlsPlayer from '@/components/HlsPlayer';
import LoadingSpinner from '@/components/LoadingSpinner';
import { VideoData, FILTER_OPTIONS } from '@/types';

const CATEGORY_ICONS: Record<string, string> = {
  'Auto': 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10',
  'Tech': 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  'Finance': 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'Insurance': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  'Healthcare': 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  'Retail': 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  'Food & Beverage': 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z',
  'Household & Personal Care': 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  'Entertainment': 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z',
  'Sports': 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'Travel': 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'Telecom': 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  'Beauty': 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  'Fashion': 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  'Luxury': 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  'Education': 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  'Other': 'M4 6h16M4 10h16M4 14h16M4 18h16',
};

function getIconPath(category: string): string {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS['Other'];
}

export default function AnalyzePage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);

  // Fetch videos for selected category
  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ['analyze-videos', selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('pageLimit', '50');
      if (selectedCategory) {
        params.set('product_category', selectedCategory);
      }
      const response = await fetch(`/api/videos?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch videos');
      return response.json();
    },
    enabled: !!selectedCategory,
  });

  const videos: VideoData[] = videosData?.videos || [];

  const handleBack = () => {
    if (selectedVideo) {
      setSelectedVideo(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            {(selectedCategory || selectedVideo) && (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {selectedVideo
                  ? (selectedVideo.user_metadata?.title || 'Video Analysis')
                  : selectedCategory
                    ? `${selectedCategory} Ads`
                    : 'AI Video Analysis'}
              </h1>
              <p className="text-gray-600 mt-1">
                {selectedVideo
                  ? 'Deep AI analysis of this advertisement'
                  : selectedCategory
                    ? 'Select a video to analyze'
                    : 'Choose a category to explore and analyze ads'}
              </p>
            </div>
          </div>

          {/* Breadcrumb */}
          {(selectedCategory || selectedVideo) && (
            <nav className="flex items-center gap-2 text-sm text-gray-500 mt-3">
              <button
                onClick={() => { setSelectedCategory(null); setSelectedVideo(null); }}
                className="hover:text-blue-600 transition-colors"
              >
                Categories
              </button>
              {selectedCategory && (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <button
                    onClick={() => setSelectedVideo(null)}
                    className={selectedVideo ? 'hover:text-blue-600 transition-colors' : 'text-gray-900 font-medium'}
                  >
                    {selectedCategory}
                  </button>
                </>
              )}
              {selectedVideo && (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-gray-900 font-medium">
                    {selectedVideo.user_metadata?.title || 'Analysis'}
                  </span>
                </>
              )}
            </nav>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* State 1: Category Grid */}
        {!selectedCategory && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {FILTER_OPTIONS.product_category.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={getIconPath(category)} />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors text-center">
                  {category}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* State 2: Video Grid */}
        {selectedCategory && !selectedVideo && (
          <>
            {videosLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-gray-500">Loading {selectedCategory} ads...</p>
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-20">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No videos in this category</h2>
                <p className="text-gray-500 mb-4">Try selecting a different category</p>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Back to Categories
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map((video) => (
                  <VideoCard
                    key={video._id}
                    video={video}
                    onClick={() => setSelectedVideo(video)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* State 3: Analysis View */}
        {selectedVideo && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Video Player + Metadata */}
            <div>
              <div className="bg-black rounded-xl overflow-hidden aspect-video">
                {selectedVideo.hls?.video_url ? (
                  <HlsPlayer
                    src={selectedVideo.hls.video_url}
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No video available
                  </div>
                )}
              </div>

              {/* Video Metadata */}
              <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
                {selectedVideo.user_metadata?.brand && (
                  <div className="mb-3">
                    <span className="text-sm text-gray-500">Brand</span>
                    <p className="font-medium text-gray-900">{selectedVideo.user_metadata.brand}</p>
                  </div>
                )}
                {selectedVideo.user_metadata?.description && (
                  <div className="mb-3">
                    <span className="text-sm text-gray-500">Description</span>
                    <p className="text-gray-700 text-sm">{selectedVideo.user_metadata.description}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {selectedVideo.user_metadata?.theme && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                      Theme: {selectedVideo.user_metadata.theme}
                    </span>
                  )}
                  {selectedVideo.user_metadata?.emotion && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      Emotion: {selectedVideo.user_metadata.emotion}
                    </span>
                  )}
                  {selectedVideo.user_metadata?.visual_style && (
                    <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                      Style: {selectedVideo.user_metadata.visual_style}
                    </span>
                  )}
                  {selectedVideo.user_metadata?.sentiment && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                      Sentiment: {selectedVideo.user_metadata.sentiment}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Analysis Panel */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Analysis</h3>
              <AnalysisPanel videoId={selectedVideo._id} autoFetch={true} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
