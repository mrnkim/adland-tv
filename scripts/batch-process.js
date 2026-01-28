import 'dotenv/config';
import { TwelveLabs } from 'twelvelabs-js';
import fs from 'fs';
import path from 'path';
import { File } from 'buffer';
import { execSync } from 'child_process';

const client = new TwelveLabs({ apiKey: process.env.TWELVELABS_API_KEY });
const indexId = process.env.NEXT_PUBLIC_INDEX_ID;
const downloadsDir = path.join(process.cwd(), 'downloads');

// Read video data
const videos = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', 'video-data.json'), 'utf-8'));

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '-').toLowerCase();
}

async function downloadVideo(youtubeUrl, filename) {
  const outputPath = path.join(downloadsDir, `${filename}.mp4`);

  if (fs.existsSync(outputPath)) {
    console.log(`   ✓ Already downloaded: ${filename}`);
    return outputPath;
  }

  console.log(`   Downloading from YouTube...`);
  try {
    execSync(`yt-dlp -f "best[ext=mp4]/best" -o "${outputPath}" "${youtubeUrl}"`, {
      stdio: 'inherit'
    });
    return outputPath;
  } catch (error) {
    console.error(`   ✗ Failed to download: ${youtubeUrl}`);
    return null;
  }
}

async function uploadAndAnalyze(videoPath, metadata) {
  // Read file and create File object
  const fileBuffer = fs.readFileSync(videoPath);
  const fileName = `${metadata.title}.mp4`;
  const videoFile = new File([fileBuffer], fileName, { type: 'video/mp4' });

  // Upload
  console.log(`   Uploading to TwelveLabs...`);
  const taskResponse = await client.tasks.create({
    indexId: indexId,
    videoFile: videoFile,
    enableVideoStream: true,
    userMetadata: JSON.stringify({
      title: metadata.title,
      collection: 'superbowl',
      brand: metadata.brand,
      source_url: `https://adland.tv/${metadata.slug}`
    })
  });

  const taskId = taskResponse.id;

  // Wait for indexing
  console.log(`   Indexing...`);
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
  console.log(`   Video ID: ${videoId}`);

  // Analyze
  console.log(`   Analyzing...`);
  const analysisResponse = await client.analyze({
    videoId: videoId,
    prompt: 'Analyze this advertisement and generate structured metadata tags. Use the predefined options when possible.',
    temperature: 0.2,
    responseFormat: {
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
            enum: ["Auto", "CPG", "Tech", "Finance", "Insurance", "Healthcare", "Retail", "Food & Beverage", "Entertainment", "Sports", "Travel", "Telecom", "Beauty", "Fashion", "Alcohol", "Luxury", "Education", "Other"]
          },
          era_decade: {
            type: "string",
            enum: ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]
          },
          celebrities: {
            type: "string",
            description: "Any celebrities featured"
          }
        }
      }
    }
  });

  const tags = JSON.parse(analysisResponse.data);
  console.log(`   Tags: ${JSON.stringify(tags)}`);

  // Prepare final metadata
  const flatMetadata = { ...metadata };
  if (Array.isArray(flatMetadata.adland_tags)) {
    flatMetadata.adland_tags = flatMetadata.adland_tags.join(', ');
  }
  delete flatMetadata.celebrities_hint;
  delete flatMetadata.youtube_url;
  delete flatMetadata.slug;

  const finalMetadata = {
    ...flatMetadata,
    source_url: `https://adland.tv/${metadata.slug}`,
    youtube_url: metadata.youtube_url,
    collection: 'superbowl',
    author: 'Lori Luechtefeld',
    ...tags,
    analyzed_at: new Date().toISOString()
  };

  // Update metadata
  await client.indexes.videos.update(indexId, videoId, {
    userMetadata: finalMetadata
  });

  console.log(`   ✓ Done!`);
  return videoId;
}

async function processVideo(video, index, total) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${index + 1}/${total}] ${video.title}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Download
    const filename = sanitizeFilename(video.title);
    const videoPath = await downloadVideo(video.youtube_url, filename);

    if (!videoPath) {
      console.log(`   ✗ Skipping - download failed`);
      return null;
    }

    // Upload and analyze
    const videoId = await uploadAndAnalyze(videoPath, video);
    return videoId;
  } catch (error) {
    console.error(`   ✗ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🎬 Super Bowl LX Batch Upload Script');
  console.log(`   Index ID: ${indexId}`);
  console.log(`   Videos to process: ${videos.length}`);

  const results = [];

  for (let i = 0; i < videos.length; i++) {
    const result = await processVideo(videos[i], i, videos.length);
    results.push({
      title: videos[i].title,
      videoId: result,
      success: !!result
    });
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Summary');
  console.log(`${'='.repeat(60)}`);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✓ Successful: ${successful}`);
  console.log(`✗ Failed: ${failed}`);

  results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    console.log(`  ${status} ${r.title}`);
  });
}

main().catch(console.error);
