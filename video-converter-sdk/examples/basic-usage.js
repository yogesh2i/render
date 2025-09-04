/**
 * Basic Usage Example
 * Shows how to use the Video Converter SDK with exact JSON format
 */

const VideoConverterSDK = require('../index');

// Example input JSON - same format as your existing code
// const inputJSON =

// {
//   "base_url": "https://d2ra5fstrqw46p.cloudfront.net/videos/1755001474_6631.mp4",
//   "videos": [
//     {
//       "media_url": "https://project-stock-market-analysis-animation-824.magicpatterns.app/",
//       "converted_url": "https://project-stock-market-analysis-animation-824.magicpatterns.app/.mp4",
//       "start_frame": 139,
//       "end_frame": 339
//     },
//     {
//       "media_url": "https://project-career-crossroads-animation-344.magicpatterns.app/",
//       "start_frame": 139,
//       "end_frame": 339
//     },

//     {
//       "media_url": "https://project-animated-technological-timeline-215.magicpatterns.app/",
//       "start_frame": 937,
//       "end_frame": 1137
//     },
   
//     {
//       "media_url": "https://project-ai-workforce-progress-animation-882.magicpatterns.app/",
//       "start_frame": 4073,
//       "end_frame": 4273
//     },
//     {
//       "media_url": "https://project-ai-driven-time-progression-animation-346.magicpatterns.app/",
//       "start_frame": 4824,
//       "end_frame": 5024
//     }
//   ]
// }

const inputJSON = {
  "trimmed": false,
  "base_url": "https://d2ra5fstrqw46p.cloudfront.net/videos/1756812591_4172.mp4",
  "end_time": 29,
  "language": "en",
  "is_youtube": false,
  "project_id": "ae0fb7f9-0ed4-45c4-a187-b3f0b08a360f",
  "start_time": 0,
  "description": "",
  "magicmotion": [
   
    {
      "data": "https://project-animated-car-motion-graphics-439.magicpatterns.app/",
      "scene": 2,
      "metadata": {
        "__v": 0,
        "_id": "68b5b7a65e4aa4cd42b05917",
        "slug": "animated-car-motion-graphics-439",
        "hasPassword": false,
        "editorRoomId": "nn4dmtlk3c2pnkfj4ahptj"
      }
    }
  ],
  "video_width": 608,
  "aspect_ratio": null,
  "base_url_mp4": "https://d2ra5fstrqw46p.cloudfront.net/videos/1756812591_4172.mp4",
  "video_height": 1088,
  "enable_brolls": true,
  "video_duration": 29.0,
  "enable_subtitles": true,
  "initial_base_url": "https://drswlc8e0nze0.cloudfront.net/0c01d82c-6df9-413e-b0e4-743593e3df40.mp4",
  "video_matting_url": "https://d2ra5fstrqw46p.cloudfront.net/videos/1756812629_5528.mp4",
  "enable_magic_motion": true,
  "motion_graphics_data": [
   
    {
      "data": "https://project-animated-car-motion-graphics-439.magicpatterns.app/",
      "scene": 2,
      "metadata": {
        "__v": 0,
        "_id": "68b5b7a65e4aa4cd42b05917",
        "slug": "animated-car-motion-graphics-439",
        "hasPassword": false,
        "editorRoomId": "nn4dmtlk3c2pnkfj4ahptj"
      }
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
