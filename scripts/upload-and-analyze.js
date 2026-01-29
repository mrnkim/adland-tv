import 'dotenv/config';
import { TwelveLabs } from 'twelvelabs-js';
import fs from 'fs';
import path from 'path';
import { File } from 'buffer';

const client = new TwelveLabs({ apiKey: process.env.TWELVELABS_API_KEY });

// Video metadata from adland.tv
const videoMetadata = {
  title: "Fanatics Sportsbook: Bet On Kendall - Super Bowl LX",
  brand: "Fanatics Sportsbook",
  collection: "superbowl",
  source_url: "https://adland.tv/fanatics-sportsbook-bet-on-kendall-super-bowl-lx",
  youtube_url: "https://www.youtube.com/watch?v=JfLUbLIULDw",
  author: "Lori Luechtefeld",
  publish_date: "2026-01-28",
  adland_tags: ["gambling", "2026 Super Bowl LX"],
  description: "Fanatics Sportsbook, the fastest growing sportsbook in America, is betting on Kendall Jenner with the launch of its first-ever Big Game commercial and Jenner's first Big Game advertising campaign, \"Bet on Kendall.\" The campaign is the first production from the recently launched Fanatics Studios, a joint venture between Fanatics and OBB Media. Bolded, OBB's branded entertainment division, served as the creative studio."
};

const videoPath = path.join(process.cwd(), 'downloads', 'fanatics-bet-on-kendall.mp4');
const indexId = process.env.NEXT_PUBLIC_INDEX_ID;

async function main() {
  try {
    console.log('📹 Starting video upload to TwelveLabs...');
    console.log(`   Index ID: ${indexId}`);
    console.log(`   Video: ${videoPath}`);

    // Step 1: Upload video
    console.log('\n1️⃣ Uploading video...');

    // Read file as buffer and create File with proper filename
    const fileBuffer = fs.readFileSync(videoPath);
    const fileName = `${videoMetadata.title}.mp4`;
    const videoFile = new File([fileBuffer], fileName, { type: 'video/mp4' });

    const taskResponse = await client.tasks.create({
      indexId: indexId,
      videoFile: videoFile,
      enableVideoStream: true,
      userMetadata: JSON.stringify({
        title: videoMetadata.title,
        collection: videoMetadata.collection,
        brand: videoMetadata.brand,
        source_url: videoMetadata.source_url
      })
    });

    console.log('   Response:', JSON.stringify(taskResponse, null, 2));
    const taskId = taskResponse._id || taskResponse.id;
    console.log(`   Task ID: ${taskId}`);
    console.log(`   Status: ${taskResponse.status}`);

    // Step 2: Wait for indexing to complete
    console.log('\n2️⃣ Waiting for indexing to complete...');
    const completedTask = await client.tasks.waitForDone(taskId, {
      sleepInterval: 5,
      callback: (task) => {
        console.log(`   Status: ${task.status}`);
      }
    });

    const videoId = completedTask.videoId;
    console.log(`   ✅ Video indexed! Video ID: ${videoId}`);

    // Step 3: Generate tags using Analyze API
    console.log('\n3️⃣ Analyzing video to generate tags...');
    const analysisPrompt = `Analyze this advertisement and generate structured metadata tags. Use the predefined options when possible. Only suggest a new option if the content truly doesn't fit any existing category.`;

    const analysisResponse = await client.analyze({
      videoId: videoId,
      prompt: analysisPrompt,
      temperature: 0.2,
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          type: "object",
          properties: {
            theme: {
              type: "string",
              enum: ["Humor", "Emotional", "Inspirational", "Educational", "Dramatic", "Nostalgic", "Adventurous", "Romantic", "Celebratory", "Empowering"],
              description: "Main theme of the ad. Pick the closest match."
            },
            emotion: {
              type: "string",
              enum: ["Happy", "Sad", "Exciting", "Calming", "Suspenseful", "Heartwarming", "Confident", "Playful", "Hopeful", "Nostalgic", "Empowering"],
              description: "Primary emotion conveyed"
            },
            visual_style: {
              type: "string",
              enum: ["Cinematic", "Animated", "Documentary", "Minimalist", "Bold/Colorful", "Black & White", "Retro", "High-energy", "Lifestyle", "Glamorous", "Artistic"],
              description: "Visual style of the ad"
            },
            sentiment: {
              type: "string",
              enum: ["Positive", "Neutral", "Provocative", "Negative"]
            },
            product_category: {
              type: "string",
              enum: ["Auto", "Tech", "Finance", "Insurance", "Healthcare", "Retail", "Food & Beverage", "Household & Personal Care", "Entertainment", "Sports", "Travel", "Telecom", "Beauty", "Fashion", "Luxury", "Education", "Other"],
              description: "Product category"
            },
            era_decade: {
              type: "string",
              enum: ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"],
              description: "Era/decade the ad was produced or the style it represents"
            },
            celebrities: {
              type: "string",
              description: "Any celebrities or notable people featured (empty string if none)"
            }
          }
        }
      }
    });

    const analysis = analysisResponse.data;
    console.log('   📝 Analysis result:');
    console.log(analysis);

    // Step 4: Parse analysis and update metadata
    console.log('\n4️⃣ Updating video metadata...');
    let parsedTags = {};
    try {
      parsedTags = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
    } catch (e) {
      console.log('   ⚠️ Could not parse analysis as JSON, using as-is');
      parsedTags = parseAnalysis(analysis);
    }

    // Convert arrays to comma-separated strings (TwelveLabs doesn't support arrays in metadata)
    const flatMetadata = { ...videoMetadata };
    if (Array.isArray(flatMetadata.adland_tags)) {
      flatMetadata.adland_tags = flatMetadata.adland_tags.join(', ');
    }

    const finalMetadata = {
      ...flatMetadata,
      ...parsedTags,
      analyzed_at: new Date().toISOString()
    };

    await client.indexes.videos.update(indexId, videoId, {
      userMetadata: finalMetadata
    });

    console.log('   ✅ Metadata updated!');
    console.log('\n📊 Final metadata:');
    console.log(JSON.stringify(finalMetadata, null, 2));

    console.log('\n✨ Done! Video processed successfully.');
    console.log(`   Video ID: ${videoId}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.body) {
      console.error('   Details:', JSON.stringify(error.body, null, 2));
    }
    process.exit(1);
  }
}

function parseAnalysis(text) {
  const tags = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/[\s\/]+/g, '_');
      const value = match[2].trim();
      tags[key] = value;
    }
  }

  return tags;
}

main();
