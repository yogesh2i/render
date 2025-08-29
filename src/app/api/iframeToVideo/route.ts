import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface ConversionResult {
  index: number;
  url: string;
  filename?: string;
  success: boolean;
  error?: string;
  videoUrl?: string;
  processingTime?: number;
}

export async function POST(request: NextRequest) {
  try {
    const {urls, duration = 10 } = await request.json();
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'URLs array is required' },
        { status: 400 }
      );
    }

    console.log(`🚀 Starting batch conversion of ${urls.length} URLs using script...`);

    // Create temporary input file for the script
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const timestamp = Date.now();
    const inputFile = path.join(tempDir, `batch-input-${timestamp}.json`);
    
    const scriptInput = {
      urls: urls,
      duration: duration,
      outputDir: path.join(process.cwd(), 'public'),
      timestamp: timestamp
    };
    
    await fs.promises.writeFile(inputFile, JSON.stringify(scriptInput, null, 2));

    // Run your existing script
    const scriptPath = path.join(process.cwd(), 'scripts', 'iframeToVideo.js');
    const results = await runConversionScript(scriptPath, inputFile);
    
    // Clean up temp input file
    await fs.promises.unlink(inputFile);
    
    // Process results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    // Create video URLs array
    const videoUrls = successful.map(result => ({
      originalUrl: result.url,
      videoUrl: result.videoUrl, // Use the full URL from batchProcessor
      filename: result.filename
    }));

 
    return NextResponse.json({
      success: true,
      totalProcessed: urls.length,
      successfulConversions: successful.length,
      failedConversions: failed.length,
      videoUrls,
      results,
      message: `Converted ${successful.length}/${urls.length} URLs successfully`,
      processingTime: `Script completed in ${Date.now() - timestamp}ms`
    });

  } catch (error) {
    console.error('❌ Batch conversion error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Conversion failed' 
      },
      { status: 500 }
    );
  }
}

// Function to run your conversion script and capture results
async function runConversionScript(scriptPath: string, inputFile: string): Promise<ConversionResult[]> {
  return new Promise((resolve, reject) => {
    console.log(`📡 Running conversion script: ${scriptPath}`);
    
    // Run your script with input file as argument
    const child = spawn('node', [scriptPath, inputFile], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production' }
    });

    let stdout = '';
    let stderr = '';

    // Capture script output
    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      // Log script progress in real-time
      const lines = output.split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          console.log(`[Script] ${line.trim()}`);
        }
      });
    });

    child.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`[Script Error] ${error.trim()}`);
    });

    child.on('close', async (code) => {
      console.log(`📋 Script finished with exit code: ${code}`);
      
      if (code === 0) {
        try {
          // First try to read JSON results (preferred)
          const jsonPath = path.join(path.dirname(inputFile), 'conversion-results.json');
          
          if (fs.existsSync(jsonPath)) {
            console.log(`📄 Reading JSON results from: ${jsonPath}`);
            const resultsData = await fs.promises.readFile(jsonPath, 'utf8');
            const results = JSON.parse(resultsData);
            
            // Clean up results file
            await fs.promises.unlink(jsonPath);
            
            console.log(`✅ Successfully parsed ${results.length} results from JSON`);
            
            // Check if script reported failure (fail-fast mode)
            if (results.length > 0 && results[0]?.success === false) {
              console.error('❌ Script reported failure:', results[0].error);
              reject(new Error(`Conversion failed: ${results[0].error}`));
              return;
            }
            
            resolve(results);
          } else {
            // Fallback: try to parse from stdout
            console.log(`⚠️ JSON file not found, parsing from stdout`);
            const results = parseResultsFromOutput(stdout);
            resolve(results);
          }
        } catch (error) {
          reject(new Error(`Failed to read results: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      } else {
        reject(new Error(`Script failed with exit code ${code}. Error: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      console.error('❌ Script process error:', error);
      reject(new Error(`Script execution failed: ${error.message}`));
    });

    // Set timeout for long-running conversions (30 minutes)
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Script execution timeout (30 minutes)'));
    }, 30 * 60 * 1000);

    child.on('close', () => {
      clearTimeout(timeout);
    });
  });
}



// Fallback: parse results from script stdout
function parseResultsFromOutput(output: string): ConversionResult[] {
  const results: ConversionResult[] = [];
  const lines = output.split('\n');
  
  lines.forEach(line => {
    // Look for success patterns: "✅ [0] Success: filename.webm"
    const successMatch = line.match(/✅\s*\[(\d+)\]\s*Success:\s*(.+)/);
    if (successMatch) {
      const index = parseInt(successMatch[1]);
      const filename = successMatch[2].trim();
      
      // Find corresponding URL from previous processing logs
      const urlMatch = lines.find(l => l.includes(`Processing ${index + 1}/`));
      let url = '';
      if (urlMatch) {
        const urlExtract = urlMatch.match(/URL:\s*(.+)/);
        if (urlExtract) url = urlExtract[1].trim();
      }
      
      results.push({
        index,
        url,
        filename,
        success: true
      });
    }
    
    // Look for failure patterns: "❌ [0] Failed: error message"
    const failureMatch = line.match(/❌\s*\[(\d+)\]\s*Failed:\s*(.+)/);
    if (failureMatch) {
      const index = parseInt(failureMatch[1]);
      const error = failureMatch[2].trim();
      
      // Find corresponding URL
      const urlMatch = lines.find(l => l.includes(`Processing ${index + 1}/`));
      let url = '';
      if (urlMatch) {
        const urlExtract = urlMatch.match(/URL:\s*(.+)/);
        if (urlExtract) url = urlExtract[1].trim();
      }
      
      results.push({
        index,
        url,
        success: false,
        error
      });
    }
  });
  
  return results;
}