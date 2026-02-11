#!/usr/bin/env node
/**
 * JW Player → TwelveLabs: URL upload + AI analysis pipeline
 * Usage: node scripts/jw-to-tl-test.js tNNiIpzO
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { TwelveLabs } from 'twelvelabs-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const INDEX_ID = process.env.NEXT_PUBLIC_INDEX_ID;
const JW_PLAYER_ID = '19i2Zbpi';
const client = new TwelveLabs({ apiKey: process.env.TWELVELABS_API_KEY });

const mediaId = process.argv[2];
if (!mediaId) {
  console.error('Usage: node scripts/jw-to-tl-test.js <jwMediaId>');
  process.exit(1);
}

// ── Analysis Schema (same as adland-agent) ───────────────────────────────────
const ANALYSIS_SCHEMA = {
  type: "json_schema",
  jsonSchema: {
    type: "object",
    properties: {
      brand: {
        type: "string",
        description: "The brand or company featured in the ad"
      },
      theme: {
        type: "string",
        enum: ["Humor", "Emotional", "Inspirational", "Educational", "Dramatic", "Nostalgic", "Adventurous", "Romantic", "Celebratory", "Empowering"]
      },
      emotion: {
        type: "string",
        enum: ["Happy", "Sad", "Exciting", "Calming", "Suspenseful", "Heartwarming", "Confident", "Playful", "Hopeful", "Nostalgic", "Empowering"]
      },
      visual_style: {
        type: "string",
        enum: ["Cinematic", "Animated", "Documentary", "Minimalist", "Bold/Colorful", "Black & White", "Retro", "High-energy", "Lifestyle", "Glamorous", "Artistic"]
      },
      sentiment: {
        type: "string",
        enum: ["Positive", "Neutral", "Provocative", "Negative"]
      },
      product_category: {
        type: "string",
        enum: ["Auto", "Tech", "Finance", "Insurance", "Healthcare", "Retail", "Food & Beverage", "Household & Personal Care", "Entertainment", "Sports", "Travel", "Telecom", "Beauty", "Fashion", "Luxury", "Education", "Other"]
      },
      era_decade: {
        type: "string",
        enum: ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]
      },
      celebrities: {
        type: "string",
        description: "Any celebrities featured (empty string if none)"
      }
    }
  }
};

// ── Dedup Check ──────────────────────────────────────────────────────────────
async function checkExisting(jwMediaId) {
  console.log(`[0/4] Checking for existing video with jw_media_id=${jwMediaId}...`);

  let page = 1;
  while (true) {
    const res = await client.indexes.videos.list(INDEX_ID, { page, pageLimit: 50 });
    for (const v of res.data) {
      // SDK returns user_metadata (snake_case)
      const meta = v.user_metadata || v.userMetadata;
      if (meta?.jw_media_id === jwMediaId) {
        return { id: v.id, meta };
      }
    }
    if (!res.pageInfo || page >= res.pageInfo.totalPage) break;
    page++;
  }
  return null;
}

// ── Step 1: Fetch JW Player CDN JSON ─────────────────────────────────────────
async function fetchJWMedia(mediaId) {
  const url = `https://cdn.jwplayer.com/v2/media/${mediaId}`;
  console.log(`[1/4] Fetching JW Player metadata: ${url}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`JW Player CDN returned ${res.status}`);

  const data = await res.json();
  const item = data.playlist[0];

  const mp4Sources = item.sources
    .filter(s => s.type === 'video/mp4' && s.file)
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const bestMp4 = mp4Sources[0];

  console.log(`  Title: ${item.title}`);
  console.log(`  Duration: ${item.duration}s`);
  console.log(`  Best MP4: ${bestMp4?.label || 'N/A'} → ${bestMp4?.file}`);

  return {
    title: item.title,
    duration: item.duration,
    mediaId: item.mediaid,
    mp4Url: bestMp4?.file,
    thumbnail: item.image,
  };
}

// ── Step 2: Upload via URL + Index ───────────────────────────────────────────
async function uploadAndIndex(videoUrl, jwMeta) {
  console.log(`[2/4] Indexing via URL...`);

  const task = await client.tasks.create({
    indexId: INDEX_ID,
    videoUrl: videoUrl,
    enableVideoStream: true,
    userMetadata: JSON.stringify({
      title: jwMeta.title,
      jw_media_id: jwMeta.mediaId,
      source: 'jwplayer',
    }),
  });
  console.log(`  Task ID: ${task.id}`);

  let status = task.status;
  while (status !== 'ready' && status !== 'failed') {
    await new Promise(r => setTimeout(r, 5000));
    const updated = await client.tasks.retrieve(task.id);
    status = updated.status;
    process.stdout.write('.');
  }
  console.log('');

  if (status === 'failed') throw new Error('Indexing failed');

  const result = await client.tasks.retrieve(task.id);
  console.log(`  Video ID: ${result.videoId}`);
  return result.videoId;
}

// ── Step 3: AI Analysis ─────────────────────────────────────────────────────
async function analyzeVideo(videoId) {
  console.log(`[3/4] Running AI analysis...`);

  let tags = {};
  try {
    const response = await client.analyze({
      videoId,
      prompt: 'Analyze this advertisement and generate structured metadata tags.',
      temperature: 0.2,
      responseFormat: ANALYSIS_SCHEMA,
    });
    tags = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    console.log(`  Brand: ${tags.brand || 'N/A'}`);
    console.log(`  Theme: ${tags.theme}, Emotion: ${tags.emotion}`);
    console.log(`  Category: ${tags.product_category}, Style: ${tags.visual_style}`);
    console.log(`  Sentiment: ${tags.sentiment}, Era: ${tags.era_decade}`);
    if (tags.celebrities) console.log(`  Celebrities: ${tags.celebrities}`);
  } catch (err) {
    console.error(`  Analysis failed (continuing without tags): ${err.message}`);
  }

  return tags;
}

// ── Step 4: Update metadata ─────────────────────────────────────────────────
async function updateMetadata(videoId, jwMeta, aiTags) {
  console.log(`[4/4] Updating metadata...`);

  const metadata = {
    title: jwMeta.title,
    brand: aiTags.brand || '',
    collection: 'superbowl',
    source: 'jwplayer',
    jw_media_id: jwMeta.mediaId,
    jw_player_id: JW_PLAYER_ID,
    jw_thumbnail: jwMeta.thumbnail,
    // AI analysis tags
    ...aiTags,
    analyzed_at: new Date().toISOString(),
  };

  await client.indexes.videos.update(INDEX_ID, videoId, {
    userMetadata: metadata,
  });

  console.log(`  Metadata saved`);
  return metadata;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(50));
  console.log('JW Player → TwelveLabs Full Pipeline');
  console.log('='.repeat(50));
  console.log(`Media ID:  ${mediaId}`);
  console.log(`Index ID:  ${INDEX_ID}`);
  console.log();

  // Check for duplicates first
  const existing = await checkExisting(mediaId);
  if (existing) {
    console.log(`  ALREADY EXISTS → Video ID: ${existing.id}`);
    console.log(`  Title: ${existing.meta?.title || 'N/A'}`);
    console.log(`  Has AI tags: ${existing.meta?.brand ? 'Yes' : 'No'}`);
    console.log('  Skipping upload. Use --force to re-process.');
    if (!process.argv.includes('--force')) {
      return;
    }
    console.log('  --force flag detected, deleting existing and re-processing...');
    await client.indexes.videos.delete(INDEX_ID, existing.id);
    console.log(`  Deleted ${existing.id}`);
  }

  const jwMeta = await fetchJWMedia(mediaId);
  const videoId = await uploadAndIndex(jwMeta.mp4Url, jwMeta);
  const aiTags = await analyzeVideo(videoId);
  const finalMeta = await updateMetadata(videoId, jwMeta, aiTags);

  console.log();
  console.log('='.repeat(50));
  console.log('SUCCESS');
  console.log(`  JW Media ID:  ${mediaId}`);
  console.log(`  TL Video ID:  ${videoId}`);
  console.log(`  Title:        ${jwMeta.title}`);
  console.log(`  Brand:        ${finalMeta.brand}`);
  console.log(`  Tags:         ${finalMeta.theme} / ${finalMeta.emotion} / ${finalMeta.product_category}`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
