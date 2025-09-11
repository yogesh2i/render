const {  devices } = require('playwright');
const iphone12 = devices['iPhone 12'];
/**
 * Website recording logic using Playwright
 */
class Recorder {
  constructor(config) {
    this.config = config;
  }

  /**
   * Record a website directly with pre-loading optimization
   */
  async recordWebsiteDirect(url, duration,browser) {
  
    let context = null;
    
    try {
      console.log(`Recording ${url} for ${duration}s`);
      
    
      
      const timestamp = Date.now();
      const outputDir = this.config.OUTPUT_DIR;
      
      // First load page WITHOUT recording (optimization)
      let context = await browser.newContext({
        ...iphone12,
        recordVideo: {
          dir: outputDir,
          size:  iphone12.viewport
        }
      });

  
      
      console.log('📥 Loading website...');
     
      const page = await context.newPage();
      
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 15000 
        });
      } catch (recordingNavigationError) {
        throw new Error(`Failed to navigate during recording ${url}: ${recordingNavigationError.message}`);
      }
      
      // Record ONLY for the specified duration
      console.log(`⏱️  Recording for exactly ${duration} seconds...`);
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
      
      return { video, timestamp, outputDir };
      
    } catch (error) {
      console.error(`❌ Recording failed for ${url}:`, error.message);
      
      // Throw with clear context for fail-fast behavior
      throw new Error(`Recording failed for ${url}: ${error.message}`);
    } finally {
      try {
        if (context) await context.close();
      } catch (e) {
        console.warn('Cleanup error');
      }
    }
  }
}

module.exports = Recorder;
