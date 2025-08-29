const fs = require('fs');
const path = require('path');
async function waitForVideoFile(video, maxWaitTime = 60000) {
  const startTime = Date.now();
  let videoPath = null;
  let lastSize = 0;
  let stableCount = 0;
  
  console.log('⏳ Waiting for video file...');
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Get video path
      if (!videoPath) {
        videoPath = await video.path();
        if (!videoPath) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
      }
      
      // Check if file exists and has content
      if (fs.existsSync(videoPath)) {
        const stats = fs.statSync(videoPath);
        const currentSize = stats.size;
        
        console.log(`📹 Video file size: ${Math.round(currentSize / 1024)}KB`);
        
        if (currentSize > 0) {
          // Check if size is stable (your stability detection)
          if (currentSize === lastSize) {
            stableCount++;
            if (stableCount >= 3) {
              console.log('✅ Video file ready');
              return videoPath; // Ensure we return the path here
            }
          } else {
            stableCount = 0;
          }
          lastSize = currentSize;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('❌ Error waiting for video file:', error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // If we get here, we timed out - this should trigger fail-fast
  const errorMsg = `Video file not ready within timeout (${maxWaitTime}ms). VideoPath: ${videoPath}`;
  console.error(`💥 ${errorMsg}`);
  throw new Error(errorMsg);
}

function moveToFinalLocation(videoPath, outputDir, timestamp) {
  const rawVideoPath = path.join(outputDir, `website-${timestamp}-raw.webm`);
  fs.copyFileSync(videoPath, rawVideoPath);
  return rawVideoPath;
}

function cleanupTempFiles(filePaths) {
  try {
    filePaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (e) {
    console.warn('Could not delete temp files:', e.message);
  }
}

function writeJSONResults(results, outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`📄 JSON results written to: ${outputPath}`);
}

// Add new function to write failure results immediately
function writeFailureResult(error, outputPath) {
  const failureResult = {
    success: false,
    error: error.message,
    timestamp: new Date().toISOString(),
    terminatedEarly: true
  };
  
  fs.writeFileSync(outputPath, JSON.stringify([failureResult], null, 2));
  console.log(`💥 Failure result written to: ${outputPath}`);
}

function getFileStats(filePath) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      sizeKB: Math.round(stats.size / 1024)
    };
  }
  return null;
}

module.exports = {
  waitForVideoFile,
  moveToFinalLocation,
  cleanupTempFiles,
  writeJSONResults,
  writeFailureResult,
  getFileStats
};
