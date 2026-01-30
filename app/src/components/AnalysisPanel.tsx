'use client';

import { useQuery } from '@tanstack/react-query';
import { VideoAnalysis } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';

interface AnalysisPanelProps {
  videoId: string;
  autoFetch?: boolean;
}

export default function AnalysisPanel({ videoId, autoFetch = false }: AnalysisPanelProps) {
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetched,
  } = useQuery({
    queryKey: ['analysis', videoId],
    queryFn: async () => {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Analysis failed');
      }
      return response.json();
    },
    enabled: autoFetch,
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const analysis: VideoAnalysis | undefined = data?.analysis;

  // Not yet fetched — show trigger button
  if (!isFetched && !isLoading && !autoFetch) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Analysis</h3>
        <p className="text-sm text-gray-500 mb-4 text-center max-w-sm">
          Get a deep AI-powered breakdown of scenes, mood, brand appearances, and more.
        </p>
        <button
          onClick={() => refetch()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Run Analysis
        </button>
        <p className="text-xs text-gray-400 mt-3">
          Powered by TwelveLabs Video AI
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-500">Analyzing video with AI...</p>
        <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-medium">
          {error instanceof Error ? error.message : 'Analysis failed'}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {analysis.summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm text-blue-900 leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Scene Breakdown */}
      {analysis.scenes?.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            Scene Breakdown
          </h4>
          <div className="space-y-3">
            {analysis.scenes.map((scene, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  {scene.timestamp}
                </span>
                <p className="text-sm text-gray-700 mt-1.5">{scene.description}</p>
                {scene.visual_elements?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {scene.visual_elements.map((el, j) => (
                      <span key={j} className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                        {el}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Key Moments */}
      {analysis.key_moments?.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Key Moments
          </h4>
          <div className="space-y-2">
            {analysis.key_moments.map((moment, i) => (
              <div key={i} className="flex items-start gap-3 p-2">
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5">
                  {moment.timestamp}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{moment.label}</p>
                  <p className="text-xs text-gray-500">{moment.significance}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Audio & Mood */}
      {analysis.audio_mood && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            Audio & Mood
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {analysis.audio_mood.overall_mood && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block">Overall Mood</span>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{analysis.audio_mood.overall_mood}</p>
              </div>
            )}
            {analysis.audio_mood.music_style && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block">Music Style</span>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{analysis.audio_mood.music_style}</p>
              </div>
            )}
            {analysis.audio_mood.voiceover && (
              <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                <span className="text-xs text-gray-500 block">Voiceover</span>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{analysis.audio_mood.voiceover}</p>
              </div>
            )}
            {analysis.audio_mood.sound_effects?.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                <span className="text-xs text-gray-500 block mb-1">Sound Effects</span>
                <div className="flex flex-wrap gap-1">
                  {analysis.audio_mood.sound_effects.map((effect, i) => (
                    <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {effect}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Text Extraction */}
      {analysis.text_extraction && (analysis.text_extraction.on_screen_text?.length > 0 || analysis.text_extraction.spoken_text) && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Text Extraction
          </h4>
          <div className="space-y-3">
            {analysis.text_extraction.on_screen_text?.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block mb-1.5">On-Screen Text</span>
                <ul className="space-y-1">
                  {analysis.text_extraction.on_screen_text.map((text, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5 flex-shrink-0">&bull;</span>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.text_extraction.spoken_text && (
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-xs text-gray-500 block mb-1">Spoken Text</span>
                <p className="text-sm text-gray-700 italic">&ldquo;{analysis.text_extraction.spoken_text}&rdquo;</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Brand Timeline */}
      {analysis.brand_timeline?.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Brand Timeline
          </h4>
          <div className="space-y-2">
            {analysis.brand_timeline.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2">
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5">
                  {item.timestamp}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium uppercase">
                    {item.type}
                  </span>
                  <p className="text-sm text-gray-700">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Color Palette */}
      {analysis.color_palette && analysis.color_palette.dominant_colors?.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Color Palette
          </h4>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex gap-2 mb-2">
              {analysis.color_palette.dominant_colors.map((color, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-500 font-mono">{color}</span>
                </div>
              ))}
            </div>
            {analysis.color_palette.overall_tone && (
              <p className="text-xs text-gray-500 mt-2">
                Overall tone: <span className="font-medium text-gray-700">{analysis.color_palette.overall_tone}</span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Attribution */}
      <div className="pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">
          Analysis powered by TwelveLabs Video AI
        </p>
      </div>
    </div>
  );
}
