const { chromium, devices } = require('playwright')
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const AWS = require('aws-sdk')
const fs = require('fs').promises
const fsSync = require('fs')
const path = require('path')

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath)

class IframeToVideoSDK {
  constructor(config = {}) {
    this.config = {
      OUTPUT_DIR: config.outputDir || './tmp',
      AWS_REGION: config.awsRegion || 'region',
      S3_BUCKET: config.s3Bucket || 'bucket',
      S3_FOLDER_PREFIX: config.s3FolderPrefix || 'converted-videos/',
      DEFAULT_DURATION: config.defaultDuration || 10,
      MAX_WAIT_TIME: config.maxWaitTime || 60000,
      ...config,
    }

    this.s3 = new AWS.S3({
      region: this.config.AWS_REGION,
    })

    this.browser = null
    this.isInitialized = false
  }

  async initialize() {
    try {
      console.log('🚀 Initializing SDK...')

      // Ensure output directory exists
      await fs.mkdir(this.config.OUTPUT_DIR, { recursive: true })

      // Launch browser
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })

      this.isInitialized = true
      console.log('✅ SDK initialized successfully')
    } catch (error) {
      console.error('❌ SDK initialization failed:', error)
      throw new Error(`SDK initialization failed: ${error.message}`)
    }
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
      this.isInitialized = false
      console.log('🧹 SDK cleanup completed')
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message)
    }
  }

  async waitForVideoFile(video, maxWaitTime = 60000) {
    const startTime = Date.now()
    let videoPath = null
    let lastSize = 0
    let stableCount = 0

    console.log('⏳ Waiting for video file...')

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Get video path
        if (!videoPath) {
          videoPath = await video.path()
          if (!videoPath) {
            await new Promise((resolve) => setTimeout(resolve, 500))
            continue
          }
        }

        // Check if file exists and has content
        if (fsSync.existsSync(videoPath)) {
          const stats = fsSync.statSync(videoPath)
          const currentSize = stats.size

          console.log(`📹 Video file size: ${Math.round(currentSize / 1024)}KB`)

          if (currentSize > 0) {
            // Check if size is stable
            if (currentSize === lastSize) {
              stableCount++
              if (stableCount >= 3) {
                console.log('✅ Video file ready')
                return videoPath
              }
            } else {
              stableCount = 0
            }
            lastSize = currentSize
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        console.error('❌ Error waiting for video file:', error.message)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    const errorMsg = `Video file not ready within timeout (${maxWaitTime}ms). VideoPath: ${videoPath}`
    console.error(`💥 ${errorMsg}`)
    throw new Error(errorMsg)
  }

  async recordWebsiteDirect(url, duration) {
    let context = null

    try {
      console.log(`🎬 Recording ${url} for ${duration}s`)

      const timestamp = Date.now()
      const outputDir = this.config.OUTPUT_DIR

      // iPhone 12 device configuration
      const device = devices['Galaxy S24']

      // Create context with video recording
      context = await this.browser.newContext({
        ...device,
        recordVideo: {
          dir: outputDir,
          size: device.viewport,
        },
      })

      console.log('📥 Loading website...')
      const page = await context.newPage()

      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        })
      } catch (recordingNavigationError) {
        throw new Error(
          `Failed to navigate during recording ${url}: ${recordingNavigationError.message}`
        )
      }

      // Record for the specified duration
      console.log(`⏱️ Recording for exactly ${duration} seconds...`)
      await page.waitForTimeout(duration * 1000)

      console.log('🎬 Recording completed, finalizing...')

      // Get video before closing
      const video = page.video()
      if (!video) {
        throw new Error('Video recording failed')
      }

      // Close context to save video
      await context.close()
      context = null

      return { video, outputDir }
    } catch (error) {
      console.error(`❌ Recording failed for ${url}:`, error.message)
      throw new Error(`Recording failed for ${url}: ${error.message}`)
    } finally {
      try {
        if (context) await context.close()
      } catch (e) {
        console.warn('⚠️ Context cleanup error:', e.message)
      }
    }
  }

  async detectVideoDuration(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output('-')
        .format('null')
        .on('stderr', (stderrLine) => {
          const durationMatch = stderrLine.match(
            /time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/
          )
          if (durationMatch) {
            const hours = parseInt(durationMatch[1])
            const minutes = parseInt(durationMatch[2])
            const seconds = parseFloat(durationMatch[3])
            const totalSeconds = hours * 3600 + minutes * 60 + seconds
            resolve(totalSeconds)
          }
        })
        .on('error', reject)
        .run()
    })
  }

  async trimVideoSimple(inputPath, targetDuration, outputDir, filename) {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(outputDir, `${filename}.mp4`)

      console.log('📏 Getting video duration using ffmpeg...')

      // Use ffmpeg to get duration from stderr output
      ffmpeg(inputPath)
        .output('-')
        .format('null')
        .on('stderr', (stderrLine) => {
          const durationMatch = stderrLine.match(
            /time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/
          )
          if (durationMatch) {
            const hours = parseInt(durationMatch[1])
            const minutes = parseInt(durationMatch[2])
            const seconds = parseFloat(durationMatch[3])
            const totalSeconds = hours * 3600 + minutes * 60 + seconds

            console.log(
              `📊 Detected duration: ${totalSeconds}s, target: ${targetDuration}s`
            )

            if (totalSeconds <= targetDuration) {
              console.log('✅ Duration acceptable, using original')
              fsSync.copyFileSync(inputPath, outputPath)
              resolve(outputPath)
              return
            }

            // Calculate trim from start to get exact target duration
            const trimStart = (totalSeconds - targetDuration)+1
            console.log(`🔢 Trim calculation: ${totalSeconds}s - ${targetDuration}s = ${trimStart}s from start`)
            performTrim(trimStart, targetDuration)
          }
        })
        .on('error', (err) => {
          console.log(
            '⚠️ Could not get duration, using estimated trim:',
            err.message
          )
          performTrim(3, targetDuration) // Fallback to 3-second trim
        })
        .run()

      // Perform the actual trimming
      const performTrim = (startSeconds, duration) => {
        const formatTime = (seconds) => {
          const h = Math.floor(seconds / 3600)
          const m = Math.floor((seconds % 3600) / 60)
          const s = Math.floor(seconds % 60)
          const ms = Math.round((seconds % 1) * 1000)
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
        }

        console.log(
          `✂️ Trimming: start=${formatTime(startSeconds)}, duration=${duration}s`
        )

        ffmpeg(inputPath)
          .setStartTime(formatTime(startSeconds))
          .setDuration(duration.toString())
          .output(outputPath)
          .format('mp4')              // Force MP4 container format
          .videoCodec('libx264')      // H.264 video codec
          .audioCodec('aac')          // AAC audio codec
          .outputOptions([
            '-preset', 'medium',       // Balance between speed and compression
            '-crf', '18',             // High quality (lower = better quality)
            '-pix_fmt', 'yuv420p',    // Compatibility with most players
            '-movflags', '+faststart', // Web optimization
            '-b:a', '192k',           // High quality audio bitrate
            '-avoid_negative_ts', 'make_zero' // Handle timing issues
          ])
          .on('end', () => {
            console.log('✅ FFmpeg trim completed with high quality MP4')
            resolve(outputPath)
          })
          .on('error', (err) => {
            console.error('❌ FFmpeg trim failed:', err.message)
            console.log('🔄 Trying simpler trim without format conversion...')
            
            // Fallback: Simple trim without codec conversion
            ffmpeg(inputPath)
              .setStartTime(formatTime(startSeconds))
              .setDuration(duration.toString())
              .output(outputPath.replace('.mp4', '.webm')) // Keep as WebM
              .on('end', () => {
                console.log('✅ Fallback trim completed (WebM format)')
                resolve(outputPath.replace('.mp4', '.webm'))
              })
              .on('error', (fallbackErr) => {
                console.error('❌ Fallback trim also failed:', fallbackErr.message)
                console.log('⚠️ Using original recording')
                fsSync.copyFileSync(inputPath, outputPath)
                resolve(outputPath)
              })
              .run()
          })
          .run()
      }
    })
  }

  async uploadVideoToS3(localFilePath, bucketName = null, folderPrefix = null) {
    try {
      const bucket = bucketName || this.config.S3_BUCKET
      const prefix = folderPrefix || this.config.S3_FOLDER_PREFIX

      console.log(`📤 Uploading ${path.basename(localFilePath)} to S3...`)

      const fileContent = await fs.readFile(localFilePath)
      const fileName = path.basename(localFilePath)
      const s3Key = `${prefix}${fileName}`

      const uploadParams = {
        Bucket: bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'video/mp4',
        ACL: 'public-read',
        CacheControl: 'max-age=86400',
      }

      const result = await this.s3.upload(uploadParams).promise()
      console.log(`✅ S3 upload successful: ${result.Location}`)

      // Clean up local file after successful upload
      try {
        await fs.unlink(localFilePath)
        console.log(`🗑️ Local file cleaned up: ${localFilePath}`)
      } catch (cleanupError) {
        console.warn(
          `⚠️ Could not clean up local file: ${cleanupError.message}`
        )
      }

      return result.Location
    } catch (error) {
      console.error('❌ S3 upload failed:', error)
      throw new Error(`S3 upload failed: ${error.message}`)
    }
  }

  async processVideo(data, trackId) {
    try {
      console.log(`🔄 Processing video for track: ${trackId}`)

      const url = data.data || data
      const duration = this.config.DEFAULT_DURATION

      // Generate filename from URL (remove https:// and sanitize)
      const urlBasedName = url
        .replace(/^https?:\/\//, '')
        .replace(/[^a-zA-Z0-9.-]/g, '-')

      // Step 1: Record website
      const { video, outputDir } = await this.recordWebsiteDirect(url, duration)

      // Step 2: Wait for video file to be ready
      const videoPath = await this.waitForVideoFile(
        video,
        this.config.MAX_WAIT_TIME
      )

      // Step 3: Trim video to target duration with URL-based name
      const trimmedPath = await this.trimVideoSimple(
        videoPath,
        duration,
        outputDir,
        urlBasedName
      )

      // Step 4: Upload to S3
      const s3Url = await this.uploadVideoToS3(trimmedPath)

      console.log(`✅ Video processing completed for ${trackId}: ${s3Url}`)

      return {
        converted_url: s3Url,
        success: true,
        trackId,
      }
    } catch (error) {
      console.error(`❌ Video processing failed for ${trackId}:`, error.message)
      throw error
    }
  }

  async convert(inputJSON) {
    console.log('🎬 Starting video conversion...')

    // Validate input format
    if (!inputJSON) {
      throw new Error('Invalid input: JSON is required')
    }

    // Initialize if needed
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = Date.now()

    try {
      console.log('📝 Processing videos in parallel...')

      // Find all image items from trackItemDetailsMap that need conversion
      const trackItemDetailsEntries = Object.entries(
        inputJSON.timelineData.trackItemDetailsMap
      )
      const imageItemsToProcess = trackItemDetailsEntries.filter(
        ([trackId, trackDetails]) =>
          trackDetails.type === 'image' &&
          trackDetails.details &&
          trackDetails.details.src &&
          typeof trackDetails.details.src === 'string' &&
          trackDetails.details.src.includes('magicpatterns.app') &&
          !trackDetails.details.src.toLowerCase().endsWith('.mp4') &&
          !trackDetails.details.src.toLowerCase().endsWith('.webm')
      )

      console.log(
        `🖼️ Found ${imageItemsToProcess.length} image items to convert...`
      )

      // Process all image items in parallel
      const processedImageItems = await Promise.all(
        imageItemsToProcess.map(async ([trackId, trackDetails]) => {
          console.log(`🔄 Processing image item: ${trackId}`)

          const originalSrc = trackDetails.details.src

          try {
            const result = await this.processVideo(
              { data: originalSrc },
              trackId
            )
            return {
              trackId,
              originalSrc,
              newSrc: result.converted_url,
              success: true,
            }
          } catch (error) {
            console.error(`❌ Failed to process ${trackId}:`, error.message)
            return {
              trackId,
              originalSrc,
              newSrc: originalSrc, // Keep original on error
              success: false,
            }
          }
        })
      )

      // Create a map of trackId -> newSrc for successful conversions only
      const urlUpdates = {}
      processedImageItems.forEach((item) => {
        if (item.success && item.newSrc !== item.originalSrc) {
          urlUpdates[item.trackId] = item.newSrc
        }
      })

      console.log(
        `🔄 Updating URLs for ${Object.keys(urlUpdates).length} successful conversions...`
      )

      // Update trackItemDetailsMap - start with original and only update successful ones
      const updatedTrackItemDetailsMap = {
        ...inputJSON.timelineData.trackItemDetailsMap,
      }
      Object.keys(urlUpdates).forEach((trackId) => {
        if (
          updatedTrackItemDetailsMap[trackId] &&
          updatedTrackItemDetailsMap[trackId].details
        ) {
          updatedTrackItemDetailsMap[trackId] = {
            ...updatedTrackItemDetailsMap[trackId],
            details: {
              ...updatedTrackItemDetailsMap[trackId].details,
              src: urlUpdates[trackId],
            },
          }
          console.log(
            `✅ Updated trackItemDetailsMap[${trackId}]: ${urlUpdates[trackId]}`
          )
        }
      })

      // Update trackItemsMap - start with original and only update successful ones
      const updatedTrackItemsMap = { ...inputJSON.timelineData.trackItemsMap }
      Object.keys(urlUpdates).forEach((trackId) => {
        if (
          updatedTrackItemsMap[trackId] &&
          updatedTrackItemsMap[trackId].details &&
          updatedTrackItemsMap[trackId].details.src
        ) {
          updatedTrackItemsMap[trackId] = {
            ...updatedTrackItemsMap[trackId],
            details: {
              ...updatedTrackItemsMap[trackId].details,
              src: urlUpdates[trackId],
            },
          }
          console.log(
            `✅ Updated trackItemsMap[${trackId}]: ${urlUpdates[trackId]}`
          )
        }
      })

      // Build output JSON in exact same format as input
      const output = {
        ...inputJSON,
        timelineData: {
          ...inputJSON.timelineData,
          trackItemsMap: updatedTrackItemsMap,
          trackItemDetailsMap: updatedTrackItemDetailsMap,
        },
      }

      const processingTime = Date.now() - startTime
      console.log(`🎉 Conversion completed in ${processingTime}ms!`)

      return output
    } catch (error) {
      console.error('💥 Conversion failed:', error)
      throw error
    }
  }
}

module.exports = IframeToVideoSDK