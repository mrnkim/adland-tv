'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import VideoCard from '@/components/VideoCard';
import VideoModal from '@/components/VideoModal';
import LoadingSpinner from '@/components/LoadingSpinner';
import { VideoData } from '@/types';

function BrowsePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const autoOpenVideoId = searchParams.get('videoId');
  const autoOpenHandled = useRef(false);

  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => {
      const response = await fetch('/api/videos?pageLimit=50');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch videos');
      }
      return response.json();
    },
  });

  const videos: VideoData[] = data?.videos || [];

  // Auto-open video from ?videoId= query param (e.g. from search "View Full Video")
  useEffect(() => {
    if (autoOpenVideoId && videos.length > 0 && !autoOpenHandled.current) {
      const video = videos.find((v: VideoData) => v._id === autoOpenVideoId);
      if (video) {
        setSelectedVideo(video);
        autoOpenHandled.current = true;
        // Clean URL so closing doesn't re-trigger
        router.replace('/browse', { scroll: false });
      }
    }
  }, [autoOpenVideoId, videos, router]);

  // Group videos by collection
  const groupedVideos = videos.reduce((acc: Record<string, VideoData[]>, video: VideoData) => {
    const collection = video.user_metadata?.collection || 'Other';
    if (!acc[collection]) {
      acc[collection] = [];
    }
    acc[collection].push(video);
    return acc;
  }, {});

  const handleVideoClick = (video: VideoData) => {
    setSelectedVideo(video);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse All Ads</h1>
          <p className="text-gray-600">
            Explore our collection of {videos.length} TV advertisements
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-500">Loading videos...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600 font-medium">
              {error instanceof Error ? error.message : 'Failed to load videos'}
            </p>
          </div>
        )}

        {/* Videos by Collection */}
        {!isLoading && !error && Object.keys(groupedVideos).length > 0 && (
          <div className="space-y-12">
            {Object.entries(groupedVideos).map(([collection, collectionVideos]) => (
              <section key={collection}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 capitalize">
                    {collection === 'superbowl' ? 'Super Bowl LX' : collection}
                  </h2>
                  <span className="text-sm text-gray-500">
                    {(collectionVideos as VideoData[]).length} ads
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {(collectionVideos as VideoData[]).map((video) => (
                    <VideoCard
                      key={video._id}
                      video={video}
                      onClick={() => handleVideoClick(video)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && videos.length === 0 && (
          <div className="text-center py-20">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No videos yet</h2>
            <p className="text-gray-500">
              Videos will appear here once they are indexed
            </p>
          </div>
        )}
      </div>

      {/* Video Modal */}
      <VideoModal
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        videoId={selectedVideo?._id}
        videoUrl={selectedVideo?.hls?.video_url}
        title={selectedVideo?.user_metadata?.title || selectedVideo?.system_metadata?.video_title}
        metadata={selectedVideo?.user_metadata}
      />
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <BrowsePageContent />
    </Suspense>
  );
}
