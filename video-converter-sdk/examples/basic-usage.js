/**
 * Basic Usage Example
 * Shows how to use the Video Converter SDK with exact JSON format
 */

const VideoConverterSDK = require('../index');

// Example input JSON - same format as your existing code
const inputJSON =

{
  "base_url": "https://d2ra5fstrqw46p.cloudfront.net/videos/1755001474_6631.mp4",
  "videos": [
    {
      "media_url": "https://project-stock-market-analysis-animation-824.magicpatterns.app/",
      "converted_url": "https://project-stock-market-analysis-animation-824.magicpatterns.app/.mp4",
      "start_frame": 139,
      "end_frame": 339
    },
    {
      "media_url": "https://project-career-crossroads-animation-344.magicpatterns.app/",
      "start_frame": 139,
      "end_frame": 339
    },

    {
      "media_url": "https://project-animated-technological-timeline-215.magicpatterns.app/",
      "start_frame": 937,
      "end_frame": 1137
    },
   
    {
      "media_url": "https://project-ai-workforce-progress-animation-882.magicpatterns.app/",
      "start_frame": 4073,
      "end_frame": 4273
    },
    {
      "media_url": "https://project-ai-driven-time-progression-animation-346.magicpatterns.app/",
      "start_frame": 4824,
      "end_frame": 5024
    }
  ]
}



async function basicUsageExample() {
  console.log('🎬 Video Converter SDK - Basic Usage Example');
  console.log('==========================================');
  
  // Create SDK instance
  const sdk = new VideoConverterSDK({
    outputDir: './public',
    fps: 15,
    duration: 7,
    budgetMultiplier: 1, // 33ms budget
    baseUrl: 'http://localhost:3000'
  });

  try {
    console.log('📋 Input JSON:');
    console.log(JSON.stringify(inputJSON, null, 2));
    console.log();

    console.log('🚀 Starting conversion...');
    console.log('📝 Architecture: 1 browser → 1 context → All URLs processed in parallel');
    console.log();

    // Convert videos - JSON in, JSON out
    const result = await sdk.convert(inputJSON);

    console.log();
    console.log('📤 Output JSON:');
    console.log(JSON.stringify(result, null, 2));

    console.log();
    console.log('📊 URL Mapping:');
    result.videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.media_url}`);
      console.log(`   → ${video.converted_url}`);
      if (video.error) {
        console.log(`   ❌ Error: ${video.error}`);
      }
    });

  } catch (error) {
    console.error('💥 Error:', error.message);
  } finally {
    // Always cleanup
    await sdk.cleanup();
    console.log('✅ Example completed');
  }
}

if (require.main === module) {
  basicUsageExample()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Example failed:', error);
      process.exit(1);
    });
}

module.exports = { basicUsageExample };
