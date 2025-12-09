# Gemi Voice Assistant

Gemi is a real-time, bidirectional voice conversational agent. It uses:
- **Google Gemini** for intelligence and conversation.
- **ElevenLabs** for realistic text-to-speech.
- **Web Speech API** for speech recognition.

## Prerequisites

- Node.js installed.
- API Keys for Google Gemini (Google Generative AI) and ElevenLabs.

## Setup

1.  **Install Dependencies** (if not already done):
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root directory:
    ```ini
    GEMINI_API_KEY=your_gemini_key
    ELEVENLABS_API_KEY=your_elevenlabs_key
    ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM 
    # ^ "Rachel" voice ID. Change if desired.
    ```

3.  **Run**:
    ```bash
    npm start
    ```

4.  **Use**:
    Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge (browsers with good Web Speech API support).

## Project Structure

- `server.js`: Main backend logic.
- `public/`: Frontend assets (HTML, CSS, JS).
