**Remotion Iframe-to-Video Overlay Project**

*Overview*

This project converts a list of iframe URLs to MP4 videos and then renders a final overlay video using Remotion.
It uses a two-step approach:

Converts iframe URLs to MP4 videos (using data from input.json).
Renders the overlay video after clicking the "Render Video" button.

Setup Instructions:

1. Install Dependencies

```bash
npm install
```

2. Provide Input Data
Edit the file:
```bash 
src/app/overlay/input.json
```
Format example:
```json
{
  "base_url": "https://your-base-video-url.mp4",
  "videos": [
    {
      "media_url": "https://your-iframe-url-1/",
      "start_frame": 0,
      "end_frame": 200
    },
    {
      "media_url": "https://your-iframe-url-2/",
      "start_frame": 201,
      "end_frame": 400
    }
  ]
}
```

3. Start the Development Server

```bash
npm run dev
```
4. Run the Workflow

    1. Visit http://localhost:3000/overlay in your browser.
    2. The app will automatically read data from input.json and start converting the iframe URLs to MP4 videos.
    3. Once conversion is complete, click the Render Video button to generate the final overlay video.
    4. Download or preview the rendered video as needed.

**Notes**
    1. Make sure your input URLs are correct and accessible.
    2. Output dir, concurrent jobs can be configured in scripst/modules/config.ts
    3. The conversion and rendering process may take some time depending on the number of URLs and video durations.
    4. Output videos are saved in the public directory.

**Troubleshooting**
    1.If you encounter errors, check the terminal and browser console for details.
    2.Ensure all dependencies are installed and your input data is valid.
