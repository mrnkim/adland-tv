import { NextRequest, NextResponse } from 'next/server';
import { TwelveLabs } from 'twelvelabs-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const getClient = () => {
  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!apiKey) throw new Error('TWELVELABS_API_KEY not configured');
  return new TwelveLabs({ apiKey });
};

const ANALYSIS_PROMPT = `Analyze this advertisement video comprehensively. Provide a detailed breakdown including:
1. Every distinct scene with timestamps, descriptions, and visual elements
2. Key moments that stand out (emotional peaks, reveals, transitions)
3. Audio mood analysis (overall mood, music style, voiceover description, sound effects)
4. All text visible on screen and spoken dialogue
5. Every brand appearance with timestamps and how it appears (logo, product, verbal mention)
6. The dominant color palette with hex codes and overall tone
7. A 2-3 sentence summary of the ad's creative strategy and message

Be thorough and precise with timestamps.`;

const RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    scenes: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          timestamp: { type: 'string' as const },
          description: { type: 'string' as const },
          visual_elements: { type: 'array' as const, items: { type: 'string' as const } },
        },
      },
    },
    key_moments: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          timestamp: { type: 'string' as const },
          label: { type: 'string' as const },
          significance: { type: 'string' as const },
        },
      },
    },
    audio_mood: {
      type: 'object' as const,
      properties: {
        overall_mood: { type: 'string' as const },
        music_style: { type: 'string' as const },
        voiceover: { type: 'string' as const },
        sound_effects: { type: 'array' as const, items: { type: 'string' as const } },
      },
    },
    text_extraction: {
      type: 'object' as const,
      properties: {
        on_screen_text: { type: 'array' as const, items: { type: 'string' as const } },
        spoken_text: { type: 'string' as const },
      },
    },
    brand_timeline: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          timestamp: { type: 'string' as const },
          type: { type: 'string' as const },
          description: { type: 'string' as const },
        },
      },
    },
    color_palette: {
      type: 'object' as const,
      properties: {
        dominant_colors: { type: 'array' as const, items: { type: 'string' as const } },
        overall_tone: { type: 'string' as const },
      },
    },
    summary: { type: 'string' as const },
  },
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.TWELVELABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    const client = getClient();

    const result = await client.analyze({
      videoId,
      prompt: ANALYSIS_PROMPT,
      responseFormat: {
        type: 'json_schema',
        jsonSchema: RESPONSE_SCHEMA,
      },
    });

    // Parse the structured JSON response
    let analysis;
    try {
      // The SDK returns the result with a data property or as text
      const text = typeof result === 'string'
        ? result
        : (result as any).data || (result as any).text || String(result);
      const cleanText = String(text)
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      analysis = JSON.parse(cleanText);
    } catch {
      // Fallback: wrap raw text as summary
      const rawText = typeof result === 'string'
        ? result
        : (result as any).data || (result as any).text || String(result);
      analysis = {
        summary: String(rawText),
        scenes: [],
        key_moments: [],
        audio_mood: { overall_mood: '', music_style: '', voiceover: '', sound_effects: [] },
        text_extraction: { on_screen_text: [], spoken_text: '' },
        brand_timeline: [],
        color_palette: { dominant_colors: [], overall_tone: '' },
      };
    }

    return NextResponse.json({
      videoId,
      analysis,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analyze API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
