const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend static files

// Initialize Gemini
// Note: We check for the key lazily or warn on startup
//const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');
const genAI = new GoogleGenerativeAI(
    // API Key is the first argument
    process.env.GEMINI_API_KEY || 'MISSING_KEY',

    // Configuration object is the second argument
    {
        httpOptions: {
            apiVersion: "v1" // <--- This sets the stable API version
        }
    }
);
// const genAI = new GoogleGenerativeAI({
//     apiKey: process.env.GEMINI_API_KEY,
//     httpOptions: {
//         apiVersion: "v1", // Explicitly set to stable
//     },
// });
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// System Instruction / Persona
const SYSTEM_PROMPT = `
You are Gemi, a friendly, helpful, and concise AI assistant built for voice conversation. 
Your responses must be short, conversational, and direct (ideally 1-3 sentences). 
You must maintain the context of the conversation and remember previous turns. 
Do not use complex jargon. 
If you do not know something, simply say, "That's a bit outside my current knowledge base." 
Always end your turn by prompting the user for the next thing they'd like to talk about, making the conversation feel natural and continuous.
`;

// Simple in-memory history management
// In a real app, you might use a DB or session IDs. 
// For this demo, we'll keep a global history that resets on server restart or via a 'reset' flag.
let chatHistory = [
    {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }]
    },
    {
        role: "model",
        parts: [{ text: "Understood. I am Gemi, ready to chat!" }]
    }
];

// Helper: Text to Speech via ElevenLabs
async function textToSpeech(text) {
    if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
        console.warn("Missing ElevenLabs keys. Returning null audio.");
        return null; // Handle smoothly in frontend if no audio
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const headers = {
        'Accept': 'audio/mpeg',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
    };

    const body = {
        text: text,
        model_id: "eleven_turbo_v2",
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
        }
    };

    try {
        const response = await axios.post(url, body, {
            headers,
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data).toString('base64');
    } catch (error) {
        const msg = error.response?.data ? error.response.data.toString() : error.message;
        console.error("ElevenLabs API Error:", msg);
        throw new Error("Failed to generate speech.");
    }
}

// Conversation Endpoint
app.post('/api/converse', async (req, res) => {
    try {
        const userText = req.body.text;
        const reset = req.body.reset;

        if (reset) {
            chatHistory = [
                { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                { role: "model", parts: [{ text: "Understood. I am Gemi, ready to chat!" }] }
            ];
            return res.json({ text: "Conversation reset.", audio: null });
        }

        if (!userText) {
            return res.status(400).json({ error: "Text input is required." });
        }

        // 1. Add User Input to History
        // Gemini Pro format: { role: 'user' | 'model', parts: [{ text: '...' }] }
        // Note: For 'gemini-pro', we pass the history to startChat usually, or manage it ourselves.
        // Let's use startChat for better context management if the SDK supports it well, 
        // but manually appending to an array gives us full control for this stateless-ish endpoint.
        // However, 'sendMessage' is the standard way.

        // Let's use the chat model provided by SDK
        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 200, // Keep it short
            },
        });

        // 2. Get LLM Response
        const result = await chat.sendMessage(userText);
        const response = await result.response;
        const aiText = response.text();

        // Update our local history store (The SDK's startChat history doesn't persist across requests if we re-instantiate, 
        // so we must save the new turns).
        chatHistory.push({ role: "user", parts: [{ text: userText }] });
        chatHistory.push({ role: "model", parts: [{ text: aiText }] });

        // 3. Convert to Speech
        let audioBase64 = null;
        try {
            audioBase64 = await textToSpeech(aiText);
        } catch (ttsErr) {
            console.error("TTS failed, returning text only.");
        }

        // 4. Return Response
        res.json({
            text: aiText,
            audio: audioBase64
        });

    } catch (error) {
        console.error("Error in /api/converse:", error);
        res.status(500).json({
            error: error.message || "Something went wrong.",
            details: error.stack
        });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Gemi Server running on http://localhost:${port}`);
    if (!process.env.GEMINI_API_KEY) console.warn("WARNING: GEMINI_API_KEY is not set in .env");
    if (!process.env.ELEVENLABS_API_KEY) console.warn("WARNING: ELEVENLABS_API_KEY is not set in .env");
});
