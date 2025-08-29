'use client'
import React from 'react';
import { useVideoOverlay } from './hooks/useVideoOverlay';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorAlert from './components/ErrorAlert';
import RenderButton from './components/RenderButton';
import VideoPreview from './components/VideoPreview';

import defaultData from './input.json'; 


const Page: React.FC = () => {
  const {
    videosWithConverted,
    isConverting,
    conversionError,
    convertUrls,
    isRendering,
    renderedVideoUrl,
    filename,
    renderError,
    handleRender,
  } = useVideoOverlay(defaultData);

  return (
    <div className="max-w-6xl mx-auto mt-8 p-6">
      <h2 className="text-2xl font-semibold mb-6">Video Overlay</h2>
      {/* Conversion Status */}
      {isConverting && <LoadingSpinner text="Converting URLs to videos..." />}
      {conversionError && <ErrorAlert error={conversionError} onRetry={convertUrls} />}
      {/* Render Button */}
      <RenderButton isRendering={isRendering} onClick={handleRender} />
      {/* Error Message */}
      {renderError && <ErrorAlert error={renderError} />}
      {/* Rendered Video */}
      {renderedVideoUrl && (
        <VideoPreview
          renderedVideoUrl={renderedVideoUrl}
          filename={filename}
          onCopy={() => {
            navigator.clipboard.writeText(window.location.origin + renderedVideoUrl);
            alert('Video URL copied to clipboard!');
          }}
          
        />
      )}
    </div>
  );
};

export default Page;