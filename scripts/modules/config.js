const fs = require('fs');


// Use same FFmpeg setup as your API
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const DEFAULT_CONFIG = {
  OUTPUT_DIR: '/tmp/converted-videos',
  MAX_CONCURRENT: 2,
  DEFAULT_DURATION: 10,
  BASE_URL_PUBLIC: 'https://render-dusky-pi.vercel.app'
};

const DEFAULT_URLS = [
  "https://project-animated-interview-scene-with-bill-gates-543.magicpatterns.app/",
  "https://project-animated-lightbulb-to-graduation-cap-transition-710.magicpatterns.app/",
  "https://project-animated-typewriter-text-display-910.magicpatterns.app/"
];

function getFFmpegPath() {
  console.log('FFmpeg path:', ffmpegPath);
  return ffmpegPath;
}

function parseInput() {
  // Check if running from API (has input file argument)
  const inputFile = process.argv[2];
  let urls, duration;

  if (inputFile && fs.existsSync(inputFile)) {
    // Running from API - read input from file
    console.log(`📥 Reading input from: ${inputFile}`);
    const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    urls = inputData.urls;
    duration = inputData.duration || DEFAULT_CONFIG.DEFAULT_DURATION;
    
    let outputDir = DEFAULT_CONFIG.OUTPUT_DIR;
    if (inputData.outputDir) {
      outputDir = inputData.outputDir;
    }
    
    console.log(`🎯 API Mode: Processing ${urls.length} URLs with ${duration}s duration`);
    return { urls, duration, outputDir, inputFile };
  } else {
    // Running standalone - use hardcoded URLs
    console.log(`🖥️ Standalone Mode: Using hardcoded URLs`);
    urls = DEFAULT_URLS;
    duration = DEFAULT_CONFIG.DEFAULT_DURATION;
    
    return { 
      urls, 
      duration, 
      outputDir: DEFAULT_CONFIG.OUTPUT_DIR, 
      inputFile: null 
    };
  }
}

function setupDirectories(outputDir) {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function createConfig(urls, duration, outputDir) {
  return {
    ...DEFAULT_CONFIG,
    OUTPUT_DIR: outputDir,
    DEFAULT_DURATION: duration,
    urls: urls
  };
}

module.exports = {
  DEFAULT_CONFIG,
  DEFAULT_URLS,
  getFFmpegPath,
  parseInput,
  setupDirectories,
  createConfig
};
