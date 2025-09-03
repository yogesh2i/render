/**
 * Video Converter SDK
 * Uses  screenshot + FFmpeg logic with JSON input/output
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const { timeout, ScreenRecorder } = require('puppeteer');
const { error } = require('console');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

class VideoConverterSDK {
  constructor(options = {}) {
    this.config = {
      outputDir: options.outputDir || './public/converted-videos',
      tempDir: options.tempDir || './temp',
      screenshotDir: options.screenshotDir || './temp/screenshots', 
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
    if (!inputJSON || !inputJSON.videos || !Array.isArray(inputJSON.videos)) {
      throw new Error('Invalid input: videos array is required');
    }

    // Initialize if needed
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      console.log(`📝 Processing ${inputJSON.videos.length} videos in parallel...`);

      // Process all videos in parallel using single browser/context
      const videoPromises = inputJSON.videos.map(async (video, index) => {
        try {
          const result = await this.processVideo(video, index);
          return {
            ...video, // Keep original fields: media_url, start_frame, end_frame
            converted_url: result.converted_url
          };
        } catch (error) {
          console.error(`❌ Video ${index + 1} failed:`, error.message);
          return {
            ...video,
            converted_url: '', // Empty URL on failure
            error: error.message
          };
        }
      });

      // Wait for all videos to complete
      const processedVideos = await Promise.all(videoPromises);

      // Build output JSON in same format as input
      const output = {
        base_url: inputJSON.base_url || '',
        videos: processedVideos
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
    const { media_url, start_frame, end_frame } = video;
    
    // Validate video data
    if (!media_url || typeof start_frame !== 'number' || typeof end_frame !== 'number') {
      throw new Error('Invalid video data: media_url, start_frame, and end_frame are required');
    }

    // const frameCount = end_frame - start_frame + 1;
    // const duration = frameCount / this.config.fps;
      const frameCount = this.config.duration * this.config.fps;  
  const duration = this.config.duration;
    const projectId = `sdk_${Date.now()}_${index}`;
    
    console.log(`🔄 [${index + 1}] Processing: ${media_url} (frames ${start_frame}-${end_frame})`);

    // Create unique directories for this video
    const videoScreenshotDir = path.join(this.config.screenshotDir, `video_${projectId}`);
    await this.ensureDirectory(videoScreenshotDir);

    const urlObject = new URL(media_url);
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
        await loadingPage.goto(media_url, { 
          waitUntil: 'networkidle', 
          timeout: 60000  // Increased timeout for slow sites
        });
      
//wait for contents to be cached
  await new Promise(resolve => setTimeout(resolve, 5000));

  
        // Page 2: Screenshot page (domcontentloaded) - fast, uses cached resources  
        await screenshotPage.goto(media_url, { 
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

          // Clean up screenshots
          await this.removeDirectory(videoScreenshotDir);

          // Create converted URL using domain name (as requested)
          const convertedUrl = `${this.config.baseUrl}/${outputFilename}/`;

          console.log(`✅ [${index + 1}] Video completed: ${outputFilename}`);

          return {
            converted_url: convertedUrl
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