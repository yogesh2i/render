import React from 'react';

const ErrorAlert: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
    <div className="flex justify-between items-center">
      <div className="flex">
        <span className="text-red-500 mr-3">❌</span>
        <span>{error}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  </div>
);

export default ErrorAlert;
