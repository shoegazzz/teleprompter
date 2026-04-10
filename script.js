class Teleprompter {
    constructor() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPosition = 0;
        this.startTime = null;
        this.pausedTime = 0;
        this.segmentDuration = 0; // auto-calculated from text and speed
        this.speed = 50; // words per minute
        this.fontSize = 32;
        this.animationId = null;
        this.timerInterval = null;
        
        this.initializeElements();
        this.bindEvents();
        this.updateDisplay();
        this.updateDurationCalculations();
    }
    
    initializeElements() {
        this.fileUpload = document.getElementById('file-upload');
        this.clearBtn = document.getElementById('clear-text');
        this.speedControl = document.getElementById('speed-control');
        this.speedDisplay = document.getElementById('speed-display');
        this.fontSizeControl = document.getElementById('font-size');
        this.fontSizeDisplay = document.getElementById('font-size-display');
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.prompterText = document.getElementById('prompter-text');
        this.countdownTimer = document.getElementById('countdown-timer');
        this.elapsedTime = document.getElementById('elapsed-time');
        this.wordCount = document.getElementById('word-count');
        this.expectedDuration = document.getElementById('expected-duration');
    }
    
    bindEvents() {
        this.fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));
        this.clearBtn.addEventListener('click', () => this.clearText());
        this.speedControl.addEventListener('input', (e) => this.updateSpeed(e.target.value));
        this.fontSizeControl.addEventListener('input', (e) => this.updateFontSize(e.target.value));
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());
        
        // Make text area editable
        this.prompterText.contentEditable = true;
        this.prompterText.addEventListener('focus', () => {
            if (!this.isPlaying) {
                this.prompterText.classList.add('prompter-text-editable');
            }
        });
        this.prompterText.addEventListener('blur', () => {
            this.prompterText.classList.remove('prompter-text-editable');
        });
        
        // Prevent editing while playing and update calculations on text change
        this.prompterText.addEventListener('keydown', (e) => {
            if (this.isPlaying) {
                e.preventDefault();
            }
        });
        
        // Update calculations when text changes
        this.prompterText.addEventListener('input', () => {
            this.updateDurationCalculations();
        });
    }
    
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            let text = '';
            
            if (file.type === 'text/plain') {
                text = await this.readTextFile(file);
            } else if (file.type === 'application/pdf') {
                alert('PDF support requires additional libraries. Please use a text file for now.');
                return;
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                       file.name.toLowerCase().endsWith('.docx')) {
                text = await this.readWordDocument(file);
            } else if (file.type.includes('word') || file.name.toLowerCase().endsWith('.doc')) {
                alert('Legacy .doc files are not supported. Please use .docx format or convert to text.');
                return;
            } else {
                // Try to read as text anyway
                text = await this.readTextFile(file);
            }
            
            this.setPrompterText(text);
        } catch (error) {
            alert('Error reading file: ' + error.message);
        }
    }
    
    readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    readWordDocument(file) {
        return new Promise((resolve, reject) => {
            if (typeof mammoth === 'undefined') {
                reject(new Error('Mammoth library not loaded. Please refresh the page.'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const result = await mammoth.extractRawText({arrayBuffer: arrayBuffer});
                    
                    if (result.messages && result.messages.length > 0) {
                        console.warn('Word document conversion warnings:', result.messages);
                    }
                    
                    resolve(result.value);
                } catch (error) {
                    reject(new Error('Failed to parse Word document: ' + error.message));
                }
            };
            reader.onerror = (e) => reject(new Error('Failed to read Word document'));
            reader.readAsArrayBuffer(file);
        });
    }
    
    setPrompterText(text) {
        // Convert plain text to paragraphs
        const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
        this.prompterText.innerHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
        this.updateDurationCalculations();
    }
    
    clearText() {
        this.prompterText.innerHTML = '<p>Upload your manuscript or type your text here...</p>';
        this.reset();
        this.updateDurationCalculations();
    }
    
    updateSpeed(value) {
        this.speed = parseInt(value);
        this.speedDisplay.textContent = this.speed;
        this.updateDurationCalculations();
    }
    
    updateFontSize(value) {
        this.fontSize = parseInt(value);
        this.fontSizeDisplay.textContent = this.fontSize + 'px';
        this.prompterText.style.fontSize = this.fontSize + 'px';
    }
    
    start() {
        if (this.isPaused) {
            this.resume();
            return;
        }
        
        this.isPlaying = true;
        this.isPaused = false;
        this.startTime = Date.now() - this.pausedTime;
        
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        
        this.addStatusIndicator('playing');
        this.startScrolling();
        this.startTimer();
    }
    
    pause() {
        this.isPaused = true;
        this.isPlaying = false;
        this.pausedTime = Date.now() - this.startTime;
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        
        this.addStatusIndicator('paused');
        this.stopScrolling();
        this.stopTimer();
    }
    
    resume() {
        this.isPlaying = true;
        this.isPaused = false;
        this.startTime = Date.now() - this.pausedTime;
        
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        
        this.addStatusIndicator('playing');
        this.startScrolling();
        this.startTimer();
    }
    
    reset() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPosition = 0;
        this.startTime = null;
        this.pausedTime = 0;
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        
        this.addStatusIndicator('stopped');
        this.stopScrolling();
        this.stopTimer();
        
        // Reset text position
        this.prompterText.style.transform = 'translateY(0px)';
        this.updateDisplay();
    }
    
    updateDurationCalculations() {
        const wordCount = this.getWordCount();
        const expectedDurationMs = this.calculateExpectedDuration(wordCount);

        // Auto-set segment duration from text and speed
        this.segmentDuration = expectedDurationMs;

        this.wordCount.textContent = wordCount.toLocaleString();
        this.expectedDuration.textContent = this.formatDuration(expectedDurationMs);

        this.updateCountdownDisplay();
    }
    
    getWordCount() {
        const text = this.prompterText.textContent || this.prompterText.innerText || '';
        // Simple word count: split by whitespace and filter empty strings
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        return words.length;
    }
    
    calculateExpectedDuration(wordCount) {
        // Duration in milliseconds = (wordCount / wordsPerMinute) * 60 * 1000
        return Math.round((wordCount / this.speed) * 60 * 1000);
    }
    
    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    startScrolling() {
        const scroll = () => {
            if (!this.isPlaying) return;

            const textHeight = this.prompterText.scrollHeight;

            if (this.segmentDuration > 0 && textHeight > 0) {
                const elapsed = Date.now() - this.startTime;
                this.currentPosition = (elapsed / this.segmentDuration) * textHeight;
                this.prompterText.style.transform = `translateY(${-this.currentPosition}px)`;
            }

            this.animationId = requestAnimationFrame(scroll);
        };

        this.animationId = requestAnimationFrame(scroll);
    }
    
    stopScrolling() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            this.updateDisplay();
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    updateDisplay() {
        const elapsed = this.startTime ? Date.now() - this.startTime : this.pausedTime;
        const remaining = Math.max(0, this.segmentDuration - elapsed);
        
        this.updateCountdownDisplay(remaining);
        this.updateElapsedDisplay(elapsed);
        
        // Auto-stop when segment time is reached
        if (remaining <= 0 && this.isPlaying) {
            this.pause();
            alert('Segment time completed!');
        }
    }
    
    updateCountdownDisplay(remaining = this.segmentDuration) {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        
        this.countdownTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update timer color based on remaining time
        this.countdownTimer.className = '';
        if (remaining < 60000) { // Less than 1 minute
            this.countdownTimer.classList.add('danger');
        } else if (remaining < 300000) { // Less than 5 minutes
            this.countdownTimer.classList.add('warning');
        }
    }
    
    updateElapsedDisplay(elapsed) {
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        this.elapsedTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    addStatusIndicator(status) {
        // Remove existing status indicator
        const existing = document.querySelector('.status-indicator');
        if (existing) {
            existing.remove();
        }
        
        // Add new status indicator
        const indicator = document.createElement('div');
        indicator.className = `status-indicator ${status}`;
        indicator.textContent = status.toUpperCase();
        document.querySelector('.prompter-area').appendChild(indicator);
    }
}

// Initialize the teleprompter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new Teleprompter();
});