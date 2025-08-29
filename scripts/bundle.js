import { bundle } from '@remotion/bundler';
import path from 'path';

async function createBundle() {
  console.log('Creating Remotion bundle...');
  
  const bundleLocation = await bundle({
    entryPoint: path.join('/tmp', 'src/remotion/index.ts'),
    webpackOverride: (config) => config,
  });

  console.log('Bundle created at:', bundleLocation);
  
  // Save the bundle location to a file
  const fs = await import('fs');
  const bundleInfo = {
    bundleLocation,
    createdAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join('/tmp', 'bundle-info.json'),
    JSON.stringify(bundleInfo, null, 2)
  );
  
  console.log('Bundle info saved to bundle-info.json');
}

createBundle().catch(console.error);
