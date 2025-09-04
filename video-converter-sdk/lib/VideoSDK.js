/**
 * Video Converter SDK
 * Uses  screenshot + FFmpeg logic with JSON input/output
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');
require('dotenv').config();

console.log(process.env.AWS_ACCESS_KEY_ID);
// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

class VideoConverterSDK {
  constructor(options = {}) {
    this.config = {
      outputDir: options.outputDir || './tmp/public/converted-videos',
      tempDir: options.tempDir || './tmp',
      screenshotDir: options.screenshotDir || './tmp/screenshots', 
      fps: options.fps || 30,
      duration: options.duration || 10,
      timeout: options.timeout || 120000,
      baseUrl: options.baseUrl || 'http://localhost:3000'
    };

    this.browser = null;
    this.context = null;
    this.isInitialized = false;
  }

  /**
   * Initialize SDK - creates browser and context
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Video Converter SDK...');

    try {
      // Ensure directories exist
      await this.ensureDirectory(this.config.outputDir);
      await this.ensureDirectory(this.config.tempDir);
      await this.ensureDirectory(this.config.screenshotDir);

      // Launch browser 
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-remote-fonts',
          '--font-render-hinting=none',
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });

      // Create context
      this.context = await this.browser.newContext({
        viewport: { width: 1080, height: 1920 }
      });

      this.isInitialized = true;
      console.log('✅ SDK initialized successfully');

    } catch (error) {
      console.error('❌ SDK initialization failed:', error);
      throw new Error(`SDK initialization failed: ${error.message}`);
    }
  }

  /**
   * Main conversion method - JSON in, JSON out
   * @param {Object} inputJSON - Input JSON with videos array
   * @returns {Promise<Object>} Output JSON with converted videos
   */
  async convert(inputJSON) {
    console.log('🎬 Starting video conversion...');

    // Validate input format
    if (!inputJSON) {
      throw new Error('Invalid input: JSON is required');
    }

    // Initialize if needed
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      console.log(`📝 Processing ${inputJSON.magicmotion.length} videos in parallel...`);

      // Process all videos in parallel using single browser/context
      const videoPromises = inputJSON.magicmotion.map(async (video, index) => {
        try {
          const result = await this.processVideo(video, index);
          return {
            ...video, // Keep original fields: data, start_frame, end_frame
            graphic_motion_url: video.data,
            data: result.converted_url
          };
        } catch (error) {
          console.error(`❌ Video ${index + 1} failed:`, error.message);
          return {
            ...video,
            graphic_motion_url: video.data,
            data: '', // Empty URL on failure
           
          };
        }
      });

      // Wait for all videos to complete
      const processedVideos = await Promise.all(videoPromises);
     let updatedMotionGraphicsData = inputJSON.motion_graphics_data;
    
    if (inputJSON.motion_graphics_data && Array.isArray(inputJSON.motion_graphics_data)) {
      updatedMotionGraphicsData = inputJSON.motion_graphics_data.map((video, index) => {
        // Find corresponding processed video from magicmotion by scene or index
        const correspondingProcessed = processedVideos.find(processed => 
          processed.scene === video.scene || processed.metadata._id === video.metadata._id
        ) || processedMagicMotion[index]; // Fallback to index matching

        if (correspondingProcessed) {
          return {
            ...video, // Keep original fields
            graphic_motion_url: video.data, 
            data: correspondingProcessed.data 
          };
        } else {
          return {
            ...video,
            graphic_motion_url: video.data,
            data: '' 
          };
        }
      });
    }
      // Build output JSON in same format as input
      const output = {
        ...inputJSON,
        magicmotion: processedVideos, // Replace magicmotion array with processed results
        motion_graphics_data: updatedMotionGraphicsData
      };

      const processingTime = Date.now() - startTime;
      console.log(`🎉 Conversion completed in ${processingTime}ms!`);

      return output;

    } catch (error) {
      console.error('💥 Conversion failed:', error);
      throw error;
    }
  }

  /**
   * Process a single video
   */
  async processVideo(video, index) {
    const { data } = video;
    
    // Validate video data
    if (!data) {
      throw new Error('Invalid video data: data, start_frame, and end_frame are required');
    }


      const frameCount = this.config.duration * this.config.fps;  
    const projectId = `sdk_${Date.now()}_${index}`;
    
    console.log(`🔄 [${index + 1}] Processing: ${data}`);

    // Create unique directories for this video
    const videoScreenshotDir = path.join(this.config.screenshotDir, `video_${projectId}`);
    await this.ensureDirectory(videoScreenshotDir);

    const urlObject = new URL(data);
    const domainName = urlObject.hostname;
    const outputFilename = `${domainName}.mp4`;
    const outputPath = path.join(this.config.outputDir, outputFilename);

    try {
      // Create two-page pattern (one for loading one actual screenshot page)
      const loadingPage = await this.context.newPage();
      const screenshotPage = await this.context.newPage();
      await loadingPage.route('**/*', (route) => {
  const url = route.request().url();
  const resourceType = route.request().resourceType();
  
  // Block all icons and metadata
  const blockedPatterns = [
    'favicon',
    'apple-touch-icon',
    'android-chrome',
    'mstile-',
    'browserconfig.xml',
    'manifest.json',
    '.ico',
    '/icon-',
    '/apple-icon'
  ];
  
  const shouldBlock = blockedPatterns.some(pattern => 
    url.toLowerCase().includes(pattern.toLowerCase())
  );
  
  if (shouldBlock || ['beacon', 'csp_report', 'ping'].includes(resourceType)) {
    route.abort();
  } else {
    route.continue();
  }
});
      try {
        console.log(`📱 [${index + 1}] Loading page with two-page pattern...`);
        
        // Page 1: Loading page (networkidle) - heavy lifting with longer timeout
        await loadingPage.goto(data, { 
          waitUntil: 'networkidle', 
          timeout: 60000  // Increased timeout for slow sites
        });
      
//wait for contents to be cached
  await new Promise(resolve => setTimeout(resolve, 2000));

  
        // Page 2: Screenshot page (domcontentloaded) - fast, uses cached resources  
        await screenshotPage.goto(data, { 
          waitUntil: 'domcontentloaded', 
          timeout: this.config.timeout 
        });
          const client = await this.context.newCDPSession(screenshotPage);
  await client.send('Emulation.setVirtualTimePolicy', {
    policy: 'pause',
  });
  
  
       
          // Capture screenshots 
          console.log(`📸 [${index + 1}] Capturing ${frameCount} screenshots...`);
          await this.captureScreenshots(screenshotPage,client,  videoScreenshotDir, frameCount, index);

          // Generate video 
          console.log(`🎬 [${index + 1}] Generating video...`);
          await this.generateVideo(videoScreenshotDir, outputPath);

          const bucketName = process.env.S3_BUCKET_NAME || 'your-bucket-name';

let convertedUrl;
try {
  // Upload to S3 and get S3 URL
  const s3Url = await this.uploadVideoToS3(outputPath, bucketName);
  convertedUrl = s3Url;
  console.log(`✅ [${index + 1}] Video uploaded to S3: ${s3Url}`);
} catch (s3Error) {
  console.error(`❌ [${index + 1}] S3 upload failed, using local URL:`, s3Error.message);
  // Fallback to local URL if S3 upload fails
  convertedUrl = `${this.config.baseUrl}/${outputFilename}/`;
}

// Clean up screenshots
await this.removeDirectory(videoScreenshotDir);

console.log(`✅ [${index + 1}] Video completed: ${outputFilename}`);

return {
  converted_url: convertedUrl // Now returns S3 URL instead of local URL
};
        
      } finally {
        await loadingPage.close();
        await screenshotPage.close();
      }

    } catch (error) {
      throw error;
    }
  } 

  /**
   * Capture screenshots 
   */
  async captureScreenshots(page,client, screenshotDir, frameCount, videoIndex) {
    //if cdp fails we move to custom js controlled animation
    try {
      await this.captureWithCDP(page,client, screenshotDir, frameCount, videoIndex);
    } catch (error) {
      let newPage = await this.context.newPage();
      await newPage.goto(page.url(),{waitUntil:'domcontentloaded'});
      await page.close();
      await this.captureWithJSTimeControl(page=newPage, screenshotDir, frameCount, videoIndex);
    }
  }
 

/**
 * CDP-based capture with animation seeking
 */
async captureWithCDP(page,client, screenshotDir, frameCount, videoIndex) {


  for (let i = 0; i < frameCount; i++) {
    await client.send('Emulation.setVirtualTimePolicy', {
        policy: 'advance',
        budget: Math.round(1000 / this.config.fps),
      });
    
    const imgPath = path.join(screenshotDir, `frame_${String(i).padStart(4, '0')}.png`);
    try {
      await page.screenshot({ 
        path: imgPath,
        timeout: 60000 
      });
      
     } catch (error) {
      throw error
     }
  }
}

/**
 * Use JavaScript-level time control instead of broken CDP virtual time
 */
async captureWithJSTimeControl(page, screenshotDir, frameCount, videoIndex) {
  try {
    await this.removeDirectory(screenshotDir);
    // Inject JavaScript time control directly into the page
    await page.evaluate(() => {
      // Store original functions
      window.__originalRAF = window.requestAnimationFrame;
      window.__originalTimeout = window.setTimeout;
      window.__originalInterval = window.setInterval;
      window.__originalNow = window.performance.now;
      
      // Create controllable time
      window.__virtualTime = 0;
      window.__rafCallbacks = [];
      window.__timeouts = new Map();
      window.__timeoutId = 1;
      
      // Override requestAnimationFrame
      window.requestAnimationFrame = (callback) => {
        window.__rafCallbacks.push(callback);
        return window.__rafCallbacks.length;
      };
      
      // Override setTimeout
      window.setTimeout = (callback, delay) => {
        const id = window.__timeoutId++;
        window.__timeouts.set(id, {
          callback,
          triggerTime: window.__virtualTime + delay
        });
        return id;
      };
      
      // Override performance.now
      window.performance.now = () => window.__virtualTime;
      
      // Function to advance virtual time
      window.__advanceTime = (deltaMs) => {
        window.__virtualTime += deltaMs;
        
        // Execute RAF callbacks
        const callbacks = [...window.__rafCallbacks];
        window.__rafCallbacks = [];
        callbacks.forEach(callback => {
          try { callback(window.__virtualTime); } catch(e) {}
        });
        
        // Execute ready timeouts
        for (const [id, timeout] of window.__timeouts.entries()) {
          if (timeout.triggerTime <= window.__virtualTime) {
            try { timeout.callback(); } catch(e) {}
            window.__timeouts.delete(id);
          }
        }
        
        // Force layout recalculation
        document.body.offsetHeight;
        
        return window.__virtualTime;
      };
      
      // Initialize
      window.__advanceTime(0);
    });
    
    // Wait for injection to complete
    await page.waitForTimeout(1000);
    
    // Now capture frames by advancing JS time
    for (let i = 0; i < frameCount; i++) {
      const frameInterval = Math.round(1000 / this.config.fps);
      
      // Advance JavaScript time
      await page.evaluate((deltaMs) => {
        if (window.__advanceTime) {
          return window.__advanceTime(deltaMs);
        }
      }, frameInterval);
      
      
      // Screenshot should work - no CDP virtual time involved
      const imgPath = path.join(screenshotDir, `frame_${String(i).padStart(4, '0')}.png`);
      await page.screenshot({ 
        path: imgPath, 
        timeout: 10000 
      });
      
    }
    
  } catch (error) {
    console.error(`❌ [${videoIndex + 1}] JS time control failed:`, error.message);
    throw error;
  }
}

  /**
   * Generate MP4 video using  FFmpeg 
   */
  async generateVideo(screenshotDir, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(screenshotDir, 'frame_%04d.png'))
        .inputFPS(this.config.fps)
        .outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p'])
        .output(outputPath)
        .on('end', () => {
          console.log(`✅ Video generated: ${path.basename(outputPath)}`);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ FFmpeg error:', error);
          reject(new Error(`Video generation failed: ${error.message}`));
        })
        .run();
    });
  }

  
/**
 * Upload video file to S3 and return S3 URL
 * @param {string} localFilePath - Path to local MP4 file
 * @param {string} bucketName - S3 bucket name
 * @param {string} folderPrefix - Optional folder prefix (e.g., 'converted-videos/')
 * @returns {Promise<string>} - S3 URL of uploaded file
 */
async uploadVideoToS3(localFilePath, bucketName, folderPrefix = 'converted-videos/') {
  try {
    console.log(`📤 Uploading ${path.basename(localFilePath)} to S3...`);

    // Read the file
    const fileContent = await fs.readFile(localFilePath);
    const fileName = path.basename(localFilePath);
    const s3Key = `${folderPrefix}${fileName}`;

    // Upload parameters
    const uploadParams = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'video/mp4',
      ACL: 'public-read', // Make it publicly accessible
      CacheControl: 'max-age=86400',
      Expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now
    };

    // Upload to S3
    const result = await s3.upload(uploadParams).promise();
    
    console.log(`✅ S3 upload successful: ${result.Location}`);
    
    // Clean up local file after successful upload
    try {
      await fs.unlink(localFilePath);
      console.log(`🗑️ Local file cleaned up: ${localFilePath}`);
    } catch (cleanupError) {
      console.warn(`⚠️ Could not clean up local file: ${cleanupError.message}`);
    }
    
    return result.Location;

  } catch (error) {
    console.error('❌ S3 upload failed:', error);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up SDK resources...');
    
    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.isInitialized = false;
    console.log('✅ SDK cleanup completed');
  }

  // Utility methods
  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  async removeDirectory(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Warning: Could not remove directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Get SDK status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasBrowser: !!this.browser,
      hasContext: !!this.context,
      config: this.config
    };
  }
}

module.exports = VideoConverterSDK;