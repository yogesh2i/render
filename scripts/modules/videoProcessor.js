const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

async function trimVideoSimple(inputPath, targetDuration, outputDir, timestamp) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(outputDir, `website-${timestamp}.webm`);
    
    console.log('Getting video duration using ffmpeg -f null...');
    
    // Use ffmpeg -f null to get duration from stderr output
    ffmpeg(inputPath)
      .output('-')
      .format('null')
      .on('stderr', (stderrLine) => {
        // Look for duration in stderr output
        const durationMatch = stderrLine.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          
          console.log(`Detected duration: ${totalSeconds}s, target: ${targetDuration}s`);
          
          if (totalSeconds <= targetDuration + 1) {
            console.log('Duration acceptable, using original');
            fs.copyFileSync(inputPath, outputPath);
            resolve(outputPath);
            return;
          }
          
          // Calculate trim from start
          const trimStart = totalSeconds - targetDuration;
          performTrim(trimStart + 1, totalSeconds - trimStart); // Add 1s buffer at start
        }
      })
      .on('error', (err) => {
        console.log('Could not get duration, using estimated trim:', err.message);
        performTrim(3, targetDuration); // Fallback to 3-second trim
      })
      .run();
    
    // Perform the actual trimming
    function performTrim(startSeconds, duration) {
      const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      };
      
      console.log(`Trimming: start=${formatTime(startSeconds)}, duration=${duration}s`);
      
      ffmpeg(inputPath)
        .setStartTime(formatTime(startSeconds))
        .setDuration(duration.toString())
        .output(outputPath)
        .on('end', () => {
          console.log('FFmpeg trim completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.log('Trim failed, using original:', err.message);
          fs.copyFileSync(inputPath, outputPath);
          resolve(outputPath);
        })
        .run();
    }
  });
}

function detectVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output('-')
      .format('null')
      .on('stderr', (stderrLine) => {
        const durationMatch = stderrLine.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          resolve(totalSeconds);
        }
      })
      .on('error', reject)
      .run();
  });
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

module.exports = {
  trimVideoSimple,
  detectVideoDuration,
  formatTime
};
