import { NextRequest, NextResponse } from 'next/server';
import { TwelveLabs } from 'twelvelabs-js';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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

    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const imageUrl = formData.get('imageUrl') as string | null;
    const pageLimit = parseInt(formData.get('pageLimit') as string) || 50;
    const pageToken = formData.get('pageToken') as string | null;

    const client = new TwelveLabs({ apiKey });

    let searchResponse;
    let tempFilePath: string | null = null;

    if (pageToken) {
      // Fetch a specific page using the page token
      searchResponse = await client.search.retrieve(pageToken);
    } else {
      if (!imageFile && !imageUrl) {
        return NextResponse.json(
          { error: 'Image file or URL is required' },
          { status: 400 }
        );
      }

      // Build search parameters
      const searchParams: any = {
        indexId,
        queryMediaType: 'image',
        searchOptions: ['visual'],
        pageLimit,
      };

      // Use URL if provided, otherwise use file
      if (imageUrl) {
        searchParams.queryMediaUrl = imageUrl;
      } else if (imageFile) {
        // Save to temp file and use createReadStream (SDK requirement)
        const arrayBuffer = await imageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        tempFilePath = join(tmpdir(), `image-search-${Date.now()}-${imageFile.name}`);
        await writeFile(tempFilePath, buffer);
        searchParams.queryMediaFile = createReadStream(tempFilePath);
      }

      // Perform image search
      searchResponse = await client.search.create(searchParams);

      // Clean up temp file
      if (tempFilePath) {
        try {
          await unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    const allResults = searchResponse.data || [];

    const totalResults = searchResponse.pageInfo?.totalResults ?? allResults.length;

    // Fetch video details for each result
    const resultsWithDetails = await Promise.all(
      allResults.map(async (result: any) => {
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

    return NextResponse.json({
      pageInfo: {
        total_results: searchResponse.pageInfo?.totalResults ?? resultsWithDetails.length,
        next_page_token: searchResponse.pageInfo?.nextPageToken ?? null,
        limit_per_page: searchResponse.pageInfo?.limitPerPage ?? pageLimit,
      },
      results: resultsWithDetails,
    });
  } catch (error) {
    console.error('Image search API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
