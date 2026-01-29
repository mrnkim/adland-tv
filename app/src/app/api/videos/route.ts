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

    // When filtering by collection, fetch multiple pages to find all matching videos
    if (collection) {
      let allVideos: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      const fetchLimit = 50; // Fetch 50 per page for efficiency

      do {
        const url = new URL(`https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos`);
        url.searchParams.set('page', currentPage.toString());
        url.searchParams.set('page_limit', fetchLimit.toString());

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
        const pageVideos = data.data || [];

        // Filter for collection
        const collectionVideos = pageVideos.filter((v: any) => v.user_metadata?.collection === collection);
        allVideos = [...allVideos, ...collectionVideos];

        totalPages = data.page_info?.total_page || 1;
        currentPage++;
      } while (currentPage <= totalPages && currentPage <= 10); // Max 10 pages to prevent infinite loops

      return NextResponse.json({
        videos: allVideos,
        pageInfo: {
          page: 1,
          total_page: 1,
          total_results: allVideos.length,
        },
      });
    }

    // Regular pagination without collection filter
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

    return NextResponse.json({
      videos: data.data || [],
      pageInfo: {
        page: data.page_info?.page || 1,
        total_page: data.page_info?.total_page || 1,
        total_results: data.page_info?.total_results || 0,
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
