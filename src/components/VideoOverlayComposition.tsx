'use client'
import React from 'react';
import { AbsoluteFill, Sequence, OffthreadVideo} from 'remotion';

interface VideoData {
  media_url: string;
  start_frame: number;
  end_frame: number;
  videoUrl?: string | null;
  isConverted?: boolean;
}

interface VideoOverlayCompositionProps {
  videos?: VideoData[];
  baseVideo?: {
    url: string;
  };
  width?: number;
  height?: number;
  duration?: number;
}

export const VideoOverlayComposition: React.FC<VideoOverlayCompositionProps> = ({ 
  videos = [],
  baseVideo,
  width = 1080,
  height = 1920,
  duration = 10
}) => {
  const fps = 30;
  const totalFrames = Math.round(duration * fps);
  
  console.log(`🎬 Composition: ${width}x${height}, ${duration}s (${totalFrames} frames)`);
  console.log(`📹 Videos to render: ${videos.length}`);

  if(baseVideo){
  return (
    
    <AbsoluteFill>
          <Sequence from={0} durationInFrames={totalFrames}>
            <OffthreadVideo
              src={baseVideo.url}
              pauseWhenBuffering={true}
              style={{ 
                width, 
                height,
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0
              }}
            />
          </Sequence>
          
          {/* Render all video overlays using frame-based positioning */}
          {videos.map((video: VideoData, index: number) => {
            // Use frames directly - no conversion needed!
            const durationInFrames = video.end_frame - video.start_frame;
            
            return (
              <Sequence 
                key={index}
                from={video.start_frame} 
                durationInFrames={durationInFrames}
                premountFor={60}
              >
                <OffthreadVideo
                  src={video.videoUrl!}
                  style={{ 
                    width, 
                    height,
                    objectFit: 'cover',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}
                />
              </Sequence>
            );
          })}
    </AbsoluteFill>
  );
} else{
    return <p>Working on it</p>
}
};
