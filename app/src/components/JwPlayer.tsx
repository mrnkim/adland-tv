'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const JW_PLAYER_ID = '19i2Zbpi';
const JW_LIBRARY_URL = `https://cdn.jwplayer.com/libraries/${JW_PLAYER_ID}.js`;

interface JwPlayerProps {
  mediaId: string;
  autoPlay?: boolean;
  className?: string;
  onReady?: () => void;
}

export interface JwPlayerHandle {
  seek(seconds: number): void;
  play(): void;
  pause(): void;
  getPosition(): number;
  on(event: string, callback: (e: any) => void): void;
  off(event: string): void;
}

// Load JW Player library once globally
let jwLoadPromise: Promise<void> | null = null;

function ensureJwLibrary(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).jwplayer) return Promise.resolve();
  if (jwLoadPromise) return jwLoadPromise;

  jwLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = JW_LIBRARY_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load JW Player library'));
    document.head.appendChild(script);
  });

  return jwLoadPromise;
}

const JwPlayer = forwardRef<JwPlayerHandle, JwPlayerProps>(
  ({ mediaId, autoPlay = false, className = '', onReady }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      seek(seconds: number) {
        playerRef.current?.seek?.(seconds);
      },
      play() {
        playerRef.current?.play?.();
      },
      pause() {
        playerRef.current?.pause?.();
      },
      getPosition(): number {
        return playerRef.current?.getPosition?.() ?? 0;
      },
      on(event: string, callback: (e: any) => void) {
        playerRef.current?.on?.(event, callback);
      },
      off(event: string) {
        playerRef.current?.off?.(event);
      },
    }));

    useEffect(() => {
      if (!containerRef.current || !mediaId) return;

      const container = containerRef.current;
      let destroyed = false;

      ensureJwLibrary().then(() => {
        if (destroyed || !container) return;

        // Use pixel dimensions from parent to avoid JW Player's padding-based aspect ratio
        const parent = container.parentElement;
        const w = parent?.clientWidth || container.clientWidth || 640;
        const h = parent?.clientHeight || container.clientHeight || 360;

        const player = (window as any).jwplayer(container).setup({
          playlist: `https://cdn.jwplayer.com/v2/media/${mediaId}`,
          autostart: autoPlay,
          width: w,
          height: h,
          stretching: 'uniform',
        });

        playerRef.current = player;

        player.on('ready', () => {
          onReady?.();
        });
      });

      return () => {
        destroyed = true;
        if (playerRef.current) {
          playerRef.current.remove();
          playerRef.current = null;
        }
      };
    }, [mediaId, autoPlay, onReady]);

    return <div ref={containerRef} className={className} />;
  }
);

JwPlayer.displayName = 'JwPlayer';
export default JwPlayer;
