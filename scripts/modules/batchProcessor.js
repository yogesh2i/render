// const path = require('path');
// const Recorder = require('./recorder');     
// const videoProcessorModule = require('./videoProcessor');
// const fileUtilsModule = require('./fileUtils');
// const { chromium } = require('playwright');
// const AWS = require('aws-sdk');
// const fs = require('fs').promises;

// const s3 = new AWS.S3();

// async function uploadVideoToS3(localFilePath, bucketName, folderPrefix = 'converted-videos/') {
//   try {
//     console.log(`📤 Uploading ${path.basename(localFilePath)} to S3...`);
//     const fileContent = await fs.readFile(localFilePath);
//     const fileName = path.basename(localFilePath);
//     const s3Key = `${folderPrefix}${fileName}`;
//     const uploadParams = {
//       Bucket: bucketName,
//       Key: s3Key,
//       Body: fileContent,
//       ContentType: 'video/mp4',
//       ACL: 'public-read',
//       CacheControl: 'max-age=86400'
//     };
//     const result = await s3.upload(uploadParams).promise();
//     console.log(`✅ S3 upload successful: ${result.Location}`);
//     // Clean up local file after successful upload
//     try {
//       await fs.unlink(localFilePath);
//       console.log(`🗑️ Local file cleaned up: ${localFilePath}`);
//     } catch (cleanupError) {
//       console.warn(`⚠️ Could not clean up local file: ${cleanupError.message}`);
//     }
//     return result.Location;
//   } catch (error) {
//     console.error('❌ S3 upload failed:', error);
//     throw new Error(`S3 upload failed: ${error.message}`);
//   }
// }
// /**
//  * Batch processing and concurrency management
//  */
// class BatchProcessor {
//   constructor(config) {
//     this.config = config;
//     this.recorder = new Recorder(config);  // Recorder is a class
//     this.videoProcessor = videoProcessorModule;  // VideoProcessor exports functions
//     this.fileUtils = fileUtilsModule;  // FileUtils exports functions
//   }

//   /**
//    * Process a batch of URLs with concurrency control
//    */
//   async processBatch(urls) {
//     const results = [];
//     const errors = [];
    
//     console.log(`🚨 Processing ${urls.length} URLs with FAIL-FAST mode enabled`);
//     console.log(`⚡ Will terminate immediately on first failure`);
//     const browser = await chromium.launch({ 
//         headless: true,
//         args: [
//           '--no-sandbox',
//           '--disable-dev-shm-usage',
//           '--disable-web-security',
//           '--allow-running-insecure-content'
//         ]
//       });
//     // Process URLs in batches according to MAX_CONCURRENT
//     for (let i = 0; i < urls.length; i += this.config.MAX_CONCURRENT) {
//       const batch = urls.slice(i, i + this.config.MAX_CONCURRENT);
//       console.log(`\n🔄 Processing batch ${Math.floor(i / this.config.MAX_CONCURRENT) + 1} (${batch.length} URLs)`);
      
//       const batchPromises = batch.map((urlData, index) => 
//         this.processUrl(urlData, i + index + 1, urls.length,browser)
//       );
      
//       try {
//         // Use Promise.all instead of Promise.allSettled - fails fast on first error
//         const batchResults = await Promise.all(batchPromises);
//         results.push(...batchResults);
//         console.log(`✅ Batch ${Math.floor(i / this.config.MAX_CONCURRENT) + 1} completed successfully`);
        
//       } catch (error) {
//         // First error encountered - terminate immediately
//         console.error(`💥 BATCH FAILED: Error in batch ${Math.floor(i / this.config.MAX_CONCURRENT) + 1}`);
//         console.error(`💥 Failing error: ${error.message}`);
//         console.error(`🛑 TERMINATING ENTIRE PROCESS - No further URLs will be processed`);
        
//         // Return failure immediately - don't process remaining batches
//         throw new Error(`Conversion terminated due to failure: ${error.message}`);
//       }
//     }
    
//     console.log(`🎉 ALL ${urls.length} URLs processed successfully - No failures detected`);
//     if (browser) await browser.close();
//     return { results, errors: [] };
//   }

//   /**
//    * Process a single URL
//    */
//   async processUrl(urlData, index, total,browser) {
//     const { url, duration } = urlData;
    
//     try {
//       console.log(`\n[${index}/${total}] Processing: ${url}`);
      
//       // Record the website
//       const recordingResult = await this.recorder.recordWebsiteDirect(url, duration,browser);
//       const { video, timestamp, outputDir } = recordingResult;
      
//       // Wait for video file to be written
//       const videoPath = await this.fileUtils.waitForVideoFile(video);
      
//       // Debug: Check if videoPath is valid
//       if (!videoPath || typeof videoPath !== 'string') {
//         throw new Error(`Invalid video path received: ${videoPath}`);
//       }
      
//       console.log(`Video path: ${videoPath}`);
      
//       // Process video (trim only)
//       const processedVideoPath = await this.videoProcessor.trimVideoSimple(
//         videoPath, 
//         duration, 
//         this.config.OUTPUT_DIR, 
//         timestamp
//       );

//       // Use the domain name from the URL for the output filename
//       const urlObj = new URL(url);
//       const domainName = urlObj.hostname;
//       const customFilename = `${domainName}.webm`;
//       const customFinalPath = path.join(this.config.OUTPUT_DIR, customFilename);

//       const fsSync = require('fs');
//       if (!fsSync.existsSync(processedVideoPath)) {
//         console.error(`❌ Trimmed video file not found: ${processedVideoPath}`);
//         throw new Error(`Trimmed video file not found: ${processedVideoPath}`);
//       }
//         // If the processed video is not already named as desired, rename it
//         if (processedVideoPath !== customFinalPath) {
//           await fs.rename(processedVideoPath, customFinalPath);
//         }

//       // Clean up temporary files
//         await this.fileUtils.cleanupTempFiles([videoPath], customFinalPath);

//       // Upload to S3 and get the S3 URL, using the custom filename
//       const bucketName =  'magicmotion-export';
//       const s3Url = await uploadVideoToS3(customFinalPath, bucketName, 'converted-videos/');
//       const result = {
//         url,
//         videoPath: customFinalPath,
//         videoUrl: s3Url,
//         status: 'success',
//         processedAt: new Date().toISOString()
//       };
//       console.log(`✅ [${index}/${total}] Successfully processed: ${url}`);
//       console.log(`   Video uploaded to S3: ${result.videoUrl}`);
//       return result;
      
//     } catch (error) {
//       console.error(`❌ [${index}/${total}] Failed to process ${url}:`, error);
//       throw error;
//     }
//   }

//   /**
//    * Generate final report
//    */
//   generateReport(results, errors, startTime) {
//     const endTime = new Date();
//     const duration = Math.round((endTime - startTime) / 1000);
    
//     const report = {
//       summary: {
//         total: results.length + errors.length,
//         successful: results.length,
//         failed: errors.length,
//         duration: `${duration}s`,
//         completedAt: endTime.toISOString()
//       },
//       successful: results,
//       failed: errors
//     };

//     console.log('\n' + '='.repeat(50));
//     console.log('BATCH PROCESSING COMPLETE');
//     console.log('='.repeat(50));
//     console.log(`Total URLs: ${report.summary.total}`);
//     console.log(`Successful: ${report.summary.successful}`);
//     console.log(`Failed: ${report.summary.failed}`);
//     console.log(`Duration: ${report.summary.duration}`);

//     if (errors.length > 0) {
//       console.log('\nFailed URLs:');
//       errors.forEach(error => {
//         console.log(`- ${error.url}: ${error.error}`);
//       });
//     }

//     return report;
//   }
// }

// module.exports = BatchProcessor;
const path = require('path');
const Recorder = require('./recorder');     
const videoProcessorModule = require('./videoProcessor');
const fileUtilsModule = require('./fileUtils');
const { chromium } = require('playwright');
const AWS = require('aws-sdk');
const fs = require('fs').promises;

const s3 = new AWS.S3();

async function uploadVideoToS3(localFilePath, bucketName, folderPrefix = 'converted-videos/') {
  try {
    console.log(`📤 Uploading ${path.basename(localFilePath)} to S3...`);
    const fileContent = await fs.readFile(localFilePath);
    const fileName = path.basename(localFilePath);
    const s3Key = `${folderPrefix}${fileName}`;
    const uploadParams = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'video/mp4',
      ACL: 'public-read',
      CacheControl: 'max-age=86400'
    };
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
    const browser = await chromium.launch({ 
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--allow-running-insecure-content'
        ]
      });
    // Process URLs in batches according to MAX_CONCURRENT
    for (let i = 0; i < urls.length; i += this.config.MAX_CONCURRENT) {
      const batch = urls.slice(i, i + this.config.MAX_CONCURRENT);
      console.log(`\n🔄 Processing batch ${Math.floor(i / this.config.MAX_CONCURRENT) + 1} (${batch.length} URLs)`);
      
      const batchPromises = batch.map((urlData, index) => 
        this.processUrl(urlData, i + index + 1, urls.length,browser)
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
    if (browser) await browser.close();
    return { results, errors: [] };
  }

/**
 * Process a single URL
 */
async processUrl(urlData, index, total, browser) {
  const { url, duration } = urlData;
  try {
    console.log(`\n[${index}/${total}] Processing: ${url}`);

    // Record the website
    const recordingResult = await this.recorder.recordWebsiteDirect(url, duration, browser);
    const { video, timestamp, outputDir } = recordingResult;

    // Wait for video file to be written
    const videoPath = await this.fileUtils.waitForVideoFile(video);

    // Check if video was recorded
    if (!videoPath || typeof videoPath !== 'string') {
      console.error(`❌ Video recording failed for URL: ${url}`);
      return {
        url,
        status: 'error',
        error: 'Video recording failed',
        processedAt: new Date().toISOString()
      };
    }

    console.log(`Video path: ${videoPath}`);

    // Process video (trim only)
    const processedVideoPath = await this.videoProcessor.trimVideoSimple(
      videoPath,
      duration,
      this.config.OUTPUT_DIR,
      timestamp
    );

    // Check if video was trimmed
    if (!processedVideoPath || typeof processedVideoPath !== 'string') {
      console.error(`❌ Video trimming failed for URL: ${url}`);
      return {
        url,
        status: 'error',
        error: 'Video trimming failed',
        processedAt: new Date().toISOString()
      };
    }

    // Use the domain name from the URL for the output filename
    const urlObj = new URL(url);
    const domainName = urlObj.hostname;
    const customFilename = `${domainName}.webm`;
    const customFinalPath = path.join(this.config.OUTPUT_DIR, customFilename);

    const fsSync = require('fs');
    if (!fsSync.existsSync(processedVideoPath)) {
      console.error(`❌ Trimmed video file not found: ${processedVideoPath}`);
      throw new Error(`Trimmed video file not found: ${processedVideoPath}`);
    }

    // If the processed video is not already named as desired, rename it
    if (processedVideoPath !== customFinalPath) {
      await fs.rename(processedVideoPath, customFinalPath);
    }

    // Clean up temporary files
    await this.fileUtils.cleanupTempFiles([videoPath], customFinalPath);

    // Upload to S3 and get the S3 URL, using the custom filename
    const bucketName = 'magicmotion-export';
    const s3Url = await uploadVideoToS3(customFinalPath, bucketName, 'converted-videos/');
    const result = {
      url,
      videoPath: customFinalPath,
      videoUrl: s3Url,
      status: 'success',
      processedAt: new Date().toISOString()
    };
    console.log(`✅ [${index}/${total}] Successfully processed: ${url}`);
    console.log(`   Video uploaded to S3: ${result.videoUrl}`);
    return result;

  } catch (error) {
    console.error(`❌ [${index}/${total}] Failed to process ${url}:`, error);
    throw error;
  }
}

}

module.exports = BatchProcessor;
