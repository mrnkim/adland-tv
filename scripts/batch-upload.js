import 'dotenv/config';
import { TwelveLabs } from 'twelvelabs-js';
import fs from 'fs';
import path from 'path';
import { File } from 'buffer';
import { execSync } from 'child_process';

const client = new TwelveLabs({ apiKey: process.env.TWELVELABS_API_KEY });
const indexId = process.env.NEXT_PUBLIC_INDEX_ID;
const downloadsDir = path.join(process.cwd(), 'downloads');

// Videos to process (excluding Fanatics which is already done)
const videos = [
  {
    slug: 'hellmanns-2026-big-game-longform-meal-diamond',
    title: "Hellmann's 2026 Big Game Longform - 'Meal Diamond'",
    brand: "Hellmann's",
    adland_tags: ["food", "2026 Super Bowl LX"]
  },
  {
    slug: 'instacart-goals-super-bowl-lx-official-teaser',
    title: "Instacart - Goals (Super Bowl LX - Official Teaser)",
    brand: "Instacart",
    adland_tags: ["food", "2026 Super Bowl LX"]
  },
  {
    slug: 'nfl-pre-release-inspire-change-special',
    title: "NFL: Pre-Release: Inspire Change: Special",
    brand: "NFL",
    adland_tags: ["sports", "2026 Super Bowl LX"]
  },
  {
    slug: 'budweiser-super-bowl-lx-commercial-american-icons2',
    title: "Budweiser - Super Bowl LX Commercial - 'American Icons'",
    brand: "Budweiser",
    adland_tags: ["drinks and alcohol", "2026 Super Bowl LX"]
  },
  {
    slug: 'turbotax-2026-super-bowl-teaser',
    title: "TurboTax 2026 Super Bowl Teaser",
    brand: "TurboTax",
    adland_tags: ["business and finance", "2026 Super Bowl LX"]
  },
  {
    slug: 'super-bowl-celeb-sightings-different-phases-of-fame-at-the-big-game',
    title: "Super Bowl Celeb Sightings: Different Phases of Fame at the Big Game",
    brand: "Various",
    adland_tags: ["celebrity", "2026 Super Bowl LX"]
  },
  {
    slug: 'pringles-super-bowl-2026-teaser-love-at-first-bite-featuring-sabrina-carpenter',
    title: "Pringles Super Bowl 2026 Teaser, 'Love at First Bite' Featuring Sabrina Carpenter",
    brand: "Pringles",
    adland_tags: ["food", "2026 Super Bowl LX"]
  },
  {
    slug: 'budweiser-super-bowl-2026-teaser-stable',
    title: "Budweiser Super Bowl 2026 Teaser, 'Stable'",
    brand: "Budweiser",
    adland_tags: ["drinks and alcohol", "2026 Super Bowl LX"]
  },
  {
    slug: 'anheuser-busch-at-the-super-bowl-ads-through-the-years',
    title: "Anheuser-Busch at the Super Bowl: Ads Through the Years",
    brand: "Anheuser-Busch",
    adland_tags: ["drinks and alcohol", "2026 Super Bowl LX"]
  }
];

async function getVideoInfo(slug) {
  // This will be filled in by scraping each page
  // For now, return placeholder - we'll update this
  return {
    youtubeUrl: null,
    description: ''
  };
}

async function downloadVideo(youtubeUrl, filename) {
  const outputPath = path.join(downloadsDir, `${filename}.mp4`);

  if (fs.existsSync(outputPath)) {
    console.log(`   Video already downloaded: ${filename}`);
    return outputPath;
  }

  try {
    execSync(`yt-dlp -f "best[ext=mp4]" -o "${outputPath}" "${youtubeUrl}"`, {
      stdio: 'inherit'
    });
    return outputPath;
  } catch (error) {
    console.error(`   Failed to download: ${youtubeUrl}`);
    return null;
  }
}

async function uploadAndAnalyze(videoPath, metadata) {
  console.log(`\n   Uploading: ${metadata.title}`);

  // Read file and create File object
  const fileBuffer = fs.readFileSync(videoPath);
  const fileName = `${metadata.title}.mp4`;
  const videoFile = new File([fileBuffer], fileName, { type: 'video/mp4' });

  // Upload
  const taskResponse = await client.tasks.create({
    indexId: indexId,
    videoFile: videoFile,
    enableVideoStream: true,
    userMetadata: JSON.stringify({
      title: metadata.title,
      collection: 'superbowl',
      brand: metadata.brand,
      source_url: metadata.source_url
    })
  });

  const taskId = taskResponse.id;
  console.log(`   Task ID: ${taskId}`);

  // Wait for indexing
  console.log('   Waiting for indexing...');
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
  console.log('   Analyzing...');
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

  // Update metadata
  const flatTags = { ...metadata };
  if (Array.isArray(flatTags.adland_tags)) {
    flatTags.adland_tags = flatTags.adland_tags.join(', ');
  }

  const finalMetadata = {
    ...flatTags,
    ...tags,
    analyzed_at: new Date().toISOString()
  };

  await client.indexes.videos.update(indexId, videoId, {
    userMetadata: finalMetadata
  });

  console.log(`   Done!`);
  return videoId;
}

async function processVideo(video) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${video.title}`);
  console.log(`${'='.repeat(60)}`);

  const sourceUrl = `https://adland.tv/${video.slug}`;

  // For now, we'll process videos that we manually get YouTube URLs for
  // This is a placeholder - in production, we'd scrape each page

  const videoMetadata = {
    ...video,
    source_url: sourceUrl,
    collection: 'superbowl',
    author: 'Lori Luechtefeld',
    publish_date: '2026-01-28'
  };

  return videoMetadata;
}

// Export for use in other scripts
export { videos, downloadVideo, uploadAndAnalyze, processVideo };

// Main execution
async function main() {
  console.log('Super Bowl LX Batch Upload Script');
  console.log(`Index ID: ${indexId}`);
  console.log(`Videos to process: ${videos.length}`);

  // Just list the videos for now - we'll need to get YouTube URLs first
  for (const video of videos) {
    console.log(`- ${video.title}`);
    console.log(`  URL: https://adland.tv/${video.slug}`);
  }
}

main().catch(console.error);
