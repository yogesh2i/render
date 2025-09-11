// example.js
const path = require('path');
const fs = require('fs');

// Import the SDK function
const { convertUrlsToVideos } = require('./iframeToVideo');

// Path to your input file
const inputFile = path.join(__dirname, 'input.json');

// Read and parse input
const input = {
  "urls": [
    "https://project-real-time-language-translation-animation-828.magicpatterns.app/"
  ],
  "duration": 7,
  "outputDir": "./output"
}
// const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const { urls, duration, outputDir } = input;

// Call the SDK function
convertUrlsToVideos({ urls, duration, outputDir, inputFile })
  .then(report => {
    console.log('Conversion report:', report);
  })
  .catch(error => {
    console.error('Error during conversion:', error.message);
  });