import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'app', '.env') });
import { TwelveLabs } from 'twelvelabs-js';

const client = new TwelveLabs({ apiKey: process.env.TWELVELABS_API_KEY });
const indexId = process.env.NEXT_PUBLIC_INDEX_ID;

async function main() {
  console.log('🍺 Updating Alcohol -> Food & Beverage');
  console.log(`   Index ID: ${indexId}`);
  console.log('');

  // Fetch all videos
  let allVideos = [];
  let page = 1;
  let totalPages = 1;

  console.log('📥 Fetching all videos...');

  do {
    const response = await fetch(
      `https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos?page=${page}&page_limit=50`,
      {
        headers: { 'x-api-key': process.env.TWELVELABS_API_KEY }
      }
    );

    const data = await response.json();
    allVideos = [...allVideos, ...(data.data || [])];
    totalPages = data.page_info?.total_page || 1;
    console.log(`   Page ${page}/${totalPages} - ${data.data?.length || 0} videos`);
    page++;
  } while (page <= totalPages);

  console.log(`\n📊 Total videos: ${allVideos.length}`);

  // Find videos with product_category = "Alcohol"
  const alcoholVideos = allVideos.filter(
    video => video.user_metadata?.product_category === 'Alcohol'
  );

  console.log(`🍺 Videos with Alcohol category: ${alcoholVideos.length}`);

  if (alcoholVideos.length === 0) {
    console.log('\n✓ No videos to update!');
    return;
  }

  // Update each video
  console.log('\n🔄 Updating videos...\n');

  let updated = 0;
  let failed = 0;

  for (const video of alcoholVideos) {
    const title = video.user_metadata?.title || video.system_metadata?.video_title || video._id;
    process.stdout.write(`   ${title}... `);

    try {
      // Get current metadata and update product_category
      const updatedMetadata = {
        ...video.user_metadata,
        product_category: 'Food & Beverage'
      };

      // Use direct API call instead of SDK
      const response = await fetch(
        `https://api.twelvelabs.io/v1.3/indexes/${indexId}/videos/${video._id}`,
        {
          method: 'PUT',
          headers: {
            'x-api-key': process.env.TWELVELABS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_metadata: updatedMetadata
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }

      console.log('✓');
      updated++;
    } catch (error) {
      console.log(`✗ ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 Summary');
  console.log(`${'='.repeat(50)}`);
  console.log(`✓ Updated: ${updated}`);
  console.log(`✗ Failed: ${failed}`);
}

main().catch(console.error);
