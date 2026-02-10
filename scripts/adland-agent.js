#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TwelveLabs } from 'twelvelabs-js';
import { execSync } from 'child_process';
import { File } from 'buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'app', '.env') });

const client = new TwelveLabs({ apiKey: process.env.TWELVELABS_API_KEY });
const indexId = process.env.NEXT_PUBLIC_INDEX_ID;
const downloadsDir = path.join(__dirname, '..', 'downloads');
const progressDir = path.join(__dirname, '..', '.progress');
const RSS_URL = 'https://adland.tv/rss.xml';

// ── CLI Args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1] || true;
}
const TAG = getArg('tag');
const DRY_RUN = args.includes('--dry-run');
const LIMIT = getArg('limit') ? parseInt(getArg('limit'), 10) : Infinity;
const RESET = args.includes('--reset');

if (!TAG) {
  console.log(`Usage: node adland-agent.js --tag <tag-slug> [--dry-run] [--limit N] [--reset]

Examples:
  node adland-agent.js --tag "2026-super-bowl-lx-commercials" --dry-run
  node adland-agent.js --tag "2026-super-bowl-lx-commercials" --limit 5
  node adland-agent.js --tag "2026-super-bowl-lx-commercials" --reset  # clear progress
`);
  process.exit(1);
}

// ── Progress Tracking ─────────────────────────────────────────────────────────
function getProgressPath(tag) {
  return path.join(progressDir, `${tag}.json`);
}

function loadProgress(tag) {
  const p = getProgressPath(tag);
  if (!fs.existsSync(p)) return { completed: [], failed: [], startedAt: null };
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveProgress(tag, progress) {
  if (!fs.existsSync(progressDir)) fs.mkdirSync(progressDir, { recursive: true });
  fs.writeFileSync(getProgressPath(tag), JSON.stringify(progress, null, 2));
}

function saveHandoff(tag, progress, stats) {
  const handoffPath = path.join(progressDir, `${tag}-handoff.md`);
  const completedList = progress.completed.map(v => `- [x] ${v.title} (${v.videoId})`).join('\n');
  const failedList = progress.failed.map(v => `- [ ] ${v.title} (${v.reason})`).join('\n');
  const pendingList = (stats.pending || []).map(v => `- [ ] ${v.title}`).join('\n');

  const content = `# Handoff: adland-agent --tag "${tag}"

## Status
- **Started:** ${progress.startedAt || 'N/A'}
- **Last updated:** ${new Date().toISOString()}
- **Completed:** ${progress.completed.length}
- **Failed:** ${progress.failed.length}
- **Pending:** ${stats.pending?.length || 0}

## Resume Command
\`\`\`bash
node scripts/adland-agent.js --tag "${tag}"
\`\`\`

## Completed
${completedList || '(none)'}

## Failed
${failedList || '(none)'}

## Pending
${pendingList || '(none)'}
`;
  fs.writeFileSync(handoffPath, content);
  console.log(`\nHandoff saved: ${handoffPath}`);
}

// ── RSS Parsing ───────────────────────────────────────────────────────────────
async function fetchRSSItems() {
  console.log(`Fetching RSS from ${RSS_URL}...`);
  const res = await fetch(RSS_URL);
  const xml = await res.text();

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
      return m ? m[1].trim() : '';
    };

    const link = get('link');
    const slug = link.replace('https://adland.tv/', '');

    items.push({
      title: get('title').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
      link,
      slug,
      description: get('description').replace(/&apos;/g, "'").replace(/&amp;/g, '&'),
      pubDate: get('pubDate'),
      author: get('author')
    });
  }

  return items;
}

// ── Tag Filtering ─────────────────────────────────────────────────────────────
function filterByTag(items, tag) {
  // Convert tag slug to keywords: "2026-super-bowl-lx-commercials" → ["super", "bowl"]
  const keywords = tag.toLowerCase().split('-').filter(w => w.length > 2 && !['commercials', 'the', 'and'].includes(w));

  return items.filter(item => {
    const titleLower = item.title.toLowerCase();
    const slugLower = item.slug.toLowerCase();
    // Match if title or slug contains most keywords
    const matchCount = keywords.filter(kw => titleLower.includes(kw) || slugLower.includes(kw)).length;
    return matchCount >= Math.min(2, keywords.length);
  });
}

// ── Deduplication ─────────────────────────────────────────────────────────────
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function deduplicateRSSItems(items) {
  const seen = new Map();
  const unique = [];

  for (const item of items) {
    const norm = normalizeTitle(item.title);
    // Prefer shorter slugs (ones without trailing numbers like "...20262")
    if (seen.has(norm)) {
      const existing = seen.get(norm);
      if (item.slug.length < existing.slug.length) {
        // Replace with the cleaner slug
        const idx = unique.indexOf(existing);
        unique[idx] = item;
        seen.set(norm, item);
      }
    } else {
      seen.set(norm, item);
      unique.push(item);
    }
  }

  return unique;
}

// ── TwelveLabs Index Query ────────────────────────────────────────────────────
async function fetchIndexedVideos() {
  console.log('Fetching existing videos from TwelveLabs index...');
  const allVideos = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetch(
      `https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos?page=${page}&page_limit=50`,
      { headers: { 'x-api-key': process.env.TWELVELABS_API_KEY } }
    );
    const data = await response.json();
    allVideos.push(...(data.data || []));
    totalPages = data.page_info?.total_page || 1;
    page++;
  } while (page <= totalPages);

  console.log(`  Found ${allVideos.length} existing videos in index`);
  return allVideos;
}

function findNewVideos(rssItems, indexedVideos) {
  // Build sets for matching
  const indexedSlugs = new Set();
  const indexedTitles = new Set();

  for (const v of indexedVideos) {
    const meta = v.user_metadata || {};
    if (meta.source_url) {
      const slug = meta.source_url.replace('https://adland.tv/', '');
      indexedSlugs.add(slug);
    }
    if (meta.title) {
      indexedTitles.add(normalizeTitle(meta.title));
    }
    // Also check system video title
    if (v.system_metadata?.video_title) {
      indexedTitles.add(normalizeTitle(v.system_metadata.video_title));
    }
  }

  return rssItems.filter(item => {
    if (indexedSlugs.has(item.slug)) return false;
    if (indexedTitles.has(normalizeTitle(item.title))) return false;
    return true;
  });
}

// ── Brand Extraction ──────────────────────────────────────────────────────────
function extractBrand(title) {
  // Strip "Super Bowl" suffix first to avoid matching colons in subtitles
  const cleaned = title.replace(/\s*-?\s*Super Bowl.*$/i, '');

  // Pattern 1: "Brand: Subtitle"
  const colonMatch = cleaned.match(/^([^:]+):/);
  if (colonMatch) return colonMatch[1].trim();

  // Pattern 2: "Brand - Subtitle"
  const dashMatch = cleaned.match(/^(.+?)\s+-\s+/);
  if (dashMatch) return dashMatch[1].trim();

  // Pattern 3: Just the cleaned title itself (e.g. "Wegovy")
  return cleaned.trim() || 'Unknown';
}

// ── Adland Tags ───────────────────────────────────────────────────────────────
function inferAdlandTags(title, tag) {
  const tags = [];
  if (/super\s*bowl/i.test(title) && /2026|lx/i.test(title + tag)) {
    tags.push('2026 Super Bowl LX');
  }
  return tags;
}

// ── Download ──────────────────────────────────────────────────────────────────
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 100);
}

function downloadVideo(title, filename) {
  const outputPath = path.join(downloadsDir, `${filename}.mp4`);

  if (fs.existsSync(outputPath)) {
    console.log(`  Already downloaded: ${filename}`);
    return outputPath;
  }

  console.log(`  Searching YouTube for: ${title}`);
  try {
    execSync(
      `yt-dlp -f "best[ext=mp4]/best" --no-playlist -o "${outputPath}" "ytsearch1:${title.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe', timeout: 120000 }
    );
    if (fs.existsSync(outputPath)) {
      const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
      console.log(`  Downloaded: ${sizeMB}MB`);
      return outputPath;
    }
    return null;
  } catch (error) {
    console.error(`  Download failed: ${error.message?.split('\n')[0]}`);
    return null;
  }
}

// ── Upload & Analyze ──────────────────────────────────────────────────────────
const ANALYSIS_SCHEMA = {
  type: "json_schema",
  jsonSchema: {
    type: "object",
    properties: {
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

async function uploadAndAnalyze(videoPath, metadata) {
  // Upload
  console.log(`  Uploading to TwelveLabs...`);
  const fileBuffer = fs.readFileSync(videoPath);
  const videoFile = new File([fileBuffer], `${metadata.title}.mp4`, { type: 'video/mp4' });

  const taskResponse = await client.tasks.create({
    indexId,
    videoFile,
    enableVideoStream: true,
    userMetadata: JSON.stringify({
      title: metadata.title,
      collection: 'superbowl',
      brand: metadata.brand,
      source_url: metadata.source_url
    })
  });

  const taskId = taskResponse.id;

  // Wait for indexing
  console.log(`  Indexing (task: ${taskId})...`);
  let task = await client.tasks.retrieve(taskId);
  while (task.status !== 'ready' && task.status !== 'failed') {
    await new Promise(r => setTimeout(r, 5000));
    task = await client.tasks.retrieve(taskId);
    process.stdout.write('.');
  }
  console.log('');

  if (task.status === 'failed') {
    throw new Error('Indexing failed');
  }

  const videoId = task.videoId;
  console.log(`  Video ID: ${videoId}`);

  // Analyze
  console.log(`  Analyzing...`);
  let tags = {};
  try {
    const analysisResponse = await client.analyze({
      videoId,
      prompt: 'Analyze this advertisement and generate structured metadata tags.',
      temperature: 0.2,
      responseFormat: ANALYSIS_SCHEMA
    });
    tags = typeof analysisResponse.data === 'string' ? JSON.parse(analysisResponse.data) : analysisResponse.data;
    console.log(`  Tags: ${JSON.stringify(tags)}`);
  } catch (err) {
    console.error(`  Analysis failed (continuing without tags): ${err.message}`);
  }

  // Update metadata
  const finalMetadata = {
    title: metadata.title,
    brand: metadata.brand,
    collection: 'superbowl',
    source_url: metadata.source_url,
    author: metadata.author || 'Lori Luechtefeld',
    adland_tags: metadata.adland_tags.join(', '),
    ...tags,
    analyzed_at: new Date().toISOString()
  };

  await client.indexes.videos.update(indexId, videoId, {
    userMetadata: finalMetadata
  });

  console.log(`  Metadata updated`);
  return videoId;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('AdLand.TV Video Ingest Agent');
  console.log('='.repeat(60));
  console.log(`Tag:      ${TAG}`);
  console.log(`Index:    ${indexId}`);
  console.log(`Dry run:  ${DRY_RUN}`);
  console.log(`Limit:    ${LIMIT === Infinity ? 'none' : LIMIT}`);

  // Load or reset progress
  if (RESET) {
    const p = getProgressPath(TAG);
    if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('Progress reset.'); }
  }
  const progress = loadProgress(TAG);
  if (progress.completed.length > 0) {
    console.log(`Resuming: ${progress.completed.length} already completed, ${progress.failed.length} failed`);
  }
  console.log('');

  // Step 1: Fetch RSS
  const allItems = await fetchRSSItems();
  console.log(`RSS items: ${allItems.length} total`);

  // Step 2: Filter by tag
  const tagged = filterByTag(allItems, TAG);
  console.log(`Matching tag "${TAG}": ${tagged.length} items`);

  // Step 3: Deduplicate RSS items
  const unique = deduplicateRSSItems(tagged);
  if (unique.length < tagged.length) {
    console.log(`After dedup: ${unique.length} items (removed ${tagged.length - unique.length} duplicates)`);
  }

  // Step 4: Check existing index
  const indexed = await fetchIndexedVideos();
  const newVideos = findNewVideos(unique, indexed);

  // Step 4b: Also filter out videos completed in progress file
  const completedSlugs = new Set(progress.completed.map(v => v.slug));
  const remaining = newVideos.filter(v => !completedSlugs.has(v.slug));
  console.log(`New videos to process: ${remaining.length}${newVideos.length !== remaining.length ? ` (${newVideos.length - remaining.length} already done in progress)` : ''}`);

  if (remaining.length === 0) {
    console.log('\nAll videos already indexed!');
    saveHandoff(TAG, progress, { pending: [] });
    return;
  }

  // Show what we found
  console.log('\n--- New Videos ---');
  const toProcess = remaining.slice(0, LIMIT);
  toProcess.forEach((v, i) => {
    console.log(`${i + 1}. ${v.title}`);
    console.log(`   Slug:  ${v.slug}`);
    console.log(`   Brand: ${extractBrand(v.title)}`);
  });

  if (remaining.length > LIMIT) {
    console.log(`\n... and ${remaining.length - LIMIT} more (use --limit to increase)`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No videos downloaded or uploaded.');
    saveHandoff(TAG, progress, { pending: remaining });
    return;
  }

  // Step 5: Process videos
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  if (!progress.startedAt) progress.startedAt = new Date().toISOString();

  const results = [];
  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const brand = extractBrand(item.title);
    const adlandTags = inferAdlandTags(item.title, TAG);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${toProcess.length}] ${item.title}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Download
      const filename = sanitizeFilename(item.title);
      const videoPath = downloadVideo(item.title, filename);

      if (!videoPath) {
        console.log(`  SKIP - download failed`);
        const entry = { title: item.title, slug: item.slug, reason: 'download failed' };
        progress.failed.push(entry);
        results.push({ ...entry, success: false });
        saveProgress(TAG, progress);
        continue;
      }

      // Upload & analyze
      const videoId = await uploadAndAnalyze(videoPath, {
        title: item.title,
        brand,
        source_url: item.link,
        author: item.author,
        adland_tags: adlandTags,
        description: item.description
      });

      const entry = { title: item.title, slug: item.slug, videoId, completedAt: new Date().toISOString() };
      progress.completed.push(entry);
      results.push({ ...entry, success: true });
      saveProgress(TAG, progress);
    } catch (error) {
      console.error(`  ERROR: ${error.message}`);
      const entry = { title: item.title, slug: item.slug, reason: error.message };
      progress.failed.push(entry);
      results.push({ ...entry, success: false });
      saveProgress(TAG, progress);
    }
  }

  // Summary
  const pendingAfter = remaining.slice(LIMIT);
  saveHandoff(TAG, progress, { pending: pendingAfter });

  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary');
  console.log(`${'='.repeat(60)}`);
  const ok = results.filter(r => r.success).length;
  const fail = results.filter(r => !r.success).length;
  console.log(`Successful: ${ok}`);
  console.log(`Failed:     ${fail}`);
  console.log(`Remaining:  ${pendingAfter.length}`);
  results.forEach(r => {
    console.log(`  ${r.success ? 'OK' : 'FAIL'} ${r.title}${r.reason ? ` (${r.reason})` : ''}`);
  });

  if (pendingAfter.length > 0) {
    console.log(`\nResume with: node scripts/adland-agent.js --tag "${TAG}"`);
  }
  console.log(`Total progress: ${progress.completed.length} completed, ${progress.failed.length} failed`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
