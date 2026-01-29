import { NextRequest, NextResponse } from 'next/server';
import { TwelveLabs } from 'twelvelabs-js';
import { Readable } from 'stream';
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

    if (!imageFile && !imageUrl) {
      return NextResponse.json(
        { error: 'Image file or URL is required' },
        { status: 400 }
      );
    }

    const client = new TwelveLabs({ apiKey });

    // Build search parameters
    const searchParams: any = {
      indexId,
      queryMediaType: 'image',
      searchOptions: ['visual'],
      pageLimit,
    };

    // Use URL if provided, otherwise use file
    let tempFilePath: string | null = null;

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
    const searchResults = await client.search.query(searchParams);

    // Collect results
    const allResults: any[] = [];
    for await (const clip of searchResults) {
      allResults.push(clip);
      if (allResults.length >= pageLimit) break;
    }

    // Clean up temp file after results are collected
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Fetch video details for each result
    const resultsWithDetails = await Promise.all(
      allResults.map(async (result: any) => {
        try {
          const videoResponse = await fetch(
            `https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos/${result.videoId}`,
            { headers: { 'x-api-key': apiKey } }
          );

          if (videoResponse.ok) {
            const videoData = await videoResponse.json();
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

    return NextResponse.json({
      pageInfo: {
        page: 1,
        total_page: 1,
        total_results: resultsWithDetails.length,
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
