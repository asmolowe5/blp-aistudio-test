import { useState } from 'react'
import ImageGenerator from './components/ImageGenerator'
import VideoGenerator from './components/VideoGenerator'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('images')

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-placeholder">
              {/* Replace with actual logo when available */}
              <img 
                src="/logo.png" 
                alt="BLP Logo" 
                style={{width: '40px', height: '40px', objectFit: 'contain'}}
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'block'
                }}
              />
              <span className="logo-text" style={{display: 'none'}}>BLP</span>
            </div>
            <div className="header-text">
              <h1>BLP AD STUDIO</h1>
              <p>Internal Creative AI Generator</p>
            </div>
          </div>
        </div>
        
        <nav className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'images' ? 'active' : ''}`}
            onClick={() => setActiveTab('images')}
          >
            📸 Image Ads
          </button>
          <button 
            className={`tab-button ${activeTab === 'videos' ? 'active' : ''}`}
            onClick={() => setActiveTab('videos')}
          >
            🎬 Video Ads
          </button>
        </nav>
      </header>
      <main>
        {activeTab === 'images' && <ImageGenerator />}
        {activeTab === 'videos' && <VideoGenerator />}
      </main>
    </div>
  )
}

export default App
