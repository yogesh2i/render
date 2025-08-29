const path = require('path');
const Recorder = require('./recorder');     
const videoProcessorModule = require('./videoProcessor');
const fileUtilsModule = require('./fileUtils');

/**
 * Batch processing and concurrency management
 */
class BatchProcessor {
  constructor(config) {
    this.config = config;
    this.recorder = new Recorder(config);  // Recorder is a class
    this.videoProcessor = videoProcessorModule;  // VideoProcessor exports functions
    this.fileUtils = fileUtilsModule;  // FileUtils exports functions
  }

  /**
   * Process a batch of URLs with concurrency control
   */
  async processBatch(urls) {
    const results = [];
    const errors = [];
    
    console.log(`🚨 Processing ${urls.length} URLs with FAIL-FAST mode enabled`);
    console.log(`⚡ Will terminate immediately on first failure`);
    
    // Process URLs in batches according to MAX_CONCURRENT
    for (let i = 0; i < urls.length; i += this.config.MAX_CONCURRENT) {
      const batch = urls.slice(i, i + this.config.MAX_CONCURRENT);
      console.log(`\n🔄 Processing batch ${Math.floor(i / this.config.MAX_CONCURRENT) + 1} (${batch.length} URLs)`);
      
      const batchPromises = batch.map((urlData, index) => 
        this.processUrl(urlData, i + index + 1, urls.length)
      );
      
      try {
        // Use Promise.all instead of Promise.allSettled - fails fast on first error
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        console.log(`✅ Batch ${Math.floor(i / this.config.MAX_CONCURRENT) + 1} completed successfully`);
        
      } catch (error) {
        // First error encountered - terminate immediately
        console.error(`💥 BATCH FAILED: Error in batch ${Math.floor(i / this.config.MAX_CONCURRENT) + 1}`);
        console.error(`💥 Failing error: ${error.message}`);
        console.error(`🛑 TERMINATING ENTIRE PROCESS - No further URLs will be processed`);
        
        // Return failure immediately - don't process remaining batches
        throw new Error(`Conversion terminated due to failure: ${error.message}`);
      }
    }
    
    console.log(`🎉 ALL ${urls.length} URLs processed successfully - No failures detected`);
    return { results, errors: [] };
  }

  /**
   * Process a single URL
   */
  async processUrl(urlData, index, total) {
    const { url, duration } = urlData;
    
    try {
      console.log(`\n[${index}/${total}] Processing: ${url}`);
      
      // Record the website
      const recordingResult = await this.recorder.recordWebsiteDirect(url, duration);
      const { video, timestamp, outputDir } = recordingResult;
      
      // Wait for video file to be written
      const videoPath = await this.fileUtils.waitForVideoFile(video);
      
      // Debug: Check if videoPath is valid
      if (!videoPath || typeof videoPath !== 'string') {
        throw new Error(`Invalid video path received: ${videoPath}`);
      }
      
      console.log(`Video path: ${videoPath}`);
      
      // Process video (trim and get duration)
      const processedVideoPath = await this.videoProcessor.trimVideoSimple(
        videoPath, 
        duration, 
        this.config.OUTPUT_DIR, 
        timestamp
      );
      
      // Move to final location and get URL
      const finalPath = await this.fileUtils.moveToFinalLocation(processedVideoPath, this.config.OUTPUT_DIR, timestamp);
      
      // Clean up temporary files
      await this.fileUtils.cleanupTempFiles([videoPath, processedVideoPath], finalPath);
      
      const result = {
        url,
        videoPath: finalPath,
        videoUrl: `${this.config.BASE_URL_PUBLIC}/${path.basename(finalPath)}`,
        status: 'success',
        duration: await this.videoProcessor.detectVideoDuration(finalPath),
        processedAt: new Date().toISOString()
      };
      
      console.log(`✅ [${index}/${total}] Successfully processed: ${url}`);
      console.log(`   Video saved as: ${result.videoUrl}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [${index}/${total}] Failed to process ${url}:`, error);
      throw error;
    }
  }

  /**
   * Generate final report
   */
  generateReport(results, errors, startTime) {
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    const report = {
      summary: {
        total: results.length + errors.length,
        successful: results.length,
        failed: errors.length,
        duration: `${duration}s`,
        completedAt: endTime.toISOString()
      },
      successful: results,
      failed: errors
    };

    console.log('\n' + '='.repeat(50));
    console.log('BATCH PROCESSING COMPLETE');
    console.log('='.repeat(50));
    console.log(`Total URLs: ${report.summary.total}`);
    console.log(`Successful: ${report.summary.successful}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Duration: ${report.summary.duration}`);

    if (errors.length > 0) {
      console.log('\nFailed URLs:');
      errors.forEach(error => {
        console.log(`- ${error.url}: ${error.error}`);
      });
    }

    return report;
  }
}

module.exports = BatchProcessor;
