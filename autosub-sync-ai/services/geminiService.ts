import { GoogleGenAI } from "@google/genai";

// Initialize the API client
// Note: We create a new instance per call in the component to ensure we catch the latest API key if it changes,
// but for the service helper, we'll accept the key or defaults.
// However, per strict instructions, we use process.env.API_KEY directly.

export const generateSrtFromVideo = async (
  videoBase64: string,
  mimeType: string,
  transcript: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is available.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prompt engineering for forced alignment
  const prompt = `
    You are an expert video subtitle synchronizer.
    
    Task:
    1. Analyze the audio in the provided video file.
    2. Synchronize the provided TRANSCRIPT text with the audio.
    3. Generate a standard SRT (SubRip Subtitle) file.
    
    Rules:
    - Output ONLY the SRT content. Do not output markdown code blocks (like \`\`\`), do not output explanations.
    - Ensure the timestamps are accurate to the spoken words.
    - If the transcript is in a different language than the audio, try to map them, but primarily listen to the audio for timing. 
    - Break lines naturally for readability.
    - If the video is silent or speech cannot be detected, return an empty SRT block or a specific error message "ERROR: No speech detected".

    TRANSCRIPT:
    ${transcript}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: videoBase64
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        temperature: 0.2, // Low temperature for more deterministic/accurate timing
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    // Clean up potential markdown formatting if the model disobeys slightly
    const cleanedText = text.replace(/^```srt\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
    
    return cleanedText;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate subtitles.");
  }
};