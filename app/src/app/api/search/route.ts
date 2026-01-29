import { NextRequest, NextResponse } from 'next/server';
import { TwelveLabs } from 'twelvelabs-js';

export const runtime = 'nodejs';

// Initialize TwelveLabs client
const getClient = () => {
  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!apiKey) throw new Error('TWELVELABS_API_KEY not configured');
  return new TwelveLabs({ apiKey });
};

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
    const { query, pageLimit = 50, filters = {} } = body;

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const client = getClient();

    // Use SDK for search with automatic pagination
    // Use only visual search for more relevant results
    const searchResults = await client.search.query({
      indexId,
      queryText: query,
      searchOptions: ['visual'],
      adjustConfidenceLevel: 0.7,
      pageLimit,
    });

    // Collect all results using async iterator
    const allResults: any[] = [];
    for await (const clip of searchResults) {
      allResults.push(clip);
      // Limit total results to prevent too many API calls
      if (allResults.length >= pageLimit) break;
    }

    // Fetch video details for each result using direct API call
    const resultsWithDetails = await Promise.all(
      allResults.map(async (result: any) => {
        try {
          const videoResponse = await fetch(
            `https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos/${result.videoId}`,
            { headers: { 'x-api-key': apiKey } }
          );

          if (videoResponse.ok) {
            const videoData = await videoResponse.json();
            // Use rank to calculate a score (rank 1 = 100%, higher ranks = lower %)
            const calculatedScore = Math.max(0, 1 - (result.rank - 1) * 0.02);
            return {
              rank: result.rank,
              start: result.start,
              end: result.end,
              video_id: result.videoId,
              score: calculatedScore,
              thumbnail_url: result.thumbnailUrl,
              index_id: indexId,
              video_url: videoData.hls?.video_url,
              video_title: videoData.user_metadata?.title || videoData.system_metadata?.video_title,
              duration: videoData.system_metadata?.duration,
              metadata: videoData.user_metadata,
            };
          }
        } catch (e) {
          console.error('Error fetching video details:', e);
        }
        const calculatedScore = Math.max(0, 1 - (result.rank - 1) * 0.02);
        return {
          rank: result.rank,
          start: result.start,
          end: result.end,
          video_id: result.videoId,
          score: calculatedScore,
          thumbnail_url: result.thumbnailUrl,
          index_id: indexId,
        };
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
        page: 1,
        total_page: 1,
        total_results: filteredResults.length,
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
