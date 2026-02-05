'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { VideoAnalysis } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';

interface AnalysisPanelProps {
  videoId: string;
  autoFetch?: boolean;
  onSeek?: (seconds: number) => void;
}

// Parse timestamp string to seconds. Handles formats:
// "0:05", "1:30", "00:05-00:15", "0s (00:00) - 4s (00:04)", "4s", "30s"
function parseTimestamp(ts: string): number | null {
  // Take only the start portion if it's a range
  const start = ts.split(/\s*-\s/)[0].trim();

  // Try mm:ss or hh:mm:ss inside parentheses, e.g. "(00:04)"
  const parenMatch = start.match(/\((\d+:\d+(?::\d+)?)\)/);
  if (parenMatch) {
    const parts = parenMatch[1].split(':').map(Number);
    if (!parts.some(isNaN)) {
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  // Try "Xs" format, e.g. "0s", "4s", "30s"
  const secMatch = start.match(/^(\d+(?:\.\d+)?)s\b/);
  if (secMatch) {
    return parseFloat(secMatch[1]);
  }

  // Try plain mm:ss or hh:mm:ss
  const parts = start.split(':').map(Number);
  if (!parts.some(isNaN)) {
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

type SectionKey = 'scenes' | 'key_moments' | 'audio_mood' | 'text_extraction' | 'brand_timeline' | 'color_palette';

interface SectionDef {
  key: SectionKey;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

const SECTIONS: SectionDef[] = [
  { key: 'scenes', label: 'Scene Breakdown', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { key: 'key_moments', label: 'Key Moments', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  { key: 'audio_mood', label: 'Audio & Mood', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3', color: 'text-green-600', bgColor: 'bg-green-50' },
  { key: 'text_extraction', label: 'Text Extraction', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { key: 'brand_timeline', label: 'Brand Timeline', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { key: 'color_palette', label: 'Color Palette', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', color: 'text-pink-600', bgColor: 'bg-pink-50' },
];

const ANALYSIS_CACHE_TIME = 30 * 60 * 1000; // 30 minutes

async function fetchAnalysisFromAPI(videoId: string, section: SectionKey | 'all'): Promise<Record<string, unknown>> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, section }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Analysis failed');
  }
  const data = await response.json();
  return data.analysis;
}

export default function AnalysisPanel({ videoId, autoFetch = false, onSeek }: AnalysisPanelProps) {
  const queryClient = useQueryClient();

  // Reactive cache reads for each section
  const sectionQueries = useQueries({
    queries: SECTIONS.map(s => ({
      queryKey: ['analysis', videoId, s.key] as const,
      queryFn: async () => {
        const result = await fetchAnalysisFromAPI(videoId, s.key);
        return result[s.key];
      },
      enabled: false,
      staleTime: Infinity,
      gcTime: ANALYSIS_CACHE_TIME,
      retry: false,
    })),
  });

  // Summary reactive cache
  const { data: summary } = useQuery<string>({
    queryKey: ['analysis', videoId, 'summary'],
    queryFn: () => null as never,
    enabled: false,
    staleTime: Infinity,
    gcTime: ANALYSIS_CACHE_TIME,
  });

  const hasCachedData = sectionQueries.some(q => q.data !== undefined);

  // Initialize started from cache or autoFetch
  const [started, setStarted] = useState(() => {
    if (autoFetch) return true;
    return SECTIONS.some(s =>
      queryClient.getQueryData(['analysis', videoId, s.key]) !== undefined
    );
  });

  // "Analyze All" mutation — splits results into per-section cache
  const analyzeAll = useMutation({
    mutationFn: () => fetchAnalysisFromAPI(videoId, 'all'),
    onSuccess: (result) => {
      for (const s of SECTIONS) {
        if (result[s.key] !== undefined) {
          queryClient.setQueryData(['analysis', videoId, s.key], result[s.key]);
        }
      }
      if (result.summary) {
        queryClient.setQueryData(['analysis', videoId, 'summary'], result.summary as string);
      }
    },
  });

  const handleRunSection = useCallback((key: SectionKey) => {
    const index = SECTIONS.findIndex(s => s.key === key);
    if (index >= 0) {
      sectionQueries[index].refetch();
    }
  }, [sectionQueries]);

  const handleAnalyzeAll = useCallback(() => {
    setStarted(true);
    analyzeAll.mutate();
  }, [analyzeAll]);

  // Auto-fetch all on mount if autoFetch and no cached data
  const [autoFetched, setAutoFetched] = useState(false);
  if (autoFetch && !autoFetched) {
    setAutoFetched(true);
    if (!hasCachedData) {
      analyzeAll.mutate();
    }
  }

  const anyLoading = analyzeAll.isPending || sectionQueries.some(q => q.isFetching);

  // Initial state: show section menu
  if (!started) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">AI Analysis</h3>
          <button
            onClick={handleAnalyzeAll}
            className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Analyze All
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => { setStarted(true); handleRunSection(s.key); }}
              className={`cursor-pointer flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all text-left group`}
            >
              <div className={`w-8 h-8 ${s.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <svg className={`w-4 h-4 ${s.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                </svg>
              </div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                {s.label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center">
          Powered by TwelveLabs Video AI
        </p>
      </div>
    );
  }

  // Active state: show section cards with results
  return (
    <div className="space-y-4">
      {/* Header with Analyze All */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">AI Analysis</h3>
        <button
          onClick={handleAnalyzeAll}
          disabled={anyLoading}
          className="cursor-pointer bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {anyLoading ? 'Analyzing...' : 'Analyze All'}
        </button>
      </div>

      {/* Mutation error */}
      {analyzeAll.isError && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-sm text-red-600">{analyzeAll.error?.message || 'Analysis failed'}</p>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm text-blue-900 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Section Cards */}
      {SECTIONS.map((s, i) => {
        const q = sectionQueries[i];
        const isLoading = q.isFetching || (analyzeAll.isPending && q.data === undefined);
        const isLoaded = q.data !== undefined;
        const error = q.error?.message;

        return (
          <SectionCard
            key={s.key}
            section={s}
            data={q.data}
            isLoading={isLoading}
            isLoaded={isLoaded}
            error={error}
            onRun={() => handleRunSection(s.key)}
            onSeek={onSeek}
          />
        );
      })}

      {/* Attribution */}
      <div className="pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">
          Analysis powered by TwelveLabs Video AI
        </p>
      </div>
    </div>
  );
}

// --- Section Card ---

function SectionCard({
  section,
  data,
  isLoading,
  isLoaded,
  error,
  onRun,
  onSeek,
}: {
  section: SectionDef;
  data: unknown;
  isLoading: boolean;
  isLoaded: boolean;
  error?: string;
  onRun: () => void;
  onSeek?: (seconds: number) => void;
}) {
  return (
    <section className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 ${section.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={section.icon} />
          </svg>
          <h4 className="text-sm font-semibold text-gray-900">{section.label}</h4>
        </div>
        {!isLoaded && !isLoading && !error && (
          <button
            onClick={onRun}
            className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Run
          </button>
        )}
        {isLoaded && !isLoading && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Done
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {isLoading && (
          <div className="flex items-center gap-3 py-4 justify-center">
            <LoadingSpinner size="sm" />
            <span className="text-sm text-gray-500">Analyzing...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center py-3">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={onRun} className="cursor-pointer text-xs text-red-600 underline mt-1">Retry</button>
          </div>
        )}

        {!isLoading && !error && !isLoaded && (
          <p className="text-xs text-gray-400 py-2">Click &ldquo;Run&rdquo; to analyze this section</p>
        )}

        {isLoaded && !isLoading && <SectionContent sectionKey={section.key} data={data} onSeek={onSeek} />}
      </div>
    </section>
  );
}

// --- Section Content Renderers ---

function SectionContent({ sectionKey, data, onSeek }: { sectionKey: SectionKey; data: unknown; onSeek?: (seconds: number) => void }) {
  switch (sectionKey) {
    case 'scenes': return <ScenesContent scenes={data as VideoAnalysis['scenes']} onSeek={onSeek} />;
    case 'key_moments': return <KeyMomentsContent moments={data as VideoAnalysis['key_moments']} onSeek={onSeek} />;
    case 'audio_mood': return <AudioMoodContent mood={data as VideoAnalysis['audio_mood']} />;
    case 'text_extraction': return <TextExtractionContent extraction={data as VideoAnalysis['text_extraction']} />;
    case 'brand_timeline': return <BrandTimelineContent timeline={data as VideoAnalysis['brand_timeline']} onSeek={onSeek} />;
    case 'color_palette': return <ColorPaletteContent palette={data as VideoAnalysis['color_palette']} />;
    default: return null;
  }
}

function TimestampBadge({ timestamp, className, onSeek }: { timestamp: string; className: string; onSeek?: (seconds: number) => void }) {
  const seconds = parseTimestamp(timestamp);
  const isClickable = onSeek && seconds !== null;

  return (
    <button
      type="button"
      onClick={() => isClickable && onSeek(seconds)}
      className={`${className} ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current transition-all' : 'cursor-default'}`}
      title={isClickable ? `Jump to ${timestamp}` : undefined}
    >
      {isClickable && (
        <svg className="w-3 h-3 inline-block mr-0.5 -mt-px" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
      {timestamp}
    </button>
  );
}

function ScenesContent({ scenes, onSeek }: { scenes?: VideoAnalysis['scenes']; onSeek?: (seconds: number) => void }) {
  if (!scenes?.length) return <p className="text-xs text-gray-400">No scenes detected</p>;
  return (
    <div className="space-y-3">
      {scenes.map((scene, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3">
          <TimestampBadge timestamp={scene.timestamp} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium" onSeek={onSeek} />
          <p className="text-sm text-gray-700 mt-1.5">{scene.description}</p>
          {scene.visual_elements?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {scene.visual_elements.map((el, j) => (
                <span key={j} className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded border border-gray-200">{el}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function KeyMomentsContent({ moments, onSeek }: { moments?: VideoAnalysis['key_moments']; onSeek?: (seconds: number) => void }) {
  if (!moments?.length) return <p className="text-xs text-gray-400">No key moments detected</p>;
  return (
    <div className="space-y-2">
      {moments.map((m, i) => (
        <div key={i} className="flex items-start gap-3 p-2">
          <TimestampBadge timestamp={m.timestamp} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5" onSeek={onSeek} />
          <div>
            <p className="text-sm font-medium text-gray-900">{m.label}</p>
            <p className="text-xs text-gray-500">{m.significance}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AudioMoodContent({ mood }: { mood?: VideoAnalysis['audio_mood'] }) {
  if (!mood) return <p className="text-xs text-gray-400">No audio analysis available</p>;
  return (
    <div className="grid grid-cols-2 gap-3">
      {mood.overall_mood && (
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-xs text-gray-500 block">Overall Mood</span>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{mood.overall_mood}</p>
        </div>
      )}
      {mood.music_style && (
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-xs text-gray-500 block">Music Style</span>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{mood.music_style}</p>
        </div>
      )}
      {mood.voiceover && (
        <div className="bg-gray-50 rounded-lg p-3 col-span-2">
          <span className="text-xs text-gray-500 block">Voiceover</span>
          <p className="text-sm font-medium text-gray-900 mt-0.5">{mood.voiceover}</p>
        </div>
      )}
      {mood.sound_effects?.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 col-span-2">
          <span className="text-xs text-gray-500 block mb-1">Sound Effects</span>
          <div className="flex flex-wrap gap-1">
            {mood.sound_effects.map((e, i) => (
              <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{e}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TextExtractionContent({ extraction }: { extraction?: VideoAnalysis['text_extraction'] }) {
  if (!extraction) return <p className="text-xs text-gray-400">No text detected</p>;
  return (
    <div className="space-y-3">
      {extraction.on_screen_text?.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-xs text-gray-500 block mb-1.5">On-Screen Text</span>
          <ul className="space-y-1">
            {extraction.on_screen_text.map((t, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5 flex-shrink-0">&bull;</span>{t}
              </li>
            ))}
          </ul>
        </div>
      )}
      {extraction.spoken_text && (
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-xs text-gray-500 block mb-1">Spoken Text</span>
          <p className="text-sm text-gray-700 italic">&ldquo;{extraction.spoken_text}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

function BrandTimelineContent({ timeline, onSeek }: { timeline?: VideoAnalysis['brand_timeline']; onSeek?: (seconds: number) => void }) {
  if (!timeline?.length) return <p className="text-xs text-gray-400">No brand appearances detected</p>;
  return (
    <div className="space-y-2">
      {timeline.map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-2">
          <TimestampBadge timestamp={item.timestamp} className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5" onSeek={onSeek} />
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium uppercase">{item.type}</span>
            <p className="text-sm text-gray-700">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorPaletteContent({ palette }: { palette?: VideoAnalysis['color_palette'] }) {
  if (!palette?.dominant_colors?.length) return <p className="text-xs text-gray-400">No color data available</p>;
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex gap-2 mb-2">
        {palette.dominant_colors.map((color, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-500 font-mono">{color}</span>
          </div>
        ))}
      </div>
      {palette.overall_tone && (
        <p className="text-xs text-gray-500 mt-2">
          Overall tone: <span className="font-medium text-gray-700">{palette.overall_tone}</span>
        </p>
      )}
    </div>
  );
}
