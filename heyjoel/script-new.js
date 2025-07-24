// Audio synchronization engine
class AudioWordSync {
    constructor() {
        this.audio = document.getElementById('audioPlayer');
        this.wordDisplay = document.getElementById('currentWord');
        this.playBtn = document.getElementById('playPauseBtn');
        this.progressFill = document.querySelector('.progress-fill');
        this.currentTimeDisplay = document.getElementById('currentTime');
        this.durationDisplay = document.getElementById('duration');
        
        this.words = [];
        this.currentWordIndex = 0;
        this.isPlaying = false;
        this.hasFiles = false;
        this.isInitialState = true;
        this.clearTimeout = null; // For delayed clearing
        this.lastDisplayType = null; // Track if showing image or text
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Audio events
        this.audio.addEventListener('loadedmetadata', () => this.onAudioLoaded());
        this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audio.addEventListener('ended', () => this.onAudioEnded());
        
        // Play/pause button
        this.playBtn.addEventListener('click', () => this.togglePlayPause());
        
        // Make the word display clickable in initial state
        this.wordDisplay.addEventListener('click', () => {
            if (this.isInitialState && this.hasFiles) {
                this.togglePlayPause();
            }
        });
        
        // Auto-load files on startup
        this.loadDefaultFiles();
    }
    
    async loadDefaultFiles() {
        console.log('📁 loadDefaultFiles started');
        
        try {
            // Load JSON timing data
            console.log('📄 Attempting to fetch audio-timing.json');
            const response = await fetch('./audio-timing.json');
            console.log('📄 JSON response status:', response.status, response.statusText);
            console.log('📄 JSON response headers:', [...response.headers]);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log('📄 Parsing JSON response');
            this.words = await response.json();
            this.currentWordIndex = 0;
            console.log('✅ JSON loaded successfully:', this.words.length, 'words');
            
            // Load audio file
            console.log('🎵 Setting audio source to ./audio.m4a');
            this.audio.src = './audio.m4a';
            console.log('🎵 Audio src set to:', this.audio.src);
            
            // Add multiple audio event listeners for debugging
            this.audio.addEventListener('loadstart', () => {
                console.log('🎵 Audio loadstart event');
            });
            
            this.audio.addEventListener('loadeddata', () => {
                console.log('🎵 Audio loadeddata event');
            });
            
            this.audio.addEventListener('loadedmetadata', () => {
                console.log('🎵 Audio loadedmetadata event');
                console.log('🎵 Audio duration:', this.audio.duration);
            });
            
            this.audio.addEventListener('canplay', () => {
                console.log('🎵 Audio canplay event');
                this.checkIfReady();
            }, { once: true });
            
            this.audio.addEventListener('canplaythrough', () => {
                console.log('🎵 Audio canplaythrough event');
            });
            
            this.audio.addEventListener('error', (e) => {
                console.error('❌ Audio loading error:', e);
                console.error('❌ Audio error details:', {
                    error: this.audio.error,
                    networkState: this.audio.networkState,
                    readyState: this.audio.readyState,
                    src: this.audio.src
                });
                this.wordDisplay.textContent = 'Audio load error';
            });
            
            this.audio.addEventListener('stalled', () => {
                console.log('⚠️ Audio stalled event');
            });
            
            this.audio.addEventListener('suspend', () => {
                console.log('⚠️ Audio suspend event');
            });
            
            this.audio.addEventListener('abort', () => {
                console.log('⚠️ Audio abort event');
            });
            
            // Try to start loading
            console.log('🎵 Calling audio.load()');
            this.audio.load();
            
        } catch (error) {
            console.error('❌ Error loading default files:', error);
            console.error('❌ Error details:', error.message, error.stack);
            this.wordDisplay.textContent = 'Start local server (python3 -m http.server)';
        }
    }
    
    checkIfReady() {
        console.log('🔄 checkIfReady called');
        console.log('🎵 Audio src:', this.audio.src);
        console.log('📝 Words loaded:', this.words.length);
        
        if (this.audio.src && this.words.length > 0) {
            console.log('✅ Files ready - enabling play button');
            this.hasFiles = true;
            this.playBtn.disabled = false;
            this.wordDisplay.textContent = 'Hey';
            this.calculateOptimalFontSize('Hey');
            this.isInitialState = true;
        } else {
            console.log('❌ Files not ready yet');
        }
    }
    
    onAudioLoaded() {
        this.durationDisplay.textContent = this.formatTime(this.audio.duration);
    }
    
    togglePlayPause() {
        console.log('🎮 togglePlayPause called');
        console.log('📁 hasFiles:', this.hasFiles);
        console.log('▶️ isPlaying:', this.isPlaying);
        
        if (!this.hasFiles) {
            console.log('❌ No files loaded - cannot play');
            return;
        }
        
        if (this.isPlaying) {
            console.log('⏸️ Pausing audio');
            this.audio.pause();
            this.isPlaying = false;
            const iconElement = this.playBtn.querySelector('.material-symbols-outlined');
            if (iconElement) {
                iconElement.textContent = 'play_arrow';
            } else {
                console.log('⚠️ Could not find icon element');
            }
        } else {
            console.log('▶️ Starting audio playback');
            const playPromise = this.audio.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('✅ Audio playback started successfully');
                    this.isPlaying = true;
                    this.isInitialState = false; // No longer in initial state
                    const iconElement = this.playBtn.querySelector('.material-symbols-outlined');
                    if (iconElement) {
                        iconElement.textContent = 'pause';
                    } else {
                        console.log('⚠️ Could not find icon element');
                    }
                }).catch(error => {
                    console.error('❌ Audio playback failed:', error);
                    console.log('🔍 Audio state:', {
                        src: this.audio.src,
                        readyState: this.audio.readyState,
                        networkState: this.audio.networkState,
                        error: this.audio.error
                    });
                });
            }
        }
    }
    
    onTimeUpdate() {
        const currentTime = this.audio.currentTime;
        
        // Update progress bar
        const progress = (currentTime / this.audio.duration) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.currentTimeDisplay.textContent = this.formatTime(currentTime);
        
        // Find current word
        this.updateCurrentWord(currentTime);
    }
    
    updateCurrentWord(currentTime) {
        // Add timing tolerance for Safari (±0.15 seconds)
        const tolerance = 0.15;
        
        // Clear any pending clear timeout since we're updating
        if (this.clearTimeout) {
            clearTimeout(this.clearTimeout);
            this.clearTimeout = null;
        }
        
        // Find the word that should be displayed at current time
        for (let i = 0; i < this.words.length; i++) {
            const word = this.words[i];
            
            // More forgiving timing check
            const wordStart = word.start - tolerance;
            const wordEnd = word.end + tolerance;
            
            if (currentTime >= wordStart && currentTime <= wordEnd) {
                if (i !== this.currentWordIndex) {
                    console.log(`⏰ Time ${currentTime.toFixed(2)}s: Switching from index ${this.currentWordIndex} to ${i}`);
                    console.log(`📝 New word: "${word.word}" (${word.start}s - ${word.end}s) [tolerance: ±${tolerance}s]`);
                    this.currentWordIndex = i;
                    this.displayWord(word);
                }
                return;
            }
        }
        
        // If no word is active, use smart clearing logic
        if (this.wordDisplay.textContent !== '' || this.wordDisplay.querySelector('#wordImage')) {
            console.log(`⏰ Time ${currentTime.toFixed(2)}s: No active word - initiating smart clear`);
            this.smartClear(currentTime);
        }
    }
    
    smartClear(currentTime) {
        // Determine clearing delay based on content type
        const hasImage = this.wordDisplay.querySelector('#wordImage');
        const delay = hasImage ? 400 : 100; // 400ms for images, 100ms for text
        
        console.log(`🧠 Smart clear: ${hasImage ? 'IMAGE' : 'TEXT'} detected, delay: ${delay}ms`);
        
        this.clearTimeout = setTimeout(() => {
            // Double-check we still need to clear (in case new word appeared)
            if (this.wordDisplay.textContent !== '' || this.wordDisplay.querySelector('#wordImage')) {
                console.log(`🧹 Executing delayed clear after ${delay}ms`);
                this.wordDisplay.textContent = '';
                this.wordDisplay.innerHTML = '';
                this.wordDisplay.style.transform = '';
                this.lastDisplayType = null;
            }
            this.clearTimeout = null;
        }, delay);
    }
    
    async displayWord(wordObj) {
        const word = wordObj.word;
        
        console.log(`🎭 displayWord called for: "${word}"`);
        
        // Check if an image exists for this word
        const imagePath = await this.checkForWordImage(word);
        
        if (imagePath) {
            console.log(`🖼️ Displaying image for "${word}": ${imagePath}`);
            // Display image instead of text (no rotation)
            this.wordDisplay.innerHTML = `<img id="wordImage" src="${imagePath}" alt="${word}">`;
            console.log(`🏗️ HTML set to:`, this.wordDisplay.innerHTML);
            this.lastDisplayType = 'image';
            this.calculateOptimalImageSize();
            console.log(`📐 calculateOptimalImageSize called`);
        } else {
            console.log(`📝 Displaying text for: "${word}"`);
            // Display text with random rotation
            this.wordDisplay.textContent = word;
            this.lastDisplayType = 'text';
            this.calculateOptimalFontSize(word);
            
            // Apply random rotation to text only
            const rotation = this.generateRandomRotation();
            this.wordDisplay.style.transform = `rotate(${rotation}deg)`;
            this.wordDisplay.style.transformOrigin = 'center center';
            console.log(`🔄 Applied rotation: ${rotation}deg`);
        }
        
        // Check if this word should trigger confetti
        if (word.toLowerCase().includes('website')) {
            console.log(`🎉 Triggering confetti for: "${word}"`);
            this.playConfetti();
        }
    }
    
    async checkForWordImage(word) {
        const cleanWord = word.toLowerCase().replace(/[.,!?;:]$/, ''); // Remove punctuation
        const formats = ['png', 'jpg', 'svg'];
        
        console.log(`🖼️ Checking for image: "${cleanWord}"`);
        
        for (const format of formats) {
            const imagePath = `./${cleanWord}.${format}`;
            console.log(`🔍 Trying: ${imagePath}`);
            try {
                const response = await fetch(imagePath, { 
                    method: 'HEAD',
                    cache: 'force-cache' // Cache results to avoid repeated requests
                });
                console.log(`📷 ${imagePath} - Status: ${response.status}`);
                if (response.ok) {
                    console.log(`✅ Found image: ${imagePath}`);
                    return imagePath;
                }
            } catch (error) {
                console.log(`❌ ${imagePath} - Error: ${error.message}`);
                // Silently continue - 404s are expected for most words
            }
        }
        
        console.log(`🚫 No image found for: "${cleanWord}"`);
        return null; // No image found
    }
    
    generateRandomRotation() {
        // Generate random rotation between -3 and +3 degrees
        return (Math.random() * 6) - 3;
    }
    
    playConfetti() {
        // Create confetti video overlay
        const confettiVideo = document.createElement('video');
        confettiVideo.id = 'confettiOverlay';
        confettiVideo.src = './confetti.webm';
        confettiVideo.autoplay = true;
        confettiVideo.muted = true; // Required for autoplay
        confettiVideo.style.position = 'fixed';
        confettiVideo.style.top = '50%';
        confettiVideo.style.left = '50%';
        confettiVideo.style.transform = 'translate(-50%, -50%)';
        confettiVideo.style.width = 'auto';
        confettiVideo.style.height = 'auto';
        confettiVideo.style.maxWidth = '100vw';
        confettiVideo.style.maxHeight = '100vh';
        confettiVideo.style.zIndex = '10'; // Above word display but below controls
        confettiVideo.style.pointerEvents = 'none'; // Don't block interactions
        
        // Add to page
        document.body.appendChild(confettiVideo);
        
        // Remove when video ends
        confettiVideo.addEventListener('ended', () => {
            if (confettiVideo.parentNode) {
                confettiVideo.parentNode.removeChild(confettiVideo);
            }
        });
        
        // Also remove after 5 seconds as fallback
        setTimeout(() => {
            if (confettiVideo.parentNode) {
                confettiVideo.parentNode.removeChild(confettiVideo);
            }
        }, 5000);
    }
    
    calculateOptimalImageSize() {
        const imageElement = this.wordDisplay.querySelector('#wordImage');
        if (!imageElement) {
            console.log('❌ calculateOptimalImageSize: No image element found');
            return;
        }
        
        console.log('🖼️ calculateOptimalImageSize called');
        console.log('📷 Image element:', imageElement);
        console.log('📷 Image src:', imageElement.src);
        console.log('📷 Image complete:', imageElement.complete);
        console.log('📷 Image naturalWidth:', imageElement.naturalWidth);
        console.log('📷 Image naturalHeight:', imageElement.naturalHeight);
        
        // Define target constraints with extra padding to prevent clipping
        const maxWidth = window.innerWidth * 0.88;
        const maxHeight = window.innerHeight * 0.55;
        
        console.log('🎯 Target constraints:', maxWidth, 'x', maxHeight);
        
        // Check parent container properties
        const parentElement = this.wordDisplay;
        console.log('📦 Parent element:', parentElement);
        console.log('📦 Parent dimensions:', parentElement.offsetWidth, 'x', parentElement.offsetHeight);
        console.log('📦 Parent computed styles:', window.getComputedStyle(parentElement));
        
        // Check if image element is actually in DOM
        console.log('🌐 Image in DOM:', document.contains(imageElement));
        console.log('🌐 Image offsetParent:', imageElement.offsetParent);
        console.log('🌐 Image getBoundingClientRect:', imageElement.getBoundingClientRect());
        
        // Function to actually do the sizing
        const performSizing = () => {
            console.log('🔧 Performing sizing calculation');
            console.log('📐 Natural dimensions:', imageElement.naturalWidth, 'x', imageElement.naturalHeight);
            
            // Safari-specific: Try to force a reflow before sizing
            console.log('🍎 Safari fix: Forcing reflow');
            imageElement.style.display = 'none';
            imageElement.offsetHeight; // Trigger reflow
            imageElement.style.display = 'block';
            
            if (imageElement.naturalWidth === 0 || imageElement.naturalHeight === 0) {
                console.log('⚠️ Image has zero natural dimensions - using fallback');
                // Enhanced fallback sizing for Safari
                const fallbackWidth = Math.min(maxWidth, 300);
                const fallbackHeight = Math.min(maxHeight, 200);
                
                console.log('🔧 Setting fallback dimensions:', fallbackWidth, 'x', fallbackHeight);
                imageElement.style.width = fallbackWidth + 'px';
                imageElement.style.height = fallbackHeight + 'px';
                imageElement.style.display = 'block';
                imageElement.style.visibility = 'visible';
                imageElement.style.opacity = '1';
                imageElement.style.position = 'relative';
                imageElement.style.zIndex = '1';
                
                // Force another reflow
                imageElement.offsetHeight;
                
                // Log final state after fallback
                setTimeout(() => {
                    console.log('🔍 After fallback - computed styles:', window.getComputedStyle(imageElement));
                    console.log('🔍 After fallback - getBoundingClientRect:', imageElement.getBoundingClientRect());
                }, 100);
                
                return;
            }
            
            let width = maxWidth;
            let height = maxHeight;
            
            // Calculate scale to fit within constraints while maintaining aspect ratio
            const imageAspectRatio = imageElement.naturalWidth / imageElement.naturalHeight;
            const containerAspectRatio = maxWidth / maxHeight;
            
            console.log('📊 Aspect ratios - Image:', imageAspectRatio, 'Container:', containerAspectRatio);
            
            if (imageAspectRatio > containerAspectRatio) {
                // Image is wider - constrain by width
                height = width / imageAspectRatio;
                console.log('📏 Width-constrained sizing');
            } else {
                // Image is taller - constrain by height  
                width = height * imageAspectRatio;
                console.log('📏 Height-constrained sizing');
            }
            
            console.log('✅ Final calculated dimensions:', width, 'x', height);
            
            // Apply the calculated dimensions with extra Safari properties
            imageElement.style.width = width + 'px';
            imageElement.style.height = height + 'px';
            imageElement.style.display = 'block';
            imageElement.style.visibility = 'visible';
            imageElement.style.opacity = '1';
            imageElement.style.position = 'relative';
            imageElement.style.zIndex = '1';
            
            // Force reflow after setting styles
            imageElement.offsetHeight;
            
            console.log('🎨 Applied styles:', {
                width: imageElement.style.width,
                height: imageElement.style.height,
                display: imageElement.style.display,
                visibility: imageElement.style.visibility,
                opacity: imageElement.style.opacity,
                position: imageElement.style.position,
                zIndex: imageElement.style.zIndex
            });
            
            // Check computed styles with delay
            setTimeout(() => {
                const computed = window.getComputedStyle(imageElement);
                console.log('💻 Computed styles (delayed):', {
                    width: computed.width,
                    height: computed.height,
                    display: computed.display,
                    visibility: computed.visibility,
                    opacity: computed.opacity,
                    position: computed.position,
                    zIndex: computed.zIndex
                });
                console.log('📏 Final getBoundingClientRect:', imageElement.getBoundingClientRect());
            }, 100);
        };
        
        // Wait for image to load to get natural dimensions
        imageElement.onload = () => {
            console.log('🎉 Image onload event fired');
            performSizing();
        };
        
        imageElement.onerror = (error) => {
            console.error('❌ Image onerror event fired:', error);
        };
        
        // If image is already loaded
        if (imageElement.complete && imageElement.naturalWidth > 0) {
            console.log('✅ Image already loaded, sizing immediately');
            performSizing();
        } else {
            console.log('⏳ Image not loaded yet, waiting for onload event');
            // Enhanced timeout fallback for Safari
            setTimeout(() => {
                console.log('⏰ Timeout check - Image state:', {
                    complete: imageElement.complete,
                    naturalWidth: imageElement.naturalWidth,
                    naturalHeight: imageElement.naturalHeight,
                    src: imageElement.src
                });
                
                if (imageElement.naturalWidth === 0) {
                    console.log('⚠️ Timeout: Image still not loaded, using enhanced fallback sizing');
                    const fallbackWidth = Math.min(maxWidth, 300);
                    const fallbackHeight = Math.min(maxHeight, 200);
                    
                    imageElement.style.width = fallbackWidth + 'px';
                    imageElement.style.height = fallbackHeight + 'px';
                    imageElement.style.display = 'block';
                    imageElement.style.visibility = 'visible';
                    imageElement.style.opacity = '1';
                    imageElement.style.position = 'relative';
                    imageElement.style.zIndex = '1';
                    
                    // Force reflow
                    imageElement.offsetHeight;
                    
                    console.log('🔧 Fallback applied - checking result');
                    setTimeout(() => {
                        console.log('🔍 Fallback result:', window.getComputedStyle(imageElement));
                        console.log('🔍 Fallback rect:', imageElement.getBoundingClientRect());
                    }, 50);
                } else {
                    console.log('✅ Image loaded during timeout period, performing sizing');
                    performSizing();
                }
            }, 500);
        }
    }
    
    // SIMPLIFIED responsive text scaling - start simple and working
    calculateOptimalFontSize(word) {
        const element = this.wordDisplay;
        
        // Debug Safari issues
        console.log('🔍 Safari Debug - calculateOptimalFontSize called');
        console.log('📱 Viewport:', window.innerWidth, 'x', window.innerHeight);
        console.log('🌐 User Agent:', navigator.userAgent);
        console.log('📝 Word:', word, 'Length:', word.length);
        
        // Simple responsive calculation based on viewport and word length
        const baseSize = Math.min(window.innerWidth, window.innerHeight);
        const wordLength = word.length;
        
        console.log('📏 Base size (min viewport):', baseSize);
        
        // Base size calculation: shorter words get bigger fonts
        let fontSize;
        if (wordLength <= 3) {
            fontSize = baseSize * 0.25; // 25% of smaller viewport dimension
        } else if (wordLength <= 6) {
            fontSize = baseSize * 0.20; // 20% of smaller viewport dimension
        } else if (wordLength <= 10) {
            fontSize = baseSize * 0.15; // 15% of smaller viewport dimension
        } else {
            fontSize = baseSize * 0.12; // 12% of smaller viewport dimension
        }
        
        console.log('🎯 Calculated font size (before min):', fontSize);
        
        // Ensure minimum readable size
        fontSize = Math.max(fontSize, 24);
        
        console.log('✅ Final font size:', fontSize);
        
        // Apply the font size
        element.style.fontSize = fontSize + 'px';
        
        // Verify it was applied
        const computedStyle = window.getComputedStyle(element);
        console.log('🔧 Applied font size:', computedStyle.fontSize);
        console.log('🎨 Font family:', computedStyle.fontFamily);
    }
    
    onAudioEnded() {
        this.isPlaying = false;
        this.playBtn.querySelector('.material-symbols-outlined').textContent = 'play_arrow';
        this.showEndMessage();
        this.progressFill.style.width = '100%';
    }
    
    showEndMessage() {
        // Clear any existing content and transforms
        this.wordDisplay.innerHTML = '';
        this.wordDisplay.style.transform = '';
        
        // Display linked image
        this.wordDisplay.innerHTML = '<a href="https://docs.google.com/presentation/d/1fdFmGObclXSmWrvj6TELDlrwHWwmko8rPoL5G9diFOY/present?slide=id.gefbcca66b8_0_944" target="_blank" style="display: block; text-decoration: none;"><img id="wordImage" src="./onward.png" alt="Check out my work"></a>';
        this.wordDisplay.style.cursor = 'pointer';
        this.calculateOptimalImageSize();
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Page loaded - Safari debugging active');
    console.log('🌐 Browser:', navigator.userAgent);
    console.log('📱 Initial viewport:', window.innerWidth, 'x', window.innerHeight);
    
    // Check if fonts are loaded
    if (document.fonts) {
        document.fonts.ready.then(() => {
            console.log('✅ Fonts loaded successfully');
        });
    } else {
        console.log('⚠️ Font Loading API not supported');
    }
    
    // Test audio support
    const audio = document.createElement('audio');
    console.log('🎵 Audio format support:');
    console.log('- MP3:', audio.canPlayType('audio/mpeg'));
    console.log('- M4A:', audio.canPlayType('audio/mp4'));
    console.log('- WAV:', audio.canPlayType('audio/wav'));
    
    window.audioSync = new AudioWordSync();
});