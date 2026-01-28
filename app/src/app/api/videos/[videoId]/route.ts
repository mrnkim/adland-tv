import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    const apiKey = process.env.TWELVELABS_API_KEY;
    const indexId = process.env.NEXT_PUBLIC_INDEX_ID;

    if (!apiKey || !indexId) {
      return NextResponse.json(
        { error: 'API key or Index ID is not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos/${videoId}`,
      {
        headers: {
          'x-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch video' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Video API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
