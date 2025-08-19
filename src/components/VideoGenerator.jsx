import { useState, useEffect } from 'react'
import './VideoGenerator.css'

function VideoGenerator() {
  // Ad content fields
  const [headlineText, setHeadlineText] = useState('')
  const [secondaryText, setSecondaryText] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [videoDescription, setVideoDescription] = useState('')
  const [videoStyle, setVideoStyle] = useState('modern-marketing')
  
  // Video-specific settings
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [numberOfVideos, setNumberOfVideos] = useState(1)
  const [selectedVideoService, setSelectedVideoService] = useState('veo-3-quality')
  
  // State management
  const [generatedVideos, setGeneratedVideos] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [videosLoading, setVideosLoading] = useState({})
  const [videoHistory, setVideoHistory] = useState([])

  // Load saved videos from localStorage on mount
  useEffect(() => {
    const savedVideos = localStorage.getItem('generatedVideos')
    if (savedVideos) {
      try {
        setVideoHistory(JSON.parse(savedVideos))
      } catch (e) {
        console.error('Failed to load saved videos:', e)
      }
    }
  }, [])

  // Save videos to localStorage whenever they change
  const saveToHistory = (videos) => {
    const newHistory = [...videos, ...videoHistory].slice(0, 20) // Keep last 20 videos
    setVideoHistory(newHistory)
    localStorage.setItem('generatedVideos', JSON.stringify(newHistory))
  }

  // Download video function
  const downloadVideo = async (url, filename) => {
    try {
      if (url.startsWith('blob:') || url.startsWith('data:')) {
        const link = document.createElement('a')
        link.href = url
        link.download = filename || 'generated-video.mp4'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        const response = await fetch(url)
        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = filename || 'generated-video.mp4'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100)
      }
    } catch (error) {
      console.error('Download failed:', error)
      window.open(url, '_blank')
    }
  }

  // Get API key for video generation
  const getApiKey = () => {
    return import.meta.env.VITE_KIE_AI_API_KEY
  }

  // Build the video ad prompt from all components
  const buildVideoPrompt = () => {
    const components = []
    
    // Core video description
    if (videoDescription.trim()) {
      components.push(`Video content: ${videoDescription}`)
    }
    
    // Text overlay requirements for video ads
    const textElements = []
    if (headlineText.trim()) textElements.push(`Headline text overlay: "${headlineText}"`)
    if (secondaryText.trim()) textElements.push(`Secondary text: "${secondaryText}"`)
    if (ctaText.trim()) textElements.push(`Call-to-action text: "${ctaText}"`)
    
    if (textElements.length > 0) {
      components.push(`Text overlays needed: ${textElements.join(', ')}`)
    }
    
    // Style and format for video
    components.push(`Style: ${videoStyle} video advertisement`)
    components.push('Format: Professional marketing video advertisement with engaging visuals')
    components.push('Requirements: High-quality, attention-grabbing video suitable for digital marketing campaigns')
    
    return components.join('. ')
  }

  const handleGenerate = async () => {
    if (!videoDescription.trim() && !headlineText.trim()) {
      setError('Please provide either a video description or headline text')
      return
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      setError('kie.ai API key not configured')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Build comprehensive video prompt
      const videoPrompt = buildVideoPrompt()

      // Determine the correct model based on selection
      let modelName
      switch (selectedVideoService) {
        case 'veo-2':
          modelName = 'veo2' // kie.ai doesn't support Veo2, fallback to veo3
          break
        case 'veo-3-fast':
          modelName = 'veo3_fast'
          break
        case 'veo-3-quality':
          modelName = 'veo3'
          break
        default:
          modelName = 'veo3'
      }

      // Use kie.ai Veo API to generate videos
      const response = await fetch(
        'https://api.kie.ai/api/v1/veo/generate',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: videoPrompt,
            model: modelName,
            aspectRatio: aspectRatio,
            watermark: 'BLP',
            enableFallback: true,
            seeds: Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        
        // If kie.ai Veo fails, provide helpful error message
        throw new Error(
          errorData.message || errorData.error || 
          'Failed to generate videos. Please check your kie.ai API key and try again.'
        )
      }

      const data = await response.json()
      
      // kie.ai returns a task ID, we need to poll for results
      if (data.taskId) {
        const taskId = data.taskId
        
        // Show processing message
        setError(`Video is being generated! Task ID: ${taskId}. Checking status...`)
        
        // Poll for video completion
        const pollForVideo = async () => {
          let attempts = 0
          const maxAttempts = 60 // Poll for up to 5 minutes (60 * 5 seconds)
          
          const checkStatus = async () => {
            try {
              const statusResponse = await fetch(
                `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`,
                {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                  }
                }
              )
              
              if (statusResponse.ok) {
                const statusData = await statusResponse.json()
                
                // Check if video is ready
                if (statusData.status === 'completed' || statusData.videoUrl || statusData.result?.videoUrl) {
                  // Video is ready!
                  const videoUrl = statusData.videoUrl || statusData.result?.videoUrl || statusData.url
                  
                  const videos = [{
                    id: Date.now(),
                    url: videoUrl,
                    prompt: `${headlineText || 'Video Ad'} - ${videoDescription || 'Generated video advertisement'}`,
                    headlineText,
                    secondaryText,
                    ctaText,
                    videoDescription,
                    description: `AI-generated video advertisement using ${modelName}: ${videoPrompt}`,
                    note: `Generated with kie.ai ${selectedVideoService.replace('-', ' ').toUpperCase()}`,
                    aspectRatio,
                    taskId: taskId
                  }]
                  
                  setGeneratedVideos(videos)
                  saveToHistory(videos)
                  setError(null)
                  setIsLoading(false)
                  return true
                }
                
                // If still processing, continue polling
                if (statusData.status === 'processing' || statusData.status === 'pending') {
                  attempts++
                  if (attempts < maxAttempts) {
                    setError(`Video is being generated... (${Math.round((attempts/maxAttempts)*100)}% time elapsed)`)
                    setTimeout(checkStatus, 5000) // Check again in 5 seconds
                  } else {
                    setError(`Video generation is taking longer than expected. Task ID: ${taskId}. The video will be sent to your email when ready.`)
                    setIsLoading(false)
                  }
                  return false
                }
                
                // If failed
                if (statusData.status === 'failed' || statusData.status === 'error') {
                  setError(`Video generation failed: ${statusData.error || 'Unknown error'}`)
                  setIsLoading(false)
                  return false
                }
              }
            } catch (err) {
              console.error('Error checking status:', err)
              attempts++
              if (attempts < maxAttempts) {
                setTimeout(checkStatus, 5000)
              } else {
                setError(`Could not check video status. Task ID: ${taskId}. The video will be sent to your email when ready.`)
                setIsLoading(false)
              }
            }
          }
          
          // Start polling
          setTimeout(checkStatus, 3000) // First check after 3 seconds
        }
        
        await pollForVideo()
        return
      }
      
      // If direct URL is returned
      const videos = [{
        id: Date.now(),
        url: data.videoUrl || data.url || data.result?.videoUrl,
        prompt: `${headlineText || 'Video Ad'} - ${videoDescription || 'Generated video advertisement'}`,
        headlineText,
        secondaryText,
        ctaText,
        videoDescription,
        description: `AI-generated video advertisement using ${modelName}: ${videoPrompt}`,
        note: `Generated with kie.ai ${selectedVideoService.replace('-', ' ').toUpperCase()}`,
        aspectRatio
      }]

      if (videos.length === 0) {
        throw new Error('No videos were generated. Please try again.')
      }

      // Initialize loading states for all videos
      const loadingStates = {}
      videos.forEach(video => {
        loadingStates[video.id] = true
      })
      setVideosLoading(loadingStates)
      
      setGeneratedVideos(videos)
      saveToHistory(videos)

    } catch (err) {
      setError(err.message || 'An error occurred while generating videos')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="video-generator">
      <div className="form-container">
        <div className="form-group">
          <label htmlFor="video-service">Video AI Service</label>
          <select
            id="video-service"
            value={selectedVideoService}
            onChange={(e) => setSelectedVideoService(e.target.value)}
          >
            <option value="veo-3-quality">Veo 3 (Quality)</option>
            <option value="veo-3-fast">Veo 3 (Fast)</option>
            <option value="veo-2">Veo 2</option>
          </select>
        </div>

        <div className="ad-content-section">
          <h3>Video Ad Content</h3>
          
          <div className="form-group">
            <label htmlFor="video-headline">Headline Text</label>
            <input
              id="video-headline"
              type="text"
              placeholder="e.g., Don't Get Caught Unaware!"
              value={headlineText}
              onChange={(e) => setHeadlineText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="video-secondary">Secondary Text</label>
            <input
              id="video-secondary"
              type="text"
              placeholder="e.g., You'll be glad you did"
              value={secondaryText}
              onChange={(e) => setSecondaryText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="video-cta">Call-to-Action (CTA)</label>
            <input
              id="video-cta"
              type="text"
              placeholder="e.g., Click to Learn More"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="video-desc">Video Description</label>
            <textarea
              id="video-desc"
              placeholder="Describe what should happen in the video (e.g., Professional office worker confidently presenting to colleagues)"
              value={videoDescription}
              onChange={(e) => setVideoDescription(e.target.value)}
              rows="3"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="video-style">Video Style</label>
            <select
              id="video-style"
              value={videoStyle}
              onChange={(e) => setVideoStyle(e.target.value)}
            >
              <option value="modern-marketing">Modern Marketing</option>
              <option value="corporate-professional">Corporate Professional</option>
              <option value="dynamic-energetic">Dynamic & Energetic</option>
              <option value="minimalist-clean">Minimalist & Clean</option>
              <option value="cinematic-dramatic">Cinematic & Dramatic</option>
              <option value="lifestyle-casual">Lifestyle & Casual</option>
              <option value="tech-futuristic">Tech & Futuristic</option>
              <option value="luxury-premium">Luxury & Premium</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="video-aspect">Aspect Ratio</label>
            <select
              id="video-aspect"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
            >
              <option value="16:9">16:9 (Landscape)</option>
              <option value="9:16">9:16 (Portrait/Stories)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="video-number">Number of Videos</label>
            <input
              id="video-number"
              type="number"
              min="1"
              max="2"
              value={numberOfVideos}
              onChange={(e) => setNumberOfVideos(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="video-preview">
          <h3>Video Ad Preview</h3>
          <div className="preview-content">
            {headlineText && <div className="preview-headline">{headlineText}</div>}
            {secondaryText && <div className="preview-secondary">{secondaryText}</div>}
            {videoDescription && <div className="preview-video-desc">Video: {videoDescription}</div>}
            {ctaText && <div className="preview-cta">{ctaText}</div>}
            {!headlineText && !secondaryText && !videoDescription && !ctaText && (
              <div className="preview-placeholder">Fill out the form above to see your video ad preview</div>
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button
          className="generate-button"
          onClick={handleGenerate}
          disabled={isLoading}
        >
          {isLoading ? 'Creating Video Ad...' : 'Generate Video Ad'}
        </button>
      </div>

      {generatedVideos.length > 0 && (
        <div className="results-container">
          <h2>Generated Video Ads</h2>
          <div className="video-grid">
            {generatedVideos.map((video) => (
              <div key={video.id} className="video-item">
                <div style={{position: 'relative', width: '100%', backgroundColor: '#333', minHeight: '200px'}}>
                  {videosLoading[video.id] && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: 'white'
                    }}>
                      Loading video...
                    </div>
                  )}
                  <video 
                    src={video.url} 
                    controls
                    style={{width: '100%', height: 'auto', display: 'block'}}
                    onLoadedData={() => {
                      setVideosLoading(prev => ({...prev, [video.id]: false}))
                    }}
                    onError={() => {
                      setVideosLoading(prev => ({...prev, [video.id]: false}))
                    }}
                  />
                </div>
                <div className="video-info">
                  <p className="video-prompt">{video.prompt}</p>
                  <p className="video-description">{video.description}</p>
                  {video.note && (
                    <p className="video-note" style={{fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem'}}>
                      {video.note}
                    </p>
                  )}
                  <button
                    className="download-button"
                    onClick={() => {
                      const filename = `video-ad-${(video.headlineText || 'generated').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${Date.now()}.mp4`
                      downloadVideo(video.url, filename)
                    }}
                  >
                    Download Video
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {videoHistory.length > 0 && (
        <div className="history-container">
          <div className="history-header">
            <h2>Video History</h2>
            <button
              className="clear-history-button"
              onClick={() => {
                if (confirm('Clear all saved videos?')) {
                  setVideoHistory([])
                  localStorage.removeItem('generatedVideos')
                }
              }}
            >
              Clear History
            </button>
          </div>
          <div className="video-grid">
            {videoHistory.map((video) => (
              <div key={video.id} className="video-item">
                <video 
                  src={video.url} 
                  controls
                  style={{width: '100%', height: 'auto', display: 'block'}}
                />
                <div className="video-info">
                  <p className="video-prompt">{video.prompt}</p>
                  <button
                    className="download-button"
                    onClick={() => {
                      const filename = `video-ad-${(video.headlineText || 'generated').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${Date.now()}.mp4`
                      downloadVideo(video.url, filename)
                    }}
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoGenerator