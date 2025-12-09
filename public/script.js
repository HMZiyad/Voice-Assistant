const micBtn = document.getElementById('mic-btn');
const statusIndicator = document.getElementById('status-indicator');
const chatWindow = document.getElementById('chat-window');
const waveContainer = document.getElementById('wave-container');
const instructionText = document.getElementById('instruction-text');

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let isProcessing = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one sentence/fragment
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        updateUIState('listening');
    };

    recognition.onend = () => {
        isListening = false;
        if (!isProcessing) {
            updateUIState('ready');
        }
    };

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('User said:', transcript);

        // Add User Message to UI
        addMessage(transcript, 'user');

        // Send to Backend
        await processConversation(transcript);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please allow microphone access.');
        }
        updateUIState('ready');
    };
} else {
    alert('Speech Recognition API not supported in this browser. Try Chrome or Edge.');
    micBtn.disabled = true;
    instructionText.textContent = "Browser not supported";
}

// Event Listeners
micBtn.addEventListener('click', () => {
    if (isListening) {
        recognition.stop();
    } else if (!isProcessing) {
        recognition.start();
    }
});

// Functions
function updateUIState(state) {
    statusIndicator.className = 'status-badge';
    waveContainer.classList.remove('active');
    micBtn.classList.remove('listening');

    switch (state) {
        case 'listening':
            statusIndicator.textContent = 'Listening...';
            statusIndicator.classList.add('active');
            micBtn.classList.add('listening');
            instructionText.textContent = "Tap to stop";
            break;
        case 'processing': // Talking to API
            statusIndicator.textContent = 'Thinking...';
            statusIndicator.classList.add('processing');
            isProcessing = true;
            waveContainer.classList.add('active'); // Maybe show different animation for thinking
            micBtn.disabled = true;
            instructionText.textContent = "Please wait";
            break;
        case 'speaking': // Playing Audio
            statusIndicator.textContent = 'Speaking...';
            statusIndicator.classList.add('active'); // Green
            isProcessing = true;
            waveContainer.classList.add('active');
            micBtn.disabled = true;
            instructionText.textContent = "Gemi is talking";
            break;
        case 'ready':
        default:
            statusIndicator.textContent = 'Ready';
            isProcessing = false;
            micBtn.disabled = false;
            instructionText.textContent = "Tap to speak";
            break;
    }
}

function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.textContent = text;

    msgDiv.appendChild(contentDiv);
    chatWindow.appendChild(msgDiv);

    // Scroll to bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function processConversation(text) {
    updateUIState('processing');

    try {
        const response = await fetch('/api/converse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();

        if (response.ok) {
            // Display AI Response
            if (data.text) {
                addMessage(data.text, 'ai');
            }

            // Play Audio if available
            if (data.audio) {
                updateUIState('speaking');
                await playAudio(data.audio);
            } else {
                // FALLBACK: Use Browser Native TTS
                console.warn("ElevenLabs Audio missing, using native TTS.");
                updateUIState('speaking');
                speakNative(data.text);
            }
        } else {
            console.error('Server Error Response:', data);
            addMessage(`Error: ${data.error}`, 'ai');
        }

    } catch (error) {
        console.error('Fetch Error:', error);
        addMessage("Sorry, I couldn't reach the server.", 'ai');
    } finally {
        updateUIState('ready');
    }
}

function playAudio(base64Audio) {
    return new Promise((resolve) => {
        const audio = new Audio("data:audio/mp3;base64," + base64Audio);

        audio.onended = () => {
            resolve();
        };

        audio.onerror = (e) => {
            console.error("Audio playback error", e);
            resolve(); // Don't hang
        };

        audio.play().catch(e => {
            console.error("Autoplay failed", e);
            resolve();
        });
    });
}

function speakNative(text) {
    if (!window.speechSynthesis) return;

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Optional: Select a better voice
    const voices = window.speechSynthesis.getVoices();
    // Try to find a nice English voice (e.g. Google US English, Microsoft Zira)
    const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Zira'));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
        updateUIState('ready');
    };

    utterance.onerror = () => {
        updateUIState('ready');
    };

    window.speechSynthesis.speak(utterance);
}
