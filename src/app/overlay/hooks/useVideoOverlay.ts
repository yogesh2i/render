import { useState, useEffect } from 'react';

export interface VideoData {
  media_url: string;
  start_frame: number;
  end_frame: number;
  videoUrl?: string | null;
  isConverted?: boolean;
}

export interface UseVideoOverlayResult {
  videosWithConverted: VideoData[];
  isConverting: boolean;
  conversionError: string | null;
  convertUrls: () => void;
  isRendering: boolean;
  renderedVideoUrl: string | null;
  filename: string | null;
  renderError: string | null;
  handleRender: () => void;
}

export function useVideoOverlay(defaultData: {
  base_url: string;
  videos: VideoData[];
}): UseVideoOverlayResult {
  const [videosWithConverted, setVideosWithConverted] = useState<VideoData[]>([]);
  const [isConverting, setIsConverting] = useState(true);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const [isRendering, setIsRendering] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    convertUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const convertUrls = async () => {
    setIsConverting(true);
    setConversionError(null);

    try {
      const response = await fetch('/api/iframeToVideo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: defaultData.videos.map((video) => video.media_url),
          duration: 10
        })
      });

      const result = await response.json();

      if (result.success) {
        const updatedVideos = defaultData.videos.map((video) => {
          const convertedVideo = result.results.find((convertedVid:any) =>
            convertedVid.originalUrl === video.media_url
          );
          return {
            ...video,
            videoUrl: convertedVideo ? convertedVideo.videoUrl : null,
            isConverted: !!convertedVideo
          };
        });
        setVideosWithConverted(updatedVideos);
      } else {
        setConversionError(result.error);
      }
    } catch (error) {
      console.log(error);
      setConversionError('Failed to convert URLs');
    } finally {
      setIsConverting(false);
    }
  };

  const handleRender = async () => {
    setIsRendering(true);
    setRenderError(null);
    try {
      const response = await fetch('/api/overlay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseVideo: { url: defaultData.base_url },
          layers: videosWithConverted
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setRenderedVideoUrl(data.downloadUrl);
        setFilename(data.filename);
      } else {
        setRenderError(data.error || 'Render failed');
      }
    } catch (error) {
      setRenderError('Failed to render video');
    } finally {
      setIsRendering(false);
    }
  };

  return {
    videosWithConverted,
    isConverting,
    conversionError,
    convertUrls,
    isRendering,
    renderedVideoUrl,
    filename,
    renderError,
    handleRender,
  };
}
