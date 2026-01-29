import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Metadata filter keys that can be used for filtering
const FILTER_KEYS = ['theme', 'emotion', 'visual_style', 'sentiment', 'product_category', 'era_decade', 'collection'];

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
    const pageLimit = parseInt(searchParams.get('pageLimit') || '50');

    // Extract filters from query params
    const filters: Record<string, string[]> = {};
    FILTER_KEYS.forEach(key => {
      const value = searchParams.get(key);
      if (value) {
        filters[key] = value.split(',');
      }
    });

    const hasFilters = Object.keys(filters).length > 0;

    // Fetch videos from TwelveLabs
    let allVideos: any[] = [];
    let currentPage = 1;
    let totalPages = 1;
    const fetchLimit = 50;

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

      // If no filters, just add all videos
      if (!hasFilters) {
        allVideos = [...allVideos, ...pageVideos];
      } else {
        // Filter videos by metadata
        const filteredVideos = pageVideos.filter((video: any) => {
          return Object.entries(filters).every(([key, values]) => {
            const metadataValue = video.user_metadata?.[key];
            return metadataValue && values.includes(metadataValue);
          });
        });
        allVideos = [...allVideos, ...filteredVideos];
      }

      totalPages = data.page_info?.total_page || 1;
      currentPage++;

      // Stop if we have enough videos or reached max pages
      if (allVideos.length >= pageLimit || currentPage > Math.min(totalPages, 10)) {
        break;
      }
    } while (currentPage <= totalPages);

    // Limit results
    const limitedVideos = allVideos.slice(0, pageLimit);

    return NextResponse.json({
      videos: limitedVideos,
      pageInfo: {
        page: 1,
        total_page: 1,
        total_results: limitedVideos.length,
        has_more: allVideos.length > pageLimit,
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
