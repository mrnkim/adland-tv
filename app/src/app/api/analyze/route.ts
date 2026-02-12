import { NextRequest, NextResponse } from 'next/server';
import { TwelveLabs } from 'twelvelabs-js';

export const runtime = 'nodejs';
export const maxDuration = 180;

const getClient = () => {
  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!apiKey) throw new Error('TWELVELABS_API_KEY not configured');
  return new TwelveLabs({ apiKey });
};

// Section-specific prompts and schemas
const SECTION_CONFIG: Record<string, { prompt: string; schema: object }> = {
  scenes: {
    prompt: 'Analyze every distinct scene in this video. For each scene, provide the timestamp range, a description, and the key visual elements present.',
    schema: {
      type: 'object',
      properties: {
        scenes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              description: { type: 'string' },
              visual_elements: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  },
  key_moments: {
    prompt: 'Identify the key moments in this video — emotional peaks, reveals, surprising transitions, or any standout points. For each, give a timestamp, a short label, and why it matters.',
    schema: {
      type: 'object',
      properties: {
        key_moments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              label: { type: 'string' },
              significance: { type: 'string' },
            },
          },
        },
      },
    },
  },
  audio_mood: {
    prompt: 'Analyze the audio and mood of this video. Describe the overall emotional mood, the music genre/style, any voiceover narration, and notable sound effects.',
    schema: {
      type: 'object',
      properties: {
        audio_mood: {
          type: 'object',
          properties: {
            overall_mood: { type: 'string' },
            music_style: { type: 'string' },
            voiceover: { type: 'string' },
            sound_effects: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
  text_extraction: {
    prompt: 'Extract all text from this video: any text visible on screen (titles, captions, logos, URLs) and any spoken dialogue or narration.',
    schema: {
      type: 'object',
      properties: {
        text_extraction: {
          type: 'object',
          properties: {
            on_screen_text: { type: 'array', items: { type: 'string' } },
            spoken_text: { type: 'string' },
          },
        },
      },
    },
  },
  brand_timeline: {
    prompt: 'Identify every brand appearance in this video with timestamps. Note whether it appears as a logo, product placement, or verbal mention, and describe how it appears.',
    schema: {
      type: 'object',
      properties: {
        brand_timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              timestamp: { type: 'string' },
              type: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  },
  color_palette: {
    prompt: 'Analyze the color palette of this video. Identify the 5 most dominant colors as hex codes and describe the overall color tone (warm, cool, neutral, vibrant, or muted).',
    schema: {
      type: 'object',
      properties: {
        color_palette: {
          type: 'object',
          properties: {
            dominant_colors: { type: 'array', items: { type: 'string' } },
            overall_tone: { type: 'string' },
          },
        },
      },
    },
  },
};

// Full analysis prompt and schema
const ALL_PROMPT = `Analyze this advertisement video comprehensively. Provide a detailed breakdown including:
1. Every distinct scene with timestamps, descriptions, and visual elements
2. Key moments that stand out (emotional peaks, reveals, transitions)
3. Audio mood analysis (overall mood, music style, voiceover description, sound effects)
4. All text visible on screen and spoken dialogue
5. Every brand appearance with timestamps and how it appears (logo, product, verbal mention)
6. The dominant color palette with hex codes and overall tone
7. A 2-3 sentence summary of the ad's creative strategy and message

Be thorough and precise with timestamps.`;

const ALL_SCHEMA = {
  type: 'object' as const,
  properties: {
    scenes: (SECTION_CONFIG.scenes.schema as any).properties.scenes,
    key_moments: (SECTION_CONFIG.key_moments.schema as any).properties.key_moments,
    audio_mood: (SECTION_CONFIG.audio_mood.schema as any).properties.audio_mood,
    text_extraction: (SECTION_CONFIG.text_extraction.schema as any).properties.text_extraction,
    brand_timeline: (SECTION_CONFIG.brand_timeline.schema as any).properties.brand_timeline,
    color_palette: (SECTION_CONFIG.color_palette.schema as any).properties.color_palette,
    summary: { type: 'string' as const },
  },
};

function parseResult(result: unknown): Record<string, unknown> {
  // SDK may return result.data as a parsed object or a JSON string
  const data = (result as any)?.data;

  // Already a parsed object — return directly
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  // Try parsing as JSON string
  try {
    const text = typeof result === 'string'
      ? result
      : data || (result as any).text || String(result);
    const cleanText = String(text)
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleanText);
  } catch {
    const rawText = typeof result === 'string'
      ? result
      : data || (result as any).text || String(result);
    return { summary: String(rawText) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.TWELVELABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { videoId, section } = body;

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    const client = getClient();

    let prompt: string;
    let schema: Record<string, unknown>;

    if (section && section !== 'all' && SECTION_CONFIG[section]) {
      prompt = SECTION_CONFIG[section].prompt;
      schema = SECTION_CONFIG[section].schema as Record<string, unknown>;
    } else {
      prompt = ALL_PROMPT;
      schema = ALL_SCHEMA as Record<string, unknown>;
    }

    const result = await client.analyze(
      {
        videoId,
        prompt,
        responseFormat: {
          type: 'json_schema',
          jsonSchema: schema,
        },
      },
      { timeoutInSeconds: 180 },
    );

    const analysis = parseResult(result);

    return NextResponse.json({
      videoId,
      section: section || 'all',
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
