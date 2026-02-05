'use client';

import { useEffect, useRef, useState } from 'react';
import { UserMetadata } from '@/types';
import AnalysisPanel from '@/components/AnalysisPanel';
import HlsPlayer from '@/components/HlsPlayer';

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
  videoId?: string;
  title?: string;
  metadata?: UserMetadata;
  startTime?: number;
  endTime?: number;
  variant?: 'clip' | 'full';
  score?: number;
  onFindSimilar?: () => void;
  onViewFullVideo?: () => void;
}

export default function VideoModal({
  isOpen,
  onClose,
  videoUrl,
  videoId,
  title,
  metadata,
  startTime,
  endTime,
  variant = 'full',
  score,
  onFindSimilar,
  onViewFullVideo,
}: VideoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis'>('overview');

  const isClip = variant === 'clip';

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen]);

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

  // Seek to startTime after HLS loads and handle endTime clipping
  useEffect(() => {
    if (!isOpen || !videoRef.current) return;

    const video = videoRef.current;

    const seekToStart = () => {
      if (startTime !== undefined && startTime > 0) {
        video.currentTime = startTime;
      }
    };

    // If video is already ready, seek immediately; otherwise wait
    if (video.readyState >= 1) {
      seekToStart();
    } else {
      video.addEventListener('loadedmetadata', seekToStart, { once: true });
    }

    const handleTimeUpdate = () => {
      if (endTime !== undefined && video.currentTime >= endTime) {
        video.pause();
        if (startTime !== undefined) {
          video.currentTime = startTime;
        }
      }
    };

    if (endTime !== undefined) {
      video.addEventListener('timeupdate', handleTimeUpdate);
    }

    return () => {
      video.removeEventListener('loadedmetadata', seekToStart);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isOpen, videoUrl, startTime, endTime]);

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
      <div className={`bg-white rounded-2xl overflow-hidden w-full max-h-[90vh] flex flex-col ${isClip ? 'max-w-3xl' : 'max-w-5xl'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 line-clamp-1">
              {title || 'Video Player'}
            </h2>
            {score !== undefined && score > 0 && (
              <span className="flex-shrink-0 text-xs bg-blue-600 text-white px-2 py-1 rounded-full font-medium">
                {Math.round(score * 100)}% match
              </span>
            )}
            {startTime !== undefined && endTime !== undefined && (
              <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {formatTime(startTime)} - {formatTime(endTime)}
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
        <div className="relative bg-black" style={{ height: isClip ? '50vh' : '45vh', minHeight: '240px' }}>
          {videoUrl ? (
            <HlsPlayer
              ref={videoRef}
              src={videoUrl}
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No video available
            </div>
          )}
        </div>

        {/* Clip variant: action bar instead of tabs */}
        {isClip && (
          <div className="flex items-center gap-3 p-4 border-t">
            {onViewFullVideo && (
              <button
                onClick={onViewFullVideo}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Full Video
              </button>
            )}
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
          </div>
        )}

        {/* Full variant: tabs + content */}
        {!isClip && (
          <>
            {/* Tab Bar */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'analysis'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Analysis
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 overflow-y-auto flex-1">
              {activeTab === 'overview' ? (
                <>
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
                </>
              ) : (
                videoId ? (
                  <AnalysisPanel
                    videoId={videoId}
                    autoFetch={false}
                    onSeek={(seconds) => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = seconds;
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>Analysis is not available for this video.</p>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
