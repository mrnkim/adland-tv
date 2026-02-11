'use client';

import { useState } from 'react';
import { VideoData, SearchResult } from '@/types';
import { getThumbnailUrl } from '@/lib/videoUrl';

interface VideoCardProps {
  video: VideoData | SearchResult;
  onClick?: () => void;
  showScore?: boolean;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTimestamp(seconds?: number): string {
  if (seconds == null) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function VideoCard({ video, onClick, showScore = false }: VideoCardProps) {
  const [imageError, setImageError] = useState(false);

  // Handle both VideoData and SearchResult types
  const isSearchResult = 'video_id' in video;

  const id = isSearchResult ? video.video_id : video._id;
  const thumbnailUrl = getThumbnailUrl(video);
  const title = isSearchResult
    ? video.video_title || video.metadata?.title
    : video.user_metadata?.title || video.system_metadata?.video_title;
  const brand = isSearchResult
    ? video.metadata?.brand
    : video.user_metadata?.brand;
  const duration = isSearchResult
    ? video.duration
    : video.system_metadata?.duration;
  const score = isSearchResult ? video.score : undefined;
  const rank = isSearchResult ? video.rank : undefined;
  const clipStart = isSearchResult ? video.start : undefined;
  const clipEnd = isSearchResult ? video.end : undefined;
  const theme = !isSearchResult ? video.user_metadata?.theme : undefined;
  const emotion = !isSearchResult ? video.user_metadata?.emotion : undefined;

  return (
    <div
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer border border-gray-100"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-200 overflow-hidden">
        {thumbnailUrl && !imageError ? (
          <img
            src={thumbnailUrl}
            alt={title || 'Video thumbnail'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-300">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Duration badge */}
        {duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {formatDuration(duration)}
          </div>
        )}

        {/* Rank badge */}
        {showScore && rank != null && (
          <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-medium">
            #{rank}
          </div>
        )}

        {/* Clip time segment badge */}
        {showScore && clipStart != null && clipEnd != null && (
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
            {formatTimestamp(clipStart)} - {formatTimestamp(clipEnd)}
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-medium text-gray-900 line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
          {title || 'Untitled'}
        </h3>
        {brand && (
          <p className="text-sm text-gray-600 mb-2">{brand}</p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {theme && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {theme}
            </span>
          )}
          {emotion && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {emotion}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
