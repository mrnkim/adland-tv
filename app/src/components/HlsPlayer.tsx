'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';

interface HlsPlayerProps {
  src: string;
  autoPlay?: boolean;
  className?: string;
}

const CLOUDFRONT_BASE = 'https://deuqpmn4rs7j5.cloudfront.net';

function toProxyUrl(src: string): string {
  if (src.startsWith(CLOUDFRONT_BASE)) {
    return '/api/proxy' + src.slice(CLOUDFRONT_BASE.length);
  }
  return src;
}

const HlsPlayer = forwardRef<HTMLVideoElement, HlsPlayerProps>(
  ({ src, autoPlay = false, className = '' }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement);

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const isHls = src.includes('.m3u8');

      if (isHls && Hls.isSupported()) {
        // Convert CloudFront URL to path-based proxy URL
        // e.g. https://cf.net/abc/stream/playlist.m3u8 → /api/proxy/abc/stream/playlist.m3u8
        // Relative segment URLs in playlist (segment_0000.ts) will resolve to
        // /api/proxy/abc/stream/segment_0000.ts — also proxied automatically
        const proxiedSrc = toProxyUrl(src);
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(proxiedSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) {
            video.play().catch(() => {});
          }
        });
      } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS — no CORS issue
        video.src = src;
        if (autoPlay) {
          video.play().catch(() => {});
        }
      } else {
        video.src = src;
        if (autoPlay) {
          video.play().catch(() => {});
        }
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [src, autoPlay]);

    return (
      <video
        ref={videoRef}
        className={className}
        controls
        playsInline
      />
    );
  }
);

HlsPlayer.displayName = 'HlsPlayer';

export default HlsPlayer;
