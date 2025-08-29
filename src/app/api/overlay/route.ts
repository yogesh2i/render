import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import {parseMedia} from '@remotion/media-parser';

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';

const getVideoMetadata = async (url:string)=>{

  const {durationInSeconds, dimensions} = await parseMedia({src: url, fields: {durationInSeconds: true, dimensions: true}});
  return {duration: durationInSeconds, width: dimensions?.width, height: dimensions?.height};
}

export const POST = async (request: NextRequest) => {
  try {
   
    const {baseVideo, layers} = await request.json();

    console.log(`📊 Received ${layers.length} video overlays for rendering`);
    
    const { duration, width, height } = await getVideoMetadata(baseVideo.url);
    console.log(`📐 Base video: ${width}x${height}, ${duration}s duration`);

    const bundleInfoPath = path.join(process.cwd(), 'bundle-info.json');
    if (!fs.existsSync(bundleInfoPath)) {
      throw new Error('Bundle not found. Please run "npm run bundle" first.');
    }

    const bundleInfo = JSON.parse(fs.readFileSync(bundleInfoPath, 'utf8'));
    const bundleLocation = bundleInfo.bundleLocation;

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'overlay-frame',
      inputProps: {
        baseVideo, 
        videos: layers,  // Use 'videos' instead of 'layers' to match component
        width, 
        height, 
        duration
      }
    });

    const timestamp = Date.now();
    const filename = `${'overlay'}-${timestamp}.mp4`;
    const outputLocation = path.join(process.cwd(), 'public', filename);

    const browser = await openBrowser("chrome", {
      chromiumOptions: {
        disableWebSecurity: true,
        gl: "angle",
        enableMultiProcessOnLinux: true,
        
      },

    });
    const chromiumPath = puppeteer.executablePath();

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      puppeteerInstance: browser,
      browserExecutable: chromiumPath,
      outputLocation,
      inputProps: {baseVideo, layers, width, height, duration},
      timeoutInMilliseconds: 180000,
      concurrency: 1,
      // Use the detected resolution for rendering
      scale: 1,
      onProgress: ({ progress }) => {
        console.log(`Rendering progress: ${(progress * 100).toFixed(1)}%`);
      },
    });

    await browser.close({ silent: true });
    // free();
    return NextResponse.json({ 
      success: true, 
      downloadUrl: `/${filename}`,
      filename,
      message: 'Video rendered successfully!' 
    });

  } catch (error) {
    console.error('Rendering error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to render video' 
      },
      { status: 500 }
    );
  }
};
