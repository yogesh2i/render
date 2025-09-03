# Video Converter SDK

Simple SDK for converting web animation URLs to MP4 videos using your existing screenshot + FFmpeg logic.

## 🎯 Features

- **JSON Input/Output**: Same format as your existing code
- **Domain-based URLs**: `https://project-career-crossroads-animation-344.magicpatterns.app/` → `http://baseurl/project-career-crossroads-animation-344.magicpatterns.app/`
- **Parallel Processing**: All URLs processed simultaneously 
- **Frame-based Duration**: Uses `start_frame` and `end_frame` for video duration
- **Two-page Pattern**: Same optimization as your existing code (loading + screenshot pages)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run basic example
npm test
```

## 📋 JSON Input Format

```json
{
  "base_url": "https://example.com/original-video.mp4",
  "videos": [
    {
      "media_url": "https://project-career-crossroads-animation-344.magicpatterns.app/",
      "start_frame": 139,
      "end_frame": 339
    },
    {
      "media_url": "https://project-ai-driven-time-progression-animation-346.magicpatterns.app/",
      "start_frame": 561,
      "end_frame": 761
    }
  ]
}
```

## 📤 JSON Output Format (Same Structure + converted_url)

```json
{
  "base_url": "https://example.com/original-video.mp4",
  "videos": [
    {
      "media_url": "https://project-career-crossroads-animation-344.magicpatterns.app/",
      "start_frame": 139,
      "end_frame": 339,
      "converted_url": "http://localhost:3000/project-career-crossroads-animation-344.magicpatterns.app/"
    },
    {
      "media_url": "https://project-ai-driven-time-progression-animation-346.magicpatterns.app/",
      "start_frame": 561,
      "end_frame": 761,
      "converted_url": "http://localhost:3000/project-ai-driven-time-progression-animation-346.magicpatterns.app/"
    }
  ]
}
```

## 💻 Usage

```javascript
const VideoConverterSDK = require('video-converter-sdk');

// Create SDK instance
const sdk = new VideoConverterSDK({
  outputDir: './public/converted-videos',
  fps: 30,
  baseUrl: 'http://localhost:3000'
});

// Your input JSON (same format as existing code)
const inputJSON = {
  "base_url": "https://example.com/original-video.mp4",
  "videos": [
    {
      "media_url": "https://project-career-crossroads-animation-344.magicpatterns.app/",
      "start_frame": 139,
      "end_frame": 339
    }
  ]
};

// Convert and get result JSON
const result = await sdk.convert(inputJSON);

// result.videos[0].converted_url will be:
// "http://localhost:3000/project-career-crossroads-animation-344.magicpatterns.app/"

// Cleanup
await sdk.cleanup();
```

## 🏗️ Architecture

- **Same Logic**: Uses your existing screenshot + FFmpeg code
- **Two-page Pattern**: Loading page (networkidle) + Screenshot page (domcontentloaded) 
- **One Browser/Context**: Shared across all URLs for efficiency
- **Parallel Processing**: All `media_url`s processed simultaneously
- **Domain-based Naming**: Output URLs use domain name from original URL

## 📁 File Structure

```
video-converter-sdk/
├── index.js                 # Main entry point
├── lib/
│   └── VideoSDK.js          # Core SDK using your existing logic
├── examples/
│   ├── basic-usage.js       # Basic usage example
│   └── sample-input.json    # Sample input file
└── package.json
```

## ⚙️ Technical Details

- Uses your exact screenshot logic (requestAnimationFrame, resize events, virtual time)
- Uses your exact FFmpeg settings (-c:v libx264 -pix_fmt yuv420p)
- Same browser args (--disable-remote-fonts, --font-render-hinting=none)
- Same viewport (1280x720)
- Same two-page pattern for optimization

## Requirements

- Node.js 16+
- FFmpeg (automatically installed)
- Playwright (automatically installs Chromium)

## License

MIT
