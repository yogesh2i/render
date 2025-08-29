const path = require('path');
const configModule = require(path.join(__dirname, 'modules', 'config'));
const BatchProcessor = require(path.join(__dirname, 'modules', 'batchProcessor'));
const fileUtilsModule = require(path.join(__dirname, 'modules', 'fileUtils'));

/**
 * Main function - orchestrates the conversion process
 */
async function main() {
  const startTime = new Date();
  
  try {
    console.log('🎬 Starting iframe to video conversion (FAIL-FAST MODE)...');
    console.log('⚡ Process will terminate immediately on any single failure');
    
    // Parse input configuration using config module functions
    const { urls, duration, outputDir, inputFile } = configModule.parseInput();
    
    // Setup directories
    configModule.setupDirectories(outputDir);
    
    // Create configuration object
    const config = configModule.createConfig(urls, duration, outputDir);
    config.inputFile = inputFile; // Add input file for API mode detection
    
    console.log(`🚀 Processing ${urls.length} URLs with ${duration}s duration`);
    console.log(`📁 Output directory: ${outputDir}`);
    console.log(`🔄 Max concurrent: ${config.MAX_CONCURRENT}`);
    
    // Format URLs for batch processor (each URL needs duration)
    const formattedUrls = urls.map(url => ({
      url: url,
      duration: duration
    }));
    
    // Initialize batch processor (BatchProcessor is a class)
    const batchProcessor = new BatchProcessor(config);
    
    // Process all URLs - will throw on first failure
    console.log('🚨 Starting fail-fast processing...');
    const { results, errors } = await batchProcessor.processBatch(formattedUrls);
    
    // If we reach here, all conversions succeeded
    console.log('🎉 ALL CONVERSIONS SUCCESSFUL - No failures detected');
    const report = batchProcessor.generateReport(results, errors, startTime);
    
    // Write results to file if running from API
    if (inputFile) {
      const path = require('path');
      const outputPath = path.join(path.dirname(inputFile), 'conversion-results.json');
      
      // Format results for API compatibility
      const apiResults = results.map(r => ({
        originalUrl: r.url,
        videoUrl: r.videoUrl,
        filename: r.videoUrl.split('/').pop(),
        success: true
      }));
      
      await fileUtilsModule.writeJSONResults(apiResults, outputPath);
    }
    
    // Final summary
    console.log('\n✅ Script completed successfully - ALL URLS CONVERTED');
    console.log(`📊 Final: ${results.length} successful, 0 failed`);
    
    return report;
    
  } catch (error) {
    console.error('💥 CONVERSION PROCESS FAILED:', error.message);
    console.error('🛑 TERMINATING - No partial results will be saved');
    
    // Write failure result immediately
    if (inputFile) {
      const path = require('path');
      const outputPath = path.join(path.dirname(inputFile), 'conversion-results.json');
      
      fileUtilsModule.writeFailureResult(error, outputPath);
    }
    
    // Re-throw to ensure process exits with error
    throw error;
  }
}

/**
 * Entry point - run the main function
 */
main()
  .then((report) => {
    console.log('\n🎉 All conversions completed successfully!');
    console.log(`📈 Success rate: 100% (${report.summary.successful}/${report.summary.total})`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 FATAL ERROR - PROCESS TERMINATED:', error.message);
    process.exit(1);
  });
