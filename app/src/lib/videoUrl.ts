import { VideoData, SearchResult } from '@/types';

const JW_CDN = 'https://cdn.jwplayer.com';

/**
 * Get the best available video URL for playback.
 * Priority: TwelveLabs HLS > JW Player HLS
 */
export function getVideoUrl(video: VideoData | SearchResult | null): string | undefined {
  if (!video) return undefined;

  // SearchResult has video_url directly
  if ('video_id' in video) {
    return video.video_url;
  }

  // VideoData: prefer TwelveLabs HLS, fallback to JW Player
  if (video.hls?.video_url) {
    return video.hls.video_url;
  }

  const jwMediaId = video.user_metadata?.jw_media_id;
  if (jwMediaId) {
    return `${JW_CDN}/manifests/${jwMediaId}.m3u8`;
  }

  return undefined;
}

/**
 * Get the best available thumbnail URL.
 * Priority: TwelveLabs thumbnail > JW Player thumbnail
 */
export function getThumbnailUrl(video: VideoData | SearchResult | null): string | undefined {
  if (!video) return undefined;

  if ('video_id' in video) {
    return video.thumbnail_url;
  }

  if (video.hls?.thumbnail_urls?.[0]) {
    return video.hls.thumbnail_urls[0];
  }

  const jwThumbnail = video.user_metadata?.jw_thumbnail;
  if (jwThumbnail) {
    return jwThumbnail;
  }

  const jwMediaId = video.user_metadata?.jw_media_id;
  if (jwMediaId) {
    return `${JW_CDN}/v2/media/${jwMediaId}/poster.jpg?width=720`;
  }

  return undefined;
}
