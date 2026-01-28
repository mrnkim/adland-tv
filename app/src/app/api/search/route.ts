import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.TWELVELABS_API_KEY;
    const indexId = process.env.NEXT_PUBLIC_INDEX_ID;

    if (!apiKey || !indexId) {
      return NextResponse.json(
        { error: 'API key or Index ID is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { query, pageLimit = 12, filters = {} } = body;

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Build form data for TwelveLabs API
    const formData = new FormData();
    formData.append('query_text', query);
    formData.append('index_id', indexId);
    formData.append('search_options', 'visual');
    formData.append('search_options', 'audio');
    formData.append('adjust_confidence_level', '0.5');
    formData.append('page_limit', pageLimit.toString());

    const response = await fetch('https://api.twelvelabs.io/v1.3/search', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('TwelveLabs search error:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Search failed' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform results to include video details
    const resultsWithDetails = await Promise.all(
      (data.data || []).map(async (result: any) => {
        try {
          // Fetch video details to get metadata
          const videoResponse = await fetch(
            `https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos/${result.video_id}`,
            {
              headers: {
                'x-api-key': apiKey,
              },
            }
          );

          if (videoResponse.ok) {
            const videoData = await videoResponse.json();
            return {
              ...result,
              index_id: indexId,
              thumbnail_url: videoData.hls?.thumbnail_urls?.[0],
              video_url: videoData.hls?.video_url,
              video_title: videoData.user_metadata?.title || videoData.system_metadata?.video_title,
              duration: videoData.system_metadata?.duration,
              metadata: videoData.user_metadata,
            };
          }
        } catch (e) {
          console.error('Error fetching video details:', e);
        }
        return result;
      })
    );

    // Apply client-side filters if any
    let filteredResults = resultsWithDetails;
    if (Object.keys(filters).length > 0) {
      filteredResults = resultsWithDetails.filter((result: any) => {
        for (const [category, values] of Object.entries(filters)) {
          if (Array.isArray(values) && values.length > 0) {
            const metadataValue = result.metadata?.[category];
            if (!metadataValue || !values.includes(metadataValue)) {
              return false;
            }
          }
        }
        return true;
      });
    }

    return NextResponse.json({
      pageInfo: {
        page: data.page_info?.page || 1,
        total_page: data.page_info?.total_page || 1,
        total_results: data.page_info?.total_results || filteredResults.length,
      },
      results: filteredResults,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
