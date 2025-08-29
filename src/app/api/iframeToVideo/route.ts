// import { NextRequest, NextResponse } from 'next/server';
// import { spawn } from 'child_process';
// import path from 'path';
// import fs from 'fs';

// interface ConversionResult {
//   index: number;
//   url: string;
//   filename?: string;
//   success: boolean;
//   error?: string;
//   videoUrl?: string;
//   processingTime?: number;
// }

// export async function POST(request: NextRequest) {
//   try {
//     const {urls, duration = 10 } = await request.json();
    
//     if (!Array.isArray(urls) || urls.length === 0) {
//       return NextResponse.json(
//         { success: false, error: 'URLs array is required' },
//         { status: 400 }
//       );
//     }

//     console.log(`🚀 Starting batch conversion of ${urls.length} URLs using script...`);

//     // Create temporary input file for the script
//     const tempDir = path.join('/tmp', 'temp');
//     await fs.promises.mkdir(tempDir, { recursive: true });
    
//     const timestamp = Date.now();
//     const inputFile = path.join(tempDir, `batch-input-${timestamp}.json`);
    
//     const scriptInput = {
//       urls: urls,
//       duration: duration,
//       outputDir: path.join('/tmp', 'public'),
//       timestamp: timestamp
//     };
    
//     await fs.promises.writeFile(inputFile, JSON.stringify(scriptInput, null, 2));

//     // Run your existing script
//     const scriptPath = path.join(process.cwd(), 'scripts', 'iframeToVideo.js');
//     const results = await runConversionScript(scriptPath, inputFile);
    
//     // Clean up temp input file
//     await fs.promises.unlink(inputFile);
    
//     // Process results
//     const successful = results.filter(r => r.success);
//     const failed = results.filter(r => !r.success);
    
//     // Create video URLs array
//     const videoUrls = successful.map(result => ({
//       originalUrl: result.url,
//       videoUrl: result.videoUrl, // Use the full URL from batchProcessor
//       filename: result.filename
//     }));

 
//     return NextResponse.json({
//       success: true,
//       totalProcessed: urls.length,
//       successfulConversions: successful.length,
//       failedConversions: failed.length,
//       videoUrls,
//       results,
//       message: `Converted ${successful.length}/${urls.length} URLs successfully`,
//       processingTime: `Script completed in ${Date.now() - timestamp}ms`
//     });

//   } catch (error) {
//     console.error('❌ Batch conversion error:', error);
//     return NextResponse.json(
//       { 
//         success: false, 
//         error: error instanceof Error ? error.message : 'Conversion failed' 
//       },
//       { status: 500 }
//     );
//   }
// }

// // Function to run your conversion script and capture results
// async function runConversionScript(scriptPath: string, inputFile: string): Promise<ConversionResult[]> {
//   return new Promise((resolve, reject) => {
//     console.log(`📡 Running conversion script: ${scriptPath}`);
    
//     // Run your script with input file as argument
//     const child = spawn('node', [scriptPath, inputFile], {
//       stdio: ['pipe', 'pipe', 'pipe'],
//       cwd: '/tmp',
//       env: { ...process.env, NODE_ENV: 'production' }
//     });

//     let stdout = '';
//     let stderr = '';

//     // Capture script output
//     child.stdout.on('data', (data) => {
//       const output = data.toString();
//       stdout += output;
      
//       // Log script progress in real-time
//       const lines = output.split('\n');
//       lines.forEach((line: string) => {
//         if (line.trim()) {
//           console.log(`[Script] ${line.trim()}`);
//         }
//       });
//     });

//     child.stderr.on('data', (data) => {
//       const error = data.toString();
//       stderr += error;
//       console.error(`[Script Error] ${error.trim()}`);
//     });

//     child.on('close', async (code) => {
//       console.log(`📋 Script finished with exit code: ${code}`);
      
//       if (code === 0) {
//         try {
//           // First try to read JSON results (preferred)
//           const jsonPath = path.join(path.dirname(inputFile), 'conversion-results.json');
          
//           if (fs.existsSync(jsonPath)) {
//             console.log(`📄 Reading JSON results from: ${jsonPath}`);
//             const resultsData = await fs.promises.readFile(jsonPath, 'utf8');
//             const results = JSON.parse(resultsData);
            
//             // Clean up results file
//             await fs.promises.unlink(jsonPath);
            
//             console.log(`✅ Successfully parsed ${results.length} results from JSON`);
            
//             // Check if script reported failure (fail-fast mode)
//             if (results.length > 0 && results[0]?.success === false) {
//               console.error('❌ Script reported failure:', results[0].error);
//               reject(new Error(`Conversion failed: ${results[0].error}`));
//               return;
//             }
            
//             resolve(results);
//           } else {
//             // Fallback: try to parse from stdout
//             console.log(`⚠️ JSON file not found, parsing from stdout`);
//             const results = parseResultsFromOutput(stdout);
//             resolve(results);
//           }
//         } catch (error) {
//           reject(new Error(`Failed to read results: ${error instanceof Error ? error.message : 'Unknown error'}`));
//         }
//       } else {
//         reject(new Error(`Script failed with exit code ${code}. Error: ${stderr}`));
//       }
//     });

//     child.on('error', (error) => {
//       console.error('❌ Script process error:', error);
//       reject(new Error(`Script execution failed: ${error.message}`));
//     });

//     // Set timeout for long-running conversions (30 minutes)
//     const timeout = setTimeout(() => {
//       child.kill('SIGTERM');
//       reject(new Error('Script execution timeout (30 minutes)'));
//     }, 30 * 60 * 1000);

//     child.on('close', () => {
//       clearTimeout(timeout);
//     });
//   });
// }



// // Fallback: parse results from script stdout
// function parseResultsFromOutput(output: string): ConversionResult[] {
//   const results: ConversionResult[] = [];
//   const lines = output.split('\n');
  
//   lines.forEach(line => {
//     // Look for success patterns: "✅ [0] Success: filename.webm"
//     const successMatch = line.match(/✅\s*\[(\d+)\]\s*Success:\s*(.+)/);
//     if (successMatch) {
//       const index = parseInt(successMatch[1]);
//       const filename = successMatch[2].trim();
      
//       // Find corresponding URL from previous processing logs
//       const urlMatch = lines.find(l => l.includes(`Processing ${index + 1}/`));
//       let url = '';
//       if (urlMatch) {
//         const urlExtract = urlMatch.match(/URL:\s*(.+)/);
//         if (urlExtract) url = urlExtract[1].trim();
//       }
      
//       results.push({
//         index,
//         url,
//         filename,
//         success: true
//       });
//     }
    
//     // Look for failure patterns: "❌ [0] Failed: error message"
//     const failureMatch = line.match(/❌\s*\[(\d+)\]\s*Failed:\s*(.+)/);
//     if (failureMatch) {
//       const index = parseInt(failureMatch[1]);
//       const error = failureMatch[2].trim();
      
//       // Find corresponding URL
//       const urlMatch = lines.find(l => l.includes(`Processing ${index + 1}/`));
//       let url = '';
//       if (urlMatch) {
//         const urlExtract = urlMatch.match(/URL:\s*(.+)/);
//         if (urlExtract) url = urlExtract[1].trim();
//       }
      
//       results.push({
//         index,
//         url,
//         success: false,
//         error
//       });
//     }
//   });
  
//   return results;
// }
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const DEFAULT_CONFIG = {
  OUTPUT_DIR: '/tmp/converted-videos',
  MAX_CONCURRENT: 2,
  DEFAULT_DURATION: 10
};

async function setupDirectories(outputDir: string) {
  console.log(`[setupDirectories] Ensuring output directory: ${outputDir}`);
  await fs.promises.mkdir(outputDir, { recursive: true });
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function waitForVideoFile(video: any, maxWaitTime = 60000) {
  console.log('[waitForVideoFile] Waiting for video file to be ready...');
  const startTime = Date.now();
  let videoPath: string | null = null;
  let lastSize = 0;
  let stableCount = 0;
  while (Date.now() - startTime < maxWaitTime) {
    if (!videoPath) {
      videoPath = await video.path();
      if (!videoPath) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
    }
    if (fs.existsSync(videoPath)) {
      const stats = fs.statSync(videoPath);
      const currentSize = stats.size;
      if (currentSize > 0) {
        if (currentSize === lastSize) {
          stableCount++;
          if (stableCount >= 3) {
            console.log(`[waitForVideoFile] Video file is stable: ${videoPath}`);
            return videoPath;
          }
        } else {
          stableCount = 0;
        }
        lastSize = currentSize;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Video file not ready within timeout');
}

async function trimVideoSimple(inputPath: string, targetDuration: number, outputDir: string, timestamp: number) {
  console.log(`[trimVideoSimple] Trimming video: ${inputPath} to ${targetDuration}s`);
  return new Promise((resolve, reject) => {
    const outputPath = path.join(outputDir, `website-${timestamp}.webm`);
    ffmpeg(inputPath)
      .setStartTime('00:00:03')
      .setDuration(targetDuration.toString())
      .output(outputPath)
      .on('end', () => {
        console.log(`[trimVideoSimple] Trimmed video saved: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err:any) => {
        console.error('[trimVideoSimple] Error trimming video:', err);
        reject(err);
      })
      .run();
  });
}

async function recordWebsiteDirect(url: string, duration: number, outputDir: string) {
  let browser = null;
  let context = null;
  try {
    console.log(`[recordWebsiteDirect] Launching browser for: ${url}`);
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
    // Preload page
    let context1 = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
    const loadingPage = await context1.newPage();
    console.log(`[recordWebsiteDirect] Preloading page: ${url}`);
    await loadingPage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await loadingPage.waitForTimeout(3000);
    await context1.close();
    // Recording context
    context = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
      recordVideo: {
        dir: outputDir,
        size: { width: 1080, height: 1920 }
      }
    });
    const page = await context.newPage();
    console.log(`[recordWebsiteDirect] Recording page: ${url} for ${duration}s`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(duration * 1000);
    const video = page.video();
    await context.close();
    await browser.close();
    console.log(`[recordWebsiteDirect] Recording complete for: ${url}`);
    return { video, timestamp, outputDir };
  } catch (error) {
    console.error(`[recordWebsiteDirect] Error recording ${url}:`, error);
    if (context) await context.close();
    if (browser) await browser.close();
    throw error;
  }
}

async function processUrl(url: string, duration: number, outputDir: string) {
  try {
    console.log(`[processUrl] Processing URL: ${url}`);
    const { video, timestamp, outputDir: outDir } = await recordWebsiteDirect(url, duration, outputDir);
    const videoPath = await waitForVideoFile(video);
    const rawVideoPath = path.join(outDir, `website-${timestamp}-raw.webm`);
    await fs.promises.copyFile(videoPath, rawVideoPath);
    console.log(`[processUrl] Raw video copied: ${rawVideoPath}`);
    const trimmedVideoPath = await trimVideoSimple(rawVideoPath, duration, outDir, timestamp);
    console.log(`[processUrl] Trimmed video path: ${trimmedVideoPath}`);
    return {
      url,
      filename: path.basename(trimmedVideoPath as string),
      videoUrl: `/converted-videos/${path.basename(trimmedVideoPath as string)}`,
      success: true
    };
  } catch (error) {
    console.error(`[processUrl] Error processing ${url}:`, error);
    return {
      url,
      success: false,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[POST] Received request for batch website conversion');
    const { urls, duration = DEFAULT_CONFIG.DEFAULT_DURATION } = await request.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      console.warn('[POST] No URLs provided');
      return NextResponse.json({ success: false, error: 'No URLs provided' }, { status: 400 });
    }
    const outputDir = DEFAULT_CONFIG.OUTPUT_DIR;
    await setupDirectories(outputDir);
    const results = [];
    for (const url of urls) {
      console.log(`[POST] Processing: ${url}`);
      const result = await processUrl(url, duration, outputDir);
      results.push(result);
      if (!result.success) {
        console.warn(`[POST] Fail-fast: Stopping batch due to error on ${url}`);
        break; // Fail-fast
      }
    }
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    console.log(`[POST] Batch complete: ${successful.length} successful, ${failed.length} failed`);
    return NextResponse.json({
      success: failed.length === 0,
      totalProcessed: urls.length,
      successfulConversions: successful.length,
      failedConversions: failed.length,
      videoUrls: successful.map(r => ({ originalUrl: r.url, videoUrl: r.videoUrl, filename: r.filename })),
      results,
      message: `Converted ${successful.length}/${urls.length} URLs successfully`
    });
  } catch (error) {
    console.error('[POST] Batch conversion error:', error);
    return NextResponse.json({ success: false, error: "ok" }, { status: 500 });
  }
}
        // Process a single URL: record and trim video