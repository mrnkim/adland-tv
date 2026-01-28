import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.TWELVELABS_API_KEY;
    const indexId = process.env.NEXT_PUBLIC_INDEX_ID;

    if (!apiKey || !indexId) {
      return NextResponse.json(
        { error: 'API key or Index ID is not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const pageLimit = searchParams.get('pageLimit') || '12';
    const collection = searchParams.get('collection');

    const url = new URL(`https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos`);
    url.searchParams.set('page', page);
    url.searchParams.set('page_limit', pageLimit);

    const response = await fetch(url.toString(), {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch videos' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter by collection if specified
    let videos = data.data || [];
    if (collection) {
      videos = videos.filter((v: any) => v.user_metadata?.collection === collection);
    }

    return NextResponse.json({
      videos,
      pageInfo: {
        page: data.page_info?.page || 1,
        total_page: data.page_info?.total_page || 1,
        total_results: data.page_info?.total_results || videos.length,
      },
    });
  } catch (error) {
    console.error('Videos API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
