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
    const { query, pageLimit = 50, filters = {}, pageToken } = body;

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const client = getClient();

    // Use create/retrieve for proper pagination support
    let searchResponse;
    if (pageToken) {
      // Fetch a specific page using the page token
      searchResponse = await client.search.retrieve(pageToken);
    } else {
      // Initial search request
      searchResponse = await client.search.create({
        indexId,
        queryText: query,
        searchOptions: ['visual'],
        adjustConfidenceLevel: 0.7,
        pageLimit,
      });
    }

    const allResults = searchResponse.data || [];

    const totalResults = searchResponse.pageInfo?.totalResults ?? allResults.length;

    // Fetch video details for each result using direct API call
    const resultsWithDetails = await Promise.all(
      allResults.map(async (result: any) => {
        // Use real score from TwelveLabs if available, otherwise derive from rank
        const score = (result.score != null && result.score > 0)
          ? result.score
          : totalResults > 1
            ? Math.max(0, 1 - (result.rank - 1) / (totalResults - 1))
            : 1;

        try {
          const videoResponse = await fetch(
            `https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos/${result.videoId}`,
            { headers: { 'x-api-key': apiKey } }
          );

          if (videoResponse.ok) {
            const videoData = await videoResponse.json();
            return {
              rank: result.rank,
              start: result.start,
              end: result.end,
              video_id: result.videoId,
              score,
              confidence: result.confidence,
              transcription: result.transcription,
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
        return {
          rank: result.rank,
          start: result.start,
          end: result.end,
          video_id: result.videoId,
          score,
          confidence: result.confidence,
          transcription: result.transcription,
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
        total_results: searchResponse.pageInfo?.totalResults ?? filteredResults.length,
        next_page_token: searchResponse.pageInfo?.nextPageToken ?? null,
        limit_per_page: searchResponse.pageInfo?.limitPerPage ?? pageLimit,
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
