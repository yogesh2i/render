import React from 'react';

const LoadingSpinner: React.FC<{ text?: string }> = ({ text }) => (
  <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded">
    <div className="flex items-center">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
      <span>{text || 'Loading...'}</span>
    </div>
  </div>
);

export default LoadingSpinner;
