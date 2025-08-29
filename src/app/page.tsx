'use client'
import React, { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, durationInSeconds: 10 }),
      });
      const data = await res.json();
      if (data.success && data.viewUrl) {
        setVideoUrl(data.viewUrl);
      } else {
        setError(data.error || 'Conversion failed');
      }
    } catch (e) {
      setError('API error');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Convert Website to Video</h2>
      <input
        type="text"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="Enter website URL"
        style={{ width: '100%', marginBottom: 12, padding: 8 }}
      />
      <button onClick={handleConvert} disabled={loading || !url} style={{ padding: '8px 16px' }}>
        {loading ? 'Converting...' : 'Convert'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
      {videoUrl && (
        <div style={{ marginTop: 24 }}>
          <h3>Result Video:</h3>
          <video src={videoUrl} controls width="100%" />
          <div>
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">Open Video in New Tab</a>
          </div>
        </div>
      )}
    </div>
  );
}
