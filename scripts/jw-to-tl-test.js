#!/usr/bin/env node
/**
 * Test: JW Player → TwelveLabs URL upload pipeline
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

// ── Step 1: Fetch JW Player CDN JSON ─────────────────────────────────────────
async function fetchJWMedia(mediaId) {
  const url = `https://cdn.jwplayer.com/v2/media/${mediaId}`;
  console.log(`[1/3] Fetching JW Player metadata: ${url}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`JW Player CDN returned ${res.status}`);

  const data = await res.json();
  const item = data.playlist[0];

  const mp4Sources = item.sources
    .filter(s => s.type === 'video/mp4' && s.file)
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const hlsSource = item.sources.find(s => s.type === 'application/vnd.apple.mpegurl');
  const bestMp4 = mp4Sources[0];

  console.log(`  Title: ${item.title}`);
  console.log(`  Duration: ${item.duration}s`);
  console.log(`  Best MP4: ${bestMp4?.label || 'N/A'} → ${bestMp4?.file}`);

  return {
    title: item.title,
    duration: item.duration,
    mediaId: item.mediaid,
    mp4Url: bestMp4?.file,
    hlsUrl: hlsSource?.file,
    thumbnail: item.image,
  };
}

// ── Step 2: Upload via URL + Index ───────────────────────────────────────────
async function uploadAndIndex(videoUrl, title) {
  console.log(`[2/3] Indexing via URL (no download needed)...`);
  console.log(`  URL: ${videoUrl}`);

  const task = await client.tasks.create({
    indexId: INDEX_ID,
    videoUrl: videoUrl,
    enableVideoStream: true,
  });
  console.log(`  Task ID: ${task.id}`);

  // Wait for indexing
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

// ── Step 3: Update metadata ─────────────────────────────────────────────────
async function updateMetadata(videoId, jwMeta) {
  console.log(`[3/3] Updating metadata...`);

  const metadata = {
    title: jwMeta.title,
    jw_media_id: jwMeta.mediaId,
    jw_player_id: JW_PLAYER_ID,
    jw_thumbnail: jwMeta.thumbnail,
    source: 'jwplayer',
    collection: 'superbowl',
    indexed_at: new Date().toISOString(),
  };

  await client.indexes.videos.update(INDEX_ID, videoId, {
    userMetadata: metadata,
  });

  console.log(`  Metadata saved: ${JSON.stringify(metadata, null, 2)}`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(50));
  console.log('JW Player → TwelveLabs URL Upload Test');
  console.log('='.repeat(50));
  console.log(`Media ID:  ${mediaId}`);
  console.log(`Index ID:  ${INDEX_ID}`);
  console.log();

  const jwMeta = await fetchJWMedia(mediaId);
  const videoId = await uploadAndIndex(jwMeta.mp4Url, jwMeta.title);
  await updateMetadata(videoId, jwMeta);

  console.log();
  console.log('='.repeat(50));
  console.log('SUCCESS');
  console.log(`  JW Media ID:  ${mediaId}`);
  console.log(`  TL Video ID:  ${videoId}`);
  console.log(`  Title:        ${jwMeta.title}`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
