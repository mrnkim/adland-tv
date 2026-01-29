'use client';

import { useEffect, useRef } from 'react';
import { UserMetadata } from '@/types';

// Format seconds to mm:ss
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  title?: string;
  metadata?: UserMetadata;
  onFindSimilar?: () => void;
  startTime?: number;
  endTime?: number;
}

export default function VideoModal({
  isOpen,
  onClose,
  videoUrl,
  title,
  metadata,
  onFindSimilar,
  startTime,
  endTime,
}: VideoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Auto-play when modal opens, seek to startTime if provided
  useEffect(() => {
    if (isOpen && videoRef.current) {
      const video = videoRef.current;

      // Seek to start time if provided
      if (startTime !== undefined && startTime > 0) {
        video.currentTime = startTime;
      }

      video.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, [isOpen, videoUrl, startTime]);

  // Handle endTime - pause when reaching the end of the clip
  useEffect(() => {
    if (!isOpen || !videoRef.current || endTime === undefined) return;

    const video = videoRef.current;
    const handleTimeUpdate = () => {
      if (video.currentTime >= endTime) {
        video.pause();
        // Optionally seek back to start of clip for replay
        if (startTime !== undefined) {
          video.currentTime = startTime;
        }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isOpen, startTime, endTime]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="bg-white rounded-2xl overflow-hidden max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 line-clamp-1">
              {title || 'Video Player'}
            </h2>
            {startTime !== undefined && endTime !== undefined && (
              <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                Clip: {formatTime(startTime)} - {formatTime(endTime)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video bg-black">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              controls
              playsInline
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No video available
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="p-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column - Details */}
            <div>
              {metadata?.brand && (
                <div className="mb-3">
                  <span className="text-sm text-gray-500">Brand</span>
                  <p className="font-medium text-gray-900">{metadata.brand}</p>
                </div>
              )}
              {metadata?.description && (
                <div className="mb-3">
                  <span className="text-sm text-gray-500">Description</span>
                  <p className="text-gray-700 text-sm">{metadata.description}</p>
                </div>
              )}
              {metadata?.celebrities && (
                <div className="mb-3">
                  <span className="text-sm text-gray-500">Celebrities</span>
                  <p className="text-gray-700">{metadata.celebrities}</p>
                </div>
              )}
            </div>

            {/* Right column - AI Tags */}
            <div>
              <span className="text-sm text-gray-500 block mb-2">AI-Detected Attributes</span>
              <div className="flex flex-wrap gap-2">
                {metadata?.theme && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                    Theme: {metadata.theme}
                  </span>
                )}
                {metadata?.emotion && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                    Emotion: {metadata.emotion}
                  </span>
                )}
                {metadata?.visual_style && (
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                    Style: {metadata.visual_style}
                  </span>
                )}
                {metadata?.sentiment && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                    Sentiment: {metadata.sentiment}
                  </span>
                )}
                {metadata?.product_category && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
                    Category: {metadata.product_category}
                  </span>
                )}
                {metadata?.era_decade && (
                  <span className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                    Era: {metadata.era_decade}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t">
            {onFindSimilar && (
              <button
                onClick={onFindSimilar}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Find Similar
              </button>
            )}
            {metadata?.source_url && (
              <a
                href={metadata.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                View on AdLand.TV
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
