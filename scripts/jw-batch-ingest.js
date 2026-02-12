#!/usr/bin/env node
/**
 * JW Player → TwelveLabs: Batch ingest pipeline
 * Reads manifest from jw-batch-manifest.json, processes each video:
 *   1. Dedup check (skip if already indexed)
 *   2. Fetch JW Player CDN metadata + best MP4 URL
 *   3. Upload to TwelveLabs via URL
 *   4. AI analysis (brand, theme, emotion, etc.)
 *   5. Update metadata with JW + AI tags
 *
 * Usage:
 *   node scripts/jw-batch-ingest.js              # process all
 *   node scripts/jw-batch-ingest.js --limit 5    # process first 5 unfinished
 *   node scripts/jw-batch-ingest.js --resume     # skip completed (default)
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TwelveLabs } from 'twelvelabs-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const INDEX_ID = process.env.NEXT_PUBLIC_INDEX_ID;
const JW_PLAYER_ID = '19i2Zbpi';
const client = new TwelveLabs({ apiKey: process.env.TWELVELABS_API_KEY });

const PROGRESS_FILE = path.join(__dirname, '..', '.progress', 'jw-batch-progress.json');
const MANIFEST_FILE = path.join(__dirname, 'jw-batch-manifest.json');

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// ── Progress tracking ───────────────────────────────────────────────────────
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Analysis Schema ─────────────────────────────────────────────────────────
const ANALYSIS_SCHEMA = {
  type: "json_schema",
  jsonSchema: {
    type: "object",
    properties: {
      brand: { type: "string", description: "The brand or company featured in the ad" },
      theme: { type: "string", enum: ["Humor", "Emotional", "Inspirational", "Educational", "Dramatic", "Nostalgic", "Adventurous", "Romantic", "Celebratory", "Empowering"] },
      emotion: { type: "string", enum: ["Happy", "Sad", "Exciting", "Calming", "Suspenseful", "Heartwarming", "Confident", "Playful", "Hopeful", "Nostalgic", "Empowering"] },
      visual_style: { type: "string", enum: ["Cinematic", "Animated", "Documentary", "Minimalist", "Bold/Colorful", "Black & White", "Retro", "High-energy", "Lifestyle", "Glamorous", "Artistic"] },
      sentiment: { type: "string", enum: ["Positive", "Neutral", "Provocative", "Negative"] },
      product_category: { type: "string", enum: ["Auto", "Tech", "Finance", "Insurance", "Healthcare", "Retail", "Food & Beverage", "Household & Personal Care", "Entertainment", "Sports", "Travel", "Telecom", "Beauty", "Fashion", "Luxury", "Education", "Other"] },
      era_decade: { type: "string", enum: ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"] },
      celebrities: { type: "string", description: "Any celebrities featured (empty string if none)" },
    },
  },
};

// ── Pipeline steps ──────────────────────────────────────────────────────────

async function fetchJWMedia(mediaId) {
  const url = `https://cdn.jwplayer.com/v2/media/${mediaId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JW CDN ${res.status}`);
  const data = await res.json();
  const item = data.playlist[0];

  const mp4Sources = item.sources
    .filter(s => s.type === 'video/mp4' && s.file)
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  return {
    title: item.title,
    duration: item.duration,
    mediaId: item.mediaid,
    mp4Url: mp4Sources[0]?.file,
    thumbnail: item.image,
  };
}

async function uploadAndIndex(videoUrl, jwMeta) {
  const task = await client.tasks.create({
    indexId: INDEX_ID,
    videoUrl,
    enableVideoStream: true,
    userMetadata: JSON.stringify({
      title: jwMeta.title,
      jw_media_id: jwMeta.mediaId,
      source: 'jwplayer',
    }),
  });

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
  return result.videoId;
}

async function analyzeVideo(videoId) {
  try {
    const response = await client.analyze(
      {
        videoId,
        prompt: 'Analyze this advertisement and generate structured metadata tags.',
        temperature: 0.2,
        responseFormat: ANALYSIS_SCHEMA,
      },
      { timeoutInSeconds: 120 },
    );
    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  } catch (err) {
    console.log(`    Analysis failed: ${err.message}`);
    return {};
  }
}

async function updateMetadata(videoId, jwMeta, aiTags) {
  const metadata = {
    title: jwMeta.title,
    brand: aiTags.brand || '',
    ...(jwMeta.title.toLowerCase().includes('super bowl') ? { collection: 'superbowl' } : {}),
    source: 'jwplayer',
    jw_media_id: jwMeta.mediaId,
    jw_player_id: JW_PLAYER_ID,
    jw_thumbnail: jwMeta.thumbnail,
    ...aiTags,
    analyzed_at: new Date().toISOString(),
  };

  await client.indexes.videos.update(INDEX_ID, videoId, {
    userMetadata: metadata,
  });

  return metadata;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  const progress = loadProgress();

  console.log('='.repeat(60));
  console.log('JW Player → TwelveLabs Batch Ingest');
  console.log(`Index: ${INDEX_ID}`);
  console.log(`Total in manifest: ${manifest.length}`);
  console.log(`Already completed: ${Object.keys(progress).filter(k => progress[k].status === 'done').length}`);
  console.log(`Limit: ${LIMIT === Infinity ? 'none' : LIMIT}`);
  console.log('='.repeat(60));

  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of manifest) {
    if (processed >= LIMIT) break;

    // Skip already completed
    if (progress[item.id]?.status === 'done') {
      skipped++;
      continue;
    }

    processed++;
    console.log(`\n[${processed}/${Math.min(manifest.length, LIMIT)}] ${item.id} — ${item.title}`);

    try {
      // Step 1: Fetch JW metadata
      const jwMeta = await fetchJWMedia(item.id);
      if (!jwMeta.mp4Url) {
        console.log(`  SKIP: No MP4 URL available`);
        progress[item.id] = { status: 'skip', reason: 'no_mp4', title: jwMeta.title };
        saveProgress(progress);
        continue;
      }
      console.log(`  Duration: ${jwMeta.duration}s, MP4: ${jwMeta.mp4Url.substring(0, 60)}...`);

      // Step 2: Upload & index
      console.log(`  Indexing...`);
      const videoId = await uploadAndIndex(jwMeta.mp4Url, jwMeta);
      console.log(`  Video ID: ${videoId}`);

      // Step 3: AI analysis
      console.log(`  Analyzing...`);
      const aiTags = await analyzeVideo(videoId);
      if (aiTags.brand) {
        console.log(`  Brand: ${aiTags.brand} | ${aiTags.theme} | ${aiTags.emotion} | ${aiTags.product_category}`);
      }

      // Step 4: Update metadata
      await updateMetadata(videoId, jwMeta, aiTags);
      console.log(`  DONE`);

      progress[item.id] = {
        status: 'done',
        videoId,
        title: jwMeta.title,
        brand: aiTags.brand || '',
        completedAt: new Date().toISOString(),
      };
      saveProgress(progress);
      succeeded++;
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      progress[item.id] = {
        status: 'failed',
        error: err.message,
        title: item.title,
        failedAt: new Date().toISOString(),
      };
      saveProgress(progress);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('BATCH COMPLETE');
  console.log(`  Processed: ${processed}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Skipped:   ${skipped} (already done)`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error(`\nFATAL: ${err.message}`);
  process.exit(1);
});
