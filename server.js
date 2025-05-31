// server.js for Render (Updated Model and Temperature)
require('dotenv').config(); 
const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; // Render sets the PORT environment variable

// Middleware
app.use(cors()); 
app.use(express.json()); 

// Google AI Setup
const apiKey = process.env.GOOGLE_API_KEY; // This will come from Render's environment variables
let genAI;
let model;

if (apiKey) {
    try {
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({
            // MODIFIED: Changed model ID
            // IMPORTANT: Verify "gemini-2.0-flash" is the correct, official model ID from Google.
            // It might be something like "gemini-2.0-flash-001" or "gemini-2.0-flash-latest".
            model: "gemini-2.0-flash", 
        });
        console.log("Google AI SDK Initialized successfully (attempting to use gemini-2.0-flash).");
    } catch (e) {
        console.error("Error initializing Google AI SDK:", e.message);
    }
} else {
    console.error("CRITICAL ERROR: GOOGLE_API_KEY is not set in environment. AI features will not work.");
}

// MODIFIED: Temperature changed to 0.1
const generationConfig = {
    temperature: 0.1, 
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain"
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
];

// API endpoint for AskDeck
app.post('/api/askdeck', async (req, res) => {
    if (!model) {
        console.error("/api/askdeck called, but AI model is not initialized.");
        return res.status(500).json({ error: 'AI service is not configured correctly on the server. Check model ID and API key.' });
    }
    try {
        const { message, context } = req.body;
        if (!message || !context) {
            return res.status(400).json({ error: 'Message and context are required.' });
        }
        const fullPrompt = `${context}\n\n---\n\nUser Question: ${message}\n\nAskDeck Response:`;
        const chatSession = model.startChat({ generationConfig, safetySettings, history: [] });
        const result = await chatSession.sendMessage(fullPrompt);
        
        if (result.response && result.response.candidates && result.response.candidates.length > 0 && result.response.candidates[0].content && result.response.candidates[0].content.parts && result.response.candidates[0].content.parts.length > 0) {
            res.json({ reply: result.response.candidates[0].content.parts[0].text });
        } else {
            let errorMsg = "AI did not provide a valid response.";
            if (result.response?.promptFeedback?.blockReason) {
                errorMsg = `Response blocked: ${result.response.promptFeedback.blockReason}`;
                console.warn("AI response blocked. Reason:", result.response.promptFeedback.blockReason, result.response.promptFeedback);
            } else {
                console.error("No valid candidate response from AI:", result.response);
            }
            res.status(500).json({ error: errorMsg });
        }
    } catch (error) {
        console.error('Error in /api/askdeck endpoint:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to get response from AI: ' + error.message });
    }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "AskDeck API backend is running on Render." });
});

app.listen(PORT, () => {
    console.log(`AskDeck API backend is listening on port ${PORT}`);
    if (!apiKey) console.log("WARNING: GOOGLE_API_KEY is missing.");
    else if (!model) console.log("WARNING: Google AI Model could not be initialized. Verify the model ID in server.js and API key permissions.");
    else console.log("Backend ready.");
});