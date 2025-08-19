import { useState, useEffect } from 'react'
import './ImageGenerator.css'

function ImageGenerator() {
  // Ad content fields
  const [headlineText, setHeadlineText] = useState('')
  const [secondaryText, setSecondaryText] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [imageDescription, setImageDescription] = useState('')
  const [imageStyle, setImageStyle] = useState('modern-marketing')
  
  // Technical settings
  const [imageSize, setImageSize] = useState('1024x1024')
  const [numberOfImages, setNumberOfImages] = useState(1)
  const [selectedService, setSelectedService] = useState('google-gemini')
  
  // Flux Kontext specific state
  const [referenceImage, setReferenceImage] = useState(null)
  const [referenceImagePreview, setReferenceImagePreview] = useState(null)
  const [contextualPrompt, setContextualPrompt] = useState('')
  
  // State management
  const [generatedImages, setGeneratedImages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [imagesLoading, setImagesLoading] = useState({})
  const [imageHistory, setImageHistory] = useState([])

  // Load saved images from localStorage on mount
  useEffect(() => {
    const savedImages = localStorage.getItem('generatedImages')
    if (savedImages) {
      try {
        setImageHistory(JSON.parse(savedImages))
      } catch (e) {
        console.error('Failed to load saved images:', e)
      }
    }
  }, [])

  // Save images to localStorage whenever they change
  const saveToHistory = (images) => {
    const newHistory = [...images, ...imageHistory].slice(0, 50) // Keep last 50 images
    setImageHistory(newHistory)
    localStorage.setItem('generatedImages', JSON.stringify(newHistory))
  }

  // Generate similar image with same settings
  const generateSimilar = async (image) => {
    console.log('Regenerating with image data:', image) // Debug log
    setIsLoading(true)
    setError(null)

    try {
      // Get API key for the specific service used in the original image
      const service = image.selectedService || 'google-gemini'
      let apiKey
      switch (service) {
        case 'google-gemini':
          apiKey = import.meta.env.VITE_GEMINI_API_KEY
          break
        case 'openai-gpt-image':
          apiKey = import.meta.env.VITE_OPENAI_API_KEY
          break
        case 'flux-kontext':
          apiKey = import.meta.env.VITE_KIE_AI_API_KEY
          break
        default:
          apiKey = import.meta.env.VITE_GEMINI_API_KEY
      }
      
      if (!apiKey) {
        setError(`API key not configured for ${service}`)
        return
      }

      // Build the same prompt from the original image
      const components = []
      if (image.imageDescription) {
        components.push(`Image content: ${image.imageDescription}`)
      }
      
      const textElements = []
      if (image.headlineText) textElements.push(`Headline: "${image.headlineText}"`)
      if (image.secondaryText) textElements.push(`Secondary text: "${image.secondaryText}"`)
      if (image.ctaText) textElements.push(`Call-to-action: "${image.ctaText}"`)
      
      if (textElements.length > 0) {
        components.push(`Text overlays needed: ${textElements.join(', ')}`)
      }
      
      components.push(`Style: ${image.imageStyle || 'modern-marketing'} advertisement design`)
      components.push('Format: Professional marketing advertisement with clean layout and readable text placement')
      components.push('Requirements: High-quality, eye-catching design suitable for digital marketing')
      
      const adPrompt = components.join('. ')

      let response

      if (service === 'openai-gpt-image') {
        // Use OpenAI GPT Image API
        response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: adPrompt,
            n: 1, // Always generate just 1 image for similar
            size: image.imageSize || '1024x1024',
            quality: 'auto',
            output_format: 'jpeg'
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'Failed to generate similar image')
        }

        const gptImageData = await response.json()
        const newImages = gptImageData.data.map((imageData) => ({
          id: Date.now(),
          url: imageData.url,
          prompt: image.prompt,
          headlineText: image.headlineText,
          secondaryText: image.secondaryText,
          ctaText: image.ctaText,
          imageDescription: image.imageDescription,
          imageStyle: image.imageStyle,
          imageSize: image.imageSize,
          selectedService: image.selectedService,
          description: `AI-generated similar advertisement using GPT Image: ${adPrompt}`,
          note: 'Generated with OpenAI GPT Image (Similar)'
        }))

        setGeneratedImages(prev => [...newImages, ...prev])
        saveToHistory(newImages)
      } else {
        // Use Google Gemini/Imagen 4 API
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`,
          {
            method: 'POST',
            headers: {
              'x-goog-api-key': import.meta.env.VITE_GEMINI_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              instances: [{
                prompt: adPrompt
              }],
              parameters: {
                sampleCount: 1,
                aspectRatio: image.imageSize?.includes('1792x1024') ? '16:9' : 
                            image.imageSize?.includes('1024x1792') ? '9:16' : '1:1'
              }
            })
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          // Fall back to placeholder if Imagen fails
          const newImages = [{
            id: Date.now(),
            url: `https://picsum.photos/seed/${Date.now()}/${image.imageSize?.split('x')[0] || 1024}/${image.imageSize?.split('x')[1] || 1024}`,
            prompt: image.prompt,
            headlineText: image.headlineText,
            secondaryText: image.secondaryText,
            ctaText: image.ctaText,
            imageDescription: image.imageDescription,
            imageStyle: image.imageStyle,
            imageSize: image.imageSize,
            selectedService: image.selectedService,
            description: `AI-generated similar advertisement`,
            note: 'Generated similar (placeholder due to API limits)'
          }]
          
          setGeneratedImages(prev => [...newImages, ...prev])
          saveToHistory(newImages)
          return
        }

        const data = await response.json()
        const newImages = data.predictions.map((prediction) => ({
          id: Date.now(),
          url: `data:image/png;base64,${prediction.bytesBase64Encoded}`,
          prompt: image.prompt,
          headlineText: image.headlineText,
          secondaryText: image.secondaryText,
          ctaText: image.ctaText,
          imageDescription: image.imageDescription,
          imageStyle: image.imageStyle,
          imageSize: image.imageSize,
          selectedService: image.selectedService,
          description: `AI-generated similar advertisement: ${adPrompt}`,
          note: 'Generated with Google Imagen 4 (Similar)'
        }))

        setGeneratedImages(prev => [...newImages, ...prev])
        saveToHistory(newImages)
      }
    } catch (err) {
      setError(err.message || 'An error occurred while generating similar image')
    } finally {
      setIsLoading(false)
    }
  }

  // Download image function
  const downloadImage = async (url, filename) => {
    try {
      // Handle different URL types
      if (url.startsWith('data:image/')) {
        // For base64 images (from Imagen API)
        const link = document.createElement('a')
        link.href = url
        link.download = filename || 'generated-ad.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // For external URLs (placeholders), fetch and convert to blob
        const response = await fetch(url)
        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = filename || 'generated-ad.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up the blob URL
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100)
      }
    } catch (error) {
      console.error('Download failed:', error)
      // Fallback: open in new tab
      window.open(url, '_blank')
    }
  }

  // Get API key based on selected service
  const getApiKey = () => {
    switch (selectedService) {
      case 'google-gemini':
        return import.meta.env.VITE_GEMINI_API_KEY
      case 'openai-gpt-image':
        return import.meta.env.VITE_OPENAI_API_KEY
      case 'flux-kontext':
        return import.meta.env.VITE_KIE_AI_API_KEY
      default:
        return null
    }
  }

  // Build the ad prompt from all components
  const buildAdPrompt = () => {
    const components = []
    
    // Core image description
    if (imageDescription.trim()) {
      components.push(`Image content: ${imageDescription}`)
    }
    
    // Text overlay requirements
    const textElements = []
    if (headlineText.trim()) textElements.push(`Headline: "${headlineText}"`)
    if (secondaryText.trim()) textElements.push(`Secondary text: "${secondaryText}"`)
    if (ctaText.trim()) textElements.push(`Call-to-action: "${ctaText}"`)
    
    if (textElements.length > 0) {
      components.push(`Text overlays needed: ${textElements.join(', ')}`)
    }
    
    // Style and format
    components.push(`Style: ${imageStyle} advertisement design`)
    components.push('Format: Professional marketing advertisement with clean layout and readable text placement')
    components.push('Requirements: High-quality, eye-catching design suitable for digital marketing')
    
    return components.join('. ')
  }

  // Handle reference image upload
  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image file must be less than 10MB')
        return
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file')
        return
      }
      
      setReferenceImage(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setReferenceImagePreview(e.target.result)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }
  
  // Remove reference image
  const removeReferenceImage = () => {
    setReferenceImage(null)
    setReferenceImagePreview(null)
    // Reset file input
    const fileInput = document.getElementById('reference-image')
    if (fileInput) fileInput.value = ''
  }

  const handleGenerate = async () => {
    if (selectedService === 'flux-kontext') {
      if (!referenceImage || !contextualPrompt.trim()) {
        setError('For Flux Kontext, please upload a reference image and describe how to incorporate it')
        return
      }
    } else if (!imageDescription.trim() && !headlineText.trim()) {
      setError('Please provide either an image description or headline text')
      return
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      setError('API key not configured for selected service')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Build comprehensive ad prompt
      const adPrompt = buildAdPrompt()

      let response

      if (selectedService === 'flux-kontext') {
        // Use kie.ai Flux Kontext API for image editing
        const formData = new FormData()
        formData.append('image', referenceImage)
        formData.append('prompt', contextualPrompt + '. ' + adPrompt)
        formData.append('model', 'flux1-kontext')
        formData.append('aspectRatio', imageSize.includes('1792x1024') ? '16:9' : 
                       imageSize.includes('1024x1792') ? '9:16' : '1:1')
        formData.append('strength', '0.6') // Lower strength for more contextual generation vs editing
        formData.append('enableFallback', 'true')
        
        response = await fetch('https://api.kie.ai/api/v1/flux/kontext/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || errorData.error || 'Failed to generate images with Flux Kontext')
        }

        const fluxData = await response.json()
        
        // Check if kie.ai returns a task ID (async processing)
        if (fluxData.taskId) {
          const taskId = fluxData.taskId
          setError(`Image is being generated! Task ID: ${taskId}. Checking status...`)
          
          // Poll for image completion
          const pollForImage = async () => {
            let attempts = 0
            const maxAttempts = 30 // Poll for up to 2.5 minutes
            
            const checkStatus = async () => {
              try {
                const statusResponse = await fetch(
                  `https://api.kie.ai/api/v1/flux/kontext/record-info?taskId=${taskId}`,
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
                  
                  if (statusData.status === 'completed' || statusData.imageUrl || statusData.result?.imageUrl) {
                    const imageUrl = statusData.imageUrl || statusData.result?.imageUrl || statusData.url
                    
                    const images = [{
                      id: Date.now(),
                      url: imageUrl,
                      prompt: `${headlineText || 'Contextual Ad'} - ${contextualPrompt}`,
                      headlineText,
                      secondaryText,
                      ctaText,
                      imageDescription: contextualPrompt,
                      imageStyle,
                      imageSize,
                      selectedService,
                      description: `AI-generated advertisement using Flux Kontext: ${contextualPrompt}`,
                      note: 'Generated with kie.ai Flux Kontext (Contextual)',
                      taskId: taskId
                    }]
                    
                    const loadingStates = {}
                    images.forEach(img => {
                      loadingStates[img.id] = true
                    })
                    setImagesLoading(loadingStates)
                    
                    setGeneratedImages(images)
                    saveToHistory(images)
                    setError(null)
                    setIsLoading(false)
                    return true
                  }
                  
                  if (statusData.status === 'processing' || statusData.status === 'pending') {
                    attempts++
                    if (attempts < maxAttempts) {
                      setError(`Image is being generated... (${Math.round((attempts/maxAttempts)*100)}% time elapsed)`)
                      setTimeout(checkStatus, 5000)
                    } else {
                      setError(`Image generation is taking longer than expected. Task ID: ${taskId}`)
                      setIsLoading(false)
                    }
                    return false
                  }
                  
                  if (statusData.status === 'failed' || statusData.status === 'error') {
                    setError(`Image generation failed: ${statusData.error || 'Unknown error'}`)
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
                  setError(`Could not check image status. Task ID: ${taskId}`)
                  setIsLoading(false)
                }
              }
            }
            
            setTimeout(checkStatus, 3000)
          }
          
          await pollForImage()
          return
        }
        
        // If direct URL is returned
        const images = [{
          id: Date.now(),
          url: fluxData.imageUrl || fluxData.url || fluxData.result?.imageUrl,
          prompt: `${headlineText || 'Contextual Ad'} - ${contextualPrompt}`,
          headlineText,
          secondaryText,
          ctaText,
          imageDescription: contextualPrompt,
          imageStyle,
          imageSize,
          selectedService,
          description: `AI-generated advertisement using Flux Kontext: ${contextualPrompt}`,
          note: 'Generated with kie.ai Flux Kontext (Contextual)'
        }]

        const loadingStates = {}
        images.forEach(img => {
          loadingStates[img.id] = true
        })
        setImagesLoading(loadingStates)
        
        setGeneratedImages(images)
        saveToHistory(images)
        return
        
      } else if (selectedService === 'openai-gpt-image') {
        // Use OpenAI GPT Image API
        response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: adPrompt,
            n: Math.min(numberOfImages, 1), // GPT Image supports 1 image at a time
            size: imageSize.includes('1792x1024') ? '1792x1024' : 
                  imageSize.includes('1024x1792') ? '1024x1792' : 
                  '1024x1024',
            quality: 'auto',
            output_format: 'jpeg'
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'Failed to generate images with GPT Image')
        }

        const gptImageData = await response.json()
        
        // Process GPT Image response
        const images = gptImageData.data.map((imageData, i) => ({
          id: Date.now() + i,
          url: imageData.url,
          prompt: `${headlineText || 'Ad'} - ${imageDescription || 'Generated advertisement'}`,
          headlineText,
          secondaryText,
          ctaText,
          imageDescription,
          imageStyle,
          imageSize,
          selectedService,
          description: `AI-generated advertisement using GPT Image: ${adPrompt}`,
          note: 'Generated with OpenAI GPT Image'
        }))

        // Initialize loading states for all images
        const loadingStates = {}
        images.forEach(img => {
          loadingStates[img.id] = true
        })
        setImagesLoading(loadingStates)
        
        setGeneratedImages(images)
        saveToHistory(images)
        return

      } else {
        // Use Imagen 4 API to generate images
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`,
          {
            method: 'POST',
            headers: {
              'x-goog-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              instances: [
                {
                  prompt: adPrompt
                }
              ],
              parameters: {
                sampleCount: numberOfImages,
                aspectRatio: imageSize.includes('1792x1024') ? '16:9' : 
                            imageSize.includes('1024x1792') ? '9:16' : 
                            '1:1'
              }
            })
          }
        )
      }

      if (!response.ok) {
        const errorData = await response.json()
        
        // If Imagen 4 fails, fall back to generating with Gemini text + placeholder images
        if (errorData.error?.message?.includes('not enabled') || errorData.error?.message?.includes('permission')) {
          // Generate description with Gemini
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `Create a vivid, detailed description of an image: "${adPrompt}". Describe it as if the image exists.`
                  }]
                }]
              })
            }
          )

          const geminiData = await geminiResponse.json()
          const description = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Description generated'

          // Use placeholder images
          const images = Array.from({ length: numberOfImages }, (_, i) => ({
            id: Date.now() + i,
            url: `https://picsum.photos/seed/${encodeURIComponent(adPrompt + i)}/${imageSize.split('x')[0]}/${imageSize.split('x')[1]}`,
            description: description,
            prompt: `${headlineText || 'Ad'} - ${imageDescription || 'Generated advertisement'}`,
            headlineText,
            secondaryText,
            ctaText,
            imageDescription,
            imageStyle,
            imageSize,
            selectedService,
            note: 'Note: Imagen 4 API access may require additional permissions. Using placeholder images with AI-generated descriptions.'
          }))

          const loadingStates = {}
          images.forEach(img => {
            loadingStates[img.id] = true
          })
          setImagesLoading(loadingStates)
          
          setGeneratedImages(images)
      saveToHistory(images)
          saveToHistory(images)
          return
        }
        
        throw new Error(errorData.error?.message || 'Failed to generate images')
      }

      const data = await response.json()
      
      // Process the generated images from Imagen 4
      const images = data.predictions.map((prediction, i) => ({
        id: Date.now() + i,
        url: `data:image/png;base64,${prediction.bytesBase64Encoded}`,
        prompt: `${headlineText || 'Ad'} - ${imageDescription || 'Generated advertisement'}`,
        headlineText,
        secondaryText,
        ctaText,
        imageDescription,
        imageStyle,
        imageSize,
        selectedService,
        description: `AI-generated advertisement: ${adPrompt}`,
        note: 'Generated with Google Imagen 4'
      }))

      // Initialize loading states for all images
      const loadingStates = {}
      images.forEach(img => {
        loadingStates[img.id] = true
      })
      setImagesLoading(loadingStates)
      
      setGeneratedImages(images)
      saveToHistory(images)
    } catch (err) {
      setError(err.message || 'An error occurred while generating images')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="image-generator">
      <div className="form-container">
        <div className="form-group">
          <label htmlFor="service">AI Service</label>
          <select
            id="service"
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
          >
            <option value="google-gemini">Google Gemini (Imagen 4)</option>
            <option value="openai-gpt-image">OpenAI GPT Image</option>
            <option value="flux-kontext">Flux Kontext (Contextual Generation)</option>
            <option value="stable-diffusion" disabled>Stable Diffusion (Coming Soon)</option>
            <option value="midjourney" disabled>Midjourney (Coming Soon)</option>
          </select>
        </div>

        {selectedService === 'flux-kontext' && (
          <div className="flux-kontext-section">
            <h3>Flux Kontext - Contextual Generation</h3>
            
            <div className="form-group">
              <label htmlFor="reference-image">Reference Image</label>
              <input
                id="reference-image"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{marginBottom: '0.5rem'}}
              />
              <small style={{color: '#666', fontSize: '0.85rem'}}>Upload a reference image (product, style, or context to incorporate) - max 10MB, PNG/JPG</small>
              
              {referenceImagePreview && (
                <div style={{marginTop: '1rem', position: 'relative'}}>
                  <img 
                    src={referenceImagePreview} 
                    alt="Reference" 
                    style={{maxWidth: '200px', maxHeight: '200px', border: '2px solid #ddd', borderRadius: '8px'}}
                  />
                  <button
                    type="button"
                    onClick={removeReferenceImage}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '25px',
                      height: '25px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="contextual-prompt">Generation Context</label>
              <textarea
                id="contextual-prompt"
                placeholder="Describe how to incorporate the reference image (e.g., place this product in a modern office setting, use this style for a luxury advertisement, create an ad featuring this item)"
                value={contextualPrompt}
                onChange={(e) => setContextualPrompt(e.target.value)}
                rows="3"
                style={{marginBottom: '0.5rem'}}
              />
              <small style={{color: '#666', fontSize: '0.85rem'}}>Describe how the reference image should be incorporated into the new advertisement</small>
            </div>
          </div>
        )}

        <div className="ad-content-section">
          <h3>{selectedService === 'flux-kontext' ? 'Additional Ad Content (Optional)' : 'Ad Content'}</h3>
          
          <div className="form-group">
            <label htmlFor="headline">Headline Text</label>
            <input
              id="headline"
              type="text"
              placeholder="e.g., Don't Get Caught Unaware!"
              value={headlineText}
              onChange={(e) => setHeadlineText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="secondary">Secondary Text</label>
            <input
              id="secondary"
              type="text"
              placeholder="e.g., You'll be glad you did"
              value={secondaryText}
              onChange={(e) => setSecondaryText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cta">Call-to-Action (CTA)</label>
            <input
              id="cta"
              type="text"
              placeholder="e.g., Click to Learn More"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
            />
          </div>

          {selectedService !== 'flux-kontext' && (
            <div className="form-group">
              <label htmlFor="image-desc">Image Description</label>
              <textarea
                id="image-desc"
                placeholder="Describe what the visual should show (e.g., Professional office worker looking confident)"
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value)}
                rows="3"
              />
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="style">Ad Style</label>
            <select
              id="style"
              value={imageStyle}
              onChange={(e) => setImageStyle(e.target.value)}
            >
              <option value="modern-marketing">Modern Marketing</option>
              <option value="corporate-professional">Corporate Professional</option>
              <option value="vibrant-colorful">Vibrant & Colorful</option>
              <option value="minimalist-clean">Minimalist & Clean</option>
              <option value="bold-dramatic">Bold & Dramatic</option>
              <option value="friendly-approachable">Friendly & Approachable</option>
              <option value="luxury-premium">Luxury & Premium</option>
              <option value="tech-futuristic">Tech & Futuristic</option>
              <option value="lifestyle-casual">Lifestyle & Casual</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="size">Image Size</label>
            <select
              id="size"
              value={imageSize}
              onChange={(e) => setImageSize(e.target.value)}
            >
              <option value="256x256">256x256</option>
              <option value="512x512">512x512</option>
              <option value="1024x1024">1024x1024</option>
              <option value="1024x1792">1024x1792 (Portrait)</option>
              <option value="1792x1024">1792x1024 (Landscape)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="number">Number of Images</label>
            <input
              id="number"
              type="number"
              min="1"
              max="4"
              value={numberOfImages}
              onChange={(e) => setNumberOfImages(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="ad-preview">
          <h3>{selectedService === 'flux-kontext' ? 'Generation Preview' : 'Ad Preview'}</h3>
          <div className="preview-content">
            {selectedService === 'flux-kontext' ? (
              <>
                {referenceImagePreview && <div className="preview-image-desc">Reference Image: Uploaded</div>}
                {contextualPrompt && <div className="preview-image-desc">Context: {contextualPrompt}</div>}
                {headlineText && <div className="preview-headline">Headline: {headlineText}</div>}
                {secondaryText && <div className="preview-secondary">Secondary: {secondaryText}</div>}
                {ctaText && <div className="preview-cta">CTA: {ctaText}</div>}
                {!referenceImagePreview && !contextualPrompt && (
                  <div className="preview-placeholder">Upload a reference image and describe how to incorporate it</div>
                )}
              </>
            ) : (
              <>
                {headlineText && <div className="preview-headline">{headlineText}</div>}
                {secondaryText && <div className="preview-secondary">{secondaryText}</div>}
                {imageDescription && <div className="preview-image-desc">Visual: {imageDescription}</div>}
                {ctaText && <div className="preview-cta">{ctaText}</div>}
                {!headlineText && !secondaryText && !imageDescription && !ctaText && (
                  <div className="preview-placeholder">Fill out the form above to see your ad preview</div>
                )}
              </>
            )}
          </div>
        </div>

        <button
          className="generate-button"
          onClick={handleGenerate}
          disabled={isLoading}
        >
          {isLoading ? (selectedService === 'flux-kontext' ? 'Generating Contextual Ad...' : 'Creating Ad...') : (selectedService === 'flux-kontext' ? 'Generate Contextual Ad' : 'Generate Ad')}
        </button>
      </div>

      {generatedImages.length > 0 && (
        <div className="results-container">
          <h2>Generated Ads</h2>
          <div className="image-grid">
            {generatedImages.map((image) => (
              <div key={image.id} className="image-item">
                <div style={{position: 'relative', width: '100%', backgroundColor: '#333', minHeight: '200px'}}>
                  {imagesLoading[image.id] && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: 'white'
                    }}>
                      Loading image...
                    </div>
                  )}
                  <img 
                    src={image.url} 
                    alt={image.prompt}
                    style={{width: '100%', height: 'auto', display: 'block'}}
                    onLoad={() => {
                      setImagesLoading(prev => ({...prev, [image.id]: false}))
                    }}
                    onError={(e) => {
                      setImagesLoading(prev => ({...prev, [image.id]: false}))
                      e.target.onerror = null;
                      e.target.src = `https://via.placeholder.com/400x400/667eea/ffffff?text=${encodeURIComponent(image.prompt.slice(0, 20))}`
                    }}
                  />
                </div>
                <div className="image-info">
                  <p className="image-prompt">{image.prompt}</p>
                  <p className="image-description">{image.description}</p>
                  {image.note && (
                    <p className="image-note" style={{fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem'}}>
                      {image.note}
                    </p>
                  )}
                  <div className="button-group">
                    <button
                      className="download-button"
                      onClick={() => {
                        const filename = `ad-${(image.headlineText || 'generated').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${Date.now()}.png`
                        downloadImage(image.url, filename)
                      }}
                    >
                      Download Full Resolution
                    </button>
                    <button
                      className="regenerate-button"
                      onClick={() => generateSimilar(image)}
                      title="Generate a similar ad with the same settings"
                    >
                      🔄 Generate Similar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {imageHistory.length > 0 && (
        <div className="history-container">
          <div className="history-header">
            <h2>Image History</h2>
            <button
              className="clear-history-button"
              onClick={() => {
                if (confirm('Clear all saved images?')) {
                  setImageHistory([])
                  localStorage.removeItem('generatedImages')
                }
              }}
            >
              Clear History
            </button>
          </div>
          <div className="image-grid">
            {imageHistory.map((image) => (
              <div key={image.id} className="image-item">
                <img 
                  src={image.url} 
                  alt={image.prompt}
                  style={{width: '100%', height: 'auto', display: 'block'}}
                />
                <div className="image-info">
                  <p className="image-prompt">{image.prompt}</p>
                  <div className="button-group">
                    <button
                      className="download-button"
                      onClick={() => {
                        const filename = `ad-${(image.headlineText || 'generated').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)}-${Date.now()}.png`
                        downloadImage(image.url, filename)
                      }}
                    >
                      Download
                    </button>
                    <button
                      className="regenerate-button"
                      onClick={() => generateSimilar(image)}
                      title="Generate a similar ad with the same settings"
                    >
                      🔄 Similar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageGenerator