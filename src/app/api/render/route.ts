import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';

// Use the Stack Overflow solution - only ffmpeg is available
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

console.log('FFmpeg path:', ffmpegPath);

// GET: Stream video file so user can view it in browser
export function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    if (!filename) {
      return new Response('Filename required', { status: 400 });
    }
    const videoPath = path.join('/tmp', 'public', filename);
    if (!fs.existsSync(videoPath)) {
      return new Response('File not found', { status: 404 });
    }
    const videoBuffer = fs.readFileSync(videoPath);
    // Set headers for video viewing
    return new Response(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/webm',
        'Content-Length': videoBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Streaming error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export const POST = async (request: NextRequest) => {
  try {
    const { 
      url, 
      durationInSeconds = 10
    } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    console.log('Recording website directly...');
    const recordedVideoPath = await recordWebsiteDirect(url, durationInSeconds);
    
    const filename = path.basename(recordedVideoPath);

    return NextResponse.json({ 
  success: true, 
  viewUrl: `/api/render?filename=${encodeURIComponent(filename)}`,
  filename
});

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
};

async function recordWebsiteDirect(url: string, duration: number): Promise<string> {
  let browser = null;
  let context = null;
  
  try {
    console.log(`Recording ${url} for ${duration}s`);
    
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });
    
    const timestamp = Date.now();
    const outputDir = path.join('/tmp', 'public');
    
    // First load page WITHOUT recording
    let context1 = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const loadingPage = await context1.newPage();
    
    console.log('Loading website (no recording)...');
    
    // Navigate and wait for page to load - NOT RECORDED
    await loadingPage.goto(url, { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });
    
    // Wait for content to stabilize - NOT RECORDED
    console.log('Waiting for content to load (not recorded)...');
    await loadingPage.waitForTimeout(3000);
    
    // Close loading context
    await context1.close();
    
    // NOW create recording context
    console.log('Starting recording context...');
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: outputDir,
        size: { width: 1280, height: 720 }
      }
    });

    const page = await context.newPage();
    
    // Navigate again (this time with recording) - should be fast since content is cached
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', // Faster since page was pre-loaded
      timeout: 15000 
    });
    
    // Record ONLY for the specified duration
    console.log(`Recording for exactly ${duration} seconds...`);
    await page.waitForTimeout(duration * 1000);
    
    console.log('Recording completed, finalizing...');
    
    // Get video before closing
    const video = page.video();
    if (!video) {
      throw new Error('Video recording failed');
    }
    
    // Close context to save video
    await context.close();
    context = null;
    
    // Wait for video file to be completely written
    const videoPath = await waitForVideoFile(video);
    console.log('Video path:', videoPath);
    
    // Move to final location
    const rawVideoPath = path.join(outputDir, `website-${timestamp}-raw.webm`);
    fs.copyFileSync(videoPath, rawVideoPath);
    
    // Trim video using simple approach (no ffprobe needed)
    const finalVideoPath = await trimVideoSimple(rawVideoPath, duration, outputDir, timestamp);
    
    // Cleanup temp files
    try {
      fs.unlinkSync(videoPath);
      if (rawVideoPath !== finalVideoPath) {
        fs.unlinkSync(rawVideoPath);
      }
    } catch (e) {
      console.warn('Could not delete temp files');
    }
    
    const stats = fs.statSync(finalVideoPath);
    console.log(`Final video created: ${Math.round(stats.size / 1024)}KB`);
    
    return finalVideoPath;
    
  } catch (error) {
    console.error('Recording error:', error);
    throw new Error(`Recording failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    try {
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (e) {
      console.warn('Cleanup error');
    }
  }
}

// Simplified trimming without ffprobe - assumes we need to trim ~3-5 seconds from start
async function trimVideoSimple(inputPath: string, targetDuration: number, outputDir: string, timestamp: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(outputDir, `website-${timestamp}.webm`);
    
    console.log('Getting video duration using ffmpeg -f null...');
    
    // Use ffmpeg -f null to get duration from stderr output
    ffmpeg(inputPath)
      .output('-')
      .format('null')
      .on('stderr', (stderrLine: string) => {
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
          performTrim(trimStart+1, totalSeconds-trimStart); 
        }
      })
      .on('error', (err: any) => {
        console.log('Could not get duration, using estimated trim:', err.message);
        performTrim(3, targetDuration); // Fallback to 3-second trim
      })
      .run();
    
    function performTrim(startSeconds: number, duration: number) {
      const formatTime = (seconds: number): string => {
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
        .on('error', (err: any) => {
          console.log('Trim failed, using original:', err.message);
          fs.copyFileSync(inputPath, outputPath);
          resolve(outputPath);
        })
        .run();
    }
  });
}

// Smart function to wait for video file completion
async function waitForVideoFile(video: any, maxWaitTime: number = 60000): Promise<string> {
  const startTime = Date.now();
  let videoPath: string | null = null;
  let lastSize = 0;
  let stableCount = 0;
  
  console.log('Waiting for video file...');
  
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
        
        console.log(`Video file size: ${Math.round(currentSize / 1024)}KB`);
        
        if (currentSize > 0) {
          // Check if size is stable
          if (currentSize === lastSize) {
            stableCount++;
            if (stableCount >= 3) {
              console.log('Video file ready');
              return videoPath;
            }
          } else {
            stableCount = 0;
          }
          lastSize = currentSize;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('Video file not ready within timeout');
}