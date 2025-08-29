import React from 'react';

const VideoPreview: React.FC<{
  renderedVideoUrl: string;
  filename: string | null;
  onCopy: () => void;

}> = ({ renderedVideoUrl, filename, onCopy}) => (
  <>
      <video src={renderedVideoUrl} controls className="rounded" />
  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
    <h3 className="text-xl font-semibold mb-4 text-green-800">✅ Video Rendered Successfully!</h3>
    <div className="flex flex-wrap gap-3 mt-4">
      <a
        href={renderedVideoUrl}
        download={filename || 'video-overlay.mp4'}
        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        📥 Download {filename}
      </a>
      <button
        onClick={onCopy}
        className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        📋 Copy Full URL
      </button>
     
    </div>
    <div className="mt-4 text-sm text-gray-600">
      <p><strong>File:</strong> {filename}</p>
      <p><strong>Path:</strong> {renderedVideoUrl}</p>
    </div>
  </div>
        </>
);

export default VideoPreview;
