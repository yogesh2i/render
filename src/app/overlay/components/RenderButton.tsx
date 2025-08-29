import React from 'react';

const RenderButton: React.FC<{ isRendering: boolean; onClick: () => void }> = ({ isRendering, onClick }) => (
  <div className="flex justify-center mb-6">
    <button
      onClick={onClick}
      disabled={isRendering}
      className={`px-8 py-4 rounded-lg font-medium text-white text-lg ${
        isRendering
          ? 'bg-gray-500 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 transition-colors'
      }`}
    >
      {isRendering ? (
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Rendering Video...</span>
        </div>
      ) : (
        '🎬 Render Final Video'
      )}
    </button>
  </div>
);

export default RenderButton;
