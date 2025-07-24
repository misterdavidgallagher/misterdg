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
        
        this.setupEventListeners();
        this.setupShader();
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
    
    setupShader() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false
        });
        
        // Setup renderer for full screen
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h);
        this.renderer.setClearColor(0xFAE1DF);
        document.body.insertBefore(this.renderer.domElement, document.body.firstChild);
        
        // Shader uniforms for 2-color vignette - more subtle
        this.uniforms = {
            u_time: { value: 0.0 },
            u_resolution: { value: new THREE.Vector2(w, h) },
            u_wordIntensity: { value: 0.2 },
            u_vignetteStrength: { value: 0.6 }, // Reduced for more subtle effect
            u_innerColor: { value: new THREE.Vector3(0.96, 0.86, 0.85) }, // #F5DCDB (darker center)
            u_outerColor: { value: new THREE.Vector3(0.98, 0.88, 0.87) }   // #FAE1DF (warm pink edges)
        };
        
        // Simple vignette shader
        const vertexShader = `
            void main() {
                gl_Position = vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            precision highp float;
            
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform float u_wordIntensity;
            uniform float u_vignetteStrength;
            uniform vec3 u_innerColor;
            uniform vec3 u_outerColor;
            
            void main() {
                vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                vec2 center = vec2(0.5, 0.5);
                
                // Calculate distance from center
                float dist = distance(uv, center);
                
                // Create vignette effect
                float vignette = 1.0 - smoothstep(0.0, u_vignetteStrength, dist);
                
                // Add subtle pulse based on word intensity
                float pulse = sin(u_time * 3.0) * 0.1 + 0.9;
                vignette *= pulse * u_wordIntensity;
                
                // Mix colors based on vignette
                vec3 color = mix(u_outerColor, u_innerColor, vignette);
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;
        
        // Create material and mesh
        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        });
        
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.mesh);
        
        // Start animation loop
        this.animate();
        
        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.uniforms.u_time.value += 0.016;
        this.renderer.render(this.scene, this.camera);
    }
    
    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h);
        this.uniforms.u_resolution.value.set(w, h);
    }
    
    async loadDefaultFiles() {
        try {
            // Load JSON timing data
            const response = await fetch('./audio-timing.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.words = await response.json();
            this.currentWordIndex = 0;
            
            // Load audio file
            this.audio.src = './audio.m4a';
            
            // Wait for audio to be loadable
            this.audio.addEventListener('canplay', () => {
                this.checkIfReady();
            }, { once: true });
            
            this.audio.addEventListener('error', (e) => {
                console.error('Audio loading error:', e);
                this.wordDisplay.textContent = 'Audio load error';
            });
            
        } catch (error) {
            console.error('Error loading default files:', error);
            this.wordDisplay.textContent = 'Start local server (python3 -m http.server)';
        }
    }
    
    checkIfReady() {
        if (this.audio.src && this.words.length > 0) {
            this.hasFiles = true;
            this.playBtn.disabled = false;
            this.wordDisplay.textContent = 'Play';
            this.isInitialState = true;
        }
    }
    
    onAudioLoaded() {
        this.durationDisplay.textContent = this.formatTime(this.audio.duration);
    }
    
    togglePlayPause() {
        if (!this.hasFiles) return;
        
        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
            this.playBtn.textContent = 'Play';
        } else {
            this.audio.play();
            this.isPlaying = true;
            this.isInitialState = false; // No longer in initial state
            this.playBtn.textContent = 'Pause';
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
        // Find the word that should be displayed at current time
        for (let i = 0; i < this.words.length; i++) {
            const word = this.words[i];
            if (currentTime >= word.start && currentTime <= word.end) {
                if (i !== this.currentWordIndex) {
                    this.currentWordIndex = i;
                    this.displayWord(word); // Now async but we don't need to await
                    this.triggerWordEffect();
                }
                return;
            }
        }
        
        // If no word is active, show empty
        if (this.wordDisplay.textContent !== '' || this.wordDisplay.querySelector('#wordImage')) {
            this.wordDisplay.textContent = '';
            this.wordDisplay.innerHTML = ''; // Clear any images too
            this.wordDisplay.style.transform = ''; // Clear any rotation
        }
    }
    
    async displayWord(wordObj) {
        const word = wordObj.word;
        
        // Check if an image exists for this word
        const imagePath = await this.checkForWordImage(word);
        
        if (imagePath) {
            // Display image instead of text (no rotation)
            this.wordDisplay.innerHTML = `<img id="wordImage" src="${imagePath}" alt="${word}">`;
            this.calculateOptimalImageSize();
        } else {
            // Display text with random rotation
            this.wordDisplay.textContent = word;
            this.calculateOptimalFontSize(word);
            
            // Apply random rotation to text only
            const rotation = this.generateRandomRotation();
            this.wordDisplay.style.transform = `rotate(${rotation}deg)`;
            this.wordDisplay.style.transformOrigin = 'center center';
        }
        
        // Check if this word should trigger confetti
        if (word.toLowerCase().includes('website')) {
            this.playConfetti();
        }
    }
    
    async checkForWordImage(word) {
        const cleanWord = word.toLowerCase().replace(/[.,!?;:]$/, ''); // Remove punctuation
        const formats = ['png', 'jpg', 'svg'];
        
        for (const format of formats) {
            const imagePath = `./${cleanWord}.${format}`;
            try {
                const response = await fetch(imagePath, { 
                    method: 'HEAD',
                    cache: 'force-cache' // Cache results to avoid repeated requests
                });
                if (response.ok) {
                    return imagePath;
                }
            } catch (error) {
                // Silently continue - 404s are expected for most words
            }
        }
        
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
        confettiVideo.style.top = '0';
        confettiVideo.style.left = '0';
        confettiVideo.style.width = '100vw';
        confettiVideo.style.height = '100vh';
        confettiVideo.style.objectFit = 'cover';
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
        if (!imageElement) return;
        
        // Define target constraints with extra padding to prevent clipping
        const maxWidth = window.innerWidth * 0.88;
        const maxHeight = window.innerHeight * 0.55;
        
        // Wait for image to load to get natural dimensions
        imageElement.onload = () => {
            let width = maxWidth;
            let height = maxHeight;
            
            // Calculate scale to fit within constraints while maintaining aspect ratio
            const imageAspectRatio = imageElement.naturalWidth / imageElement.naturalHeight;
            const containerAspectRatio = maxWidth / maxHeight;
            
            if (imageAspectRatio > containerAspectRatio) {
                // Image is wider - constrain by width
                height = width / imageAspectRatio;
            } else {
                // Image is taller - constrain by height  
                width = height * imageAspectRatio;
            }
            
            // Apply the calculated dimensions
            imageElement.style.width = width + 'px';
            imageElement.style.height = height + 'px';
        };
        
        // If image is already loaded
        if (imageElement.complete && imageElement.naturalWidth > 0) {
            imageElement.onload();
        }
    }
    
    calculateOptimalFontSize(word) {
        const element = this.wordDisplay;
        
        // Debug logging
        console.log(`📏 Calculating font size for: "${word}"`);
        console.log(`🖥️ Viewport: ${window.innerWidth}x${window.innerHeight}`);
        
        // Start with very large font size for maximum viewport utilization
        let fontSize = Math.min(window.innerWidth, window.innerHeight) * 0.8;
        element.style.fontSize = fontSize + 'px';
        
        // Define target constraints with extra padding to prevent clipping
        const maxWidth = window.innerWidth * 0.88;   // More conservative for width
        const maxHeight = window.innerHeight * 0.55; // Even more conservative for height to prevent clipping
        
        console.log(`🎯 Target constraints: ${maxWidth}w x ${maxHeight}h`);
        console.log(`📏 Starting font size: ${fontSize}px`);
        
        // Shrink font size until word fits within BOTH width AND height constraints
        let iterations = 0;
        while ((element.scrollWidth > maxWidth || element.scrollHeight > maxHeight) && fontSize > 20) {
            iterations++;
            fontSize -= 3; // Slightly larger decrements for efficiency
            element.style.fontSize = fontSize + 'px';
            
            if (iterations % 20 === 0) {
                console.log(`🔄 Iteration ${iterations}: ${fontSize}px, scroll: ${element.scrollWidth}x${element.scrollHeight}`);
            }
        }
        
        console.log(`✅ After shrinking: ${fontSize}px, scroll: ${element.scrollWidth}x${element.scrollHeight}`);
        
        // Fine-tune: grow back up carefully to maximize size without overflow
        let growIterations = 0;
        while (fontSize < window.innerHeight * 0.8) {
            const testSize = fontSize + 1;
            element.style.fontSize = testSize + 'px';
            growIterations++;
            
            // If adding 1px causes overflow, stop here
            if (element.scrollWidth > maxWidth || element.scrollHeight > maxHeight) {
                element.style.fontSize = fontSize + 'px';
                console.log(`🛑 Stopped growing at ${fontSize}px (would overflow at ${testSize}px)`);
                break;
            }
            
            fontSize = testSize;
        }
        
        console.log(`🎉 Final font size: ${fontSize}px`);
    }
    
    triggerWordEffect() {
        // Pulse the vignette when a new word appears
        this.uniforms.u_wordIntensity.value = 0.8;
        
        // Fade back to normal
        setTimeout(() => {
            this.uniforms.u_wordIntensity.value = 0.3;
        }, 150);
    }
    
    onAudioEnded() {
        this.isPlaying = false;
        this.playBtn.textContent = 'Play';
        this.showEndMessage();
        this.progressFill.style.width = '100%';
    }
    
    showEndMessage() {
        console.log('showEndMessage called - starting end sequence');
        
        // Clear any existing content and transforms
        this.wordDisplay.innerHTML = '';
        this.wordDisplay.style.transform = '';
        
        // Display linked image with debugging
        this.wordDisplay.innerHTML = '<a href="https://docs.google.com/presentation/d/1fdFmGObclXSmWrvj6TELDlrwHWwmko8rPoL5G9diFOY/present?slide=id.gefbcca66b8_0_944" target="_blank" style="display: block; text-decoration: none;"><img id="wordImage" src="./onward.png" alt="Check out my work"></a>';
        this.wordDisplay.style.cursor = 'pointer';
        
        // Add debugging for image loading
        const imageElement = this.wordDisplay.querySelector('#wordImage');
        if (imageElement) {
            console.log('Image element created, src:', imageElement.src);
            
            imageElement.onload = () => {
                console.log('✅ Image loaded successfully');
                console.log('Natural dimensions:', imageElement.naturalWidth, 'x', imageElement.naturalHeight);
            };
            
            imageElement.onerror = (error) => {
                console.error('❌ Image failed to load:', error);
                console.error('Image src was:', imageElement.src);
                console.error('Current URL:', window.location.href);
                
                // Fallback: show styled text instead
                console.log('🔄 Falling back to styled text');
                this.wordDisplay.innerHTML = '<a href="https://docs.google.com/presentation/d/1fdFmGObclXSmWrvj6TELDlrwHWwmko8rPoL5G9diFOY/present?slide=id.gefbcca66b8_0_944" target="_blank" style="color: inherit; text-decoration: none; font-family: inherit; display: block;">Check out<br>my work</a>';
                this.wordDisplay.style.fontSize = '4vw';
            };
            
            // Add click debugging
            imageElement.parentElement.onclick = (e) => {
                console.log('🔗 Link clicked!', e);
            };
        }
        
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
    window.audioSync = new AudioWordSync();
    
    // Add manual test function for debugging
    window.testEndMessage = () => {
        console.log('Manual test: calling showEndMessage()');
        window.audioSync.showEndMessage();
    };
    
    // Add image path test
    window.testImagePath = () => {
        console.log('Testing image path...');
        const testImg = new Image();
        testImg.onload = () => console.log('✅ Direct image test: SUCCESS');
        testImg.onerror = () => console.error('❌ Direct image test: FAILED');
        testImg.src = './onward.png';
    };
    
    // Add responsive test function
    window.testResponsive = () => {
        console.log('🧪 Testing responsive text with current viewport...');
        console.log(`Current viewport: ${window.innerWidth}x${window.innerHeight}`);
        window.audioSync.wordDisplay.textContent = 'TEST';
        window.audioSync.calculateOptimalFontSize('TEST');
    };
    
    // Add viewport change listener for debugging
    window.addEventListener('resize', () => {
        console.log(`📱 Viewport changed to: ${window.innerWidth}x${window.innerHeight}`);
    });
    
    console.log('Debug functions available: testEndMessage(), testImagePath(), testResponsive()');
});

