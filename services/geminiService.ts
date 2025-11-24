import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Helper to prevent infinite hangs
const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ]);
};

// Retry helper
async function retry<T>(
  fn: () => Promise<T>, 
  retries: number = 3, 
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2); // Exponential backoff
  }
}

const TIMEOUT_MS = 60000; // Increased to 60 seconds

export const generateTimerAnnouncement = async (taskName: string, durationSeconds: number): Promise<string> => {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  
  let timeString = '';
  if (minutes > 0) timeString += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  if (minutes > 0 && seconds > 0) timeString += ' and ';
  if (seconds > 0) timeString += `${seconds} second${seconds !== 1 ? 's' : ''}`;
  if (timeString === '') timeString = '0 seconds';

  const prompt = `Say enthusiastically and clearly: "Begin ${taskName} for ${timeString}."`;

  const apiCall = async () => {
    const generatePromise = ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const response = await withTimeout<GenerateContentResponse>(generatePromise, TIMEOUT_MS, "Audio generation timed out");

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data received from Gemini");
    }

    return base64Audio;
  };

  try {
    return await retry(apiCall);
  } catch (error) {
    console.error("Error generating speech after retries:", error);
    throw error;
  }
};

export const generateCompletionAnnouncement = async (): Promise<string> => {
  const prompt = `Say cheerfully and encouragingly: "All done! You have completed your sequence."`;

  const apiCall = async () => {
    const generatePromise = ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const response = await withTimeout<GenerateContentResponse>(generatePromise, TIMEOUT_MS, "Completion audio timed out");

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data");
    return base64Audio;
  };

  try {
    return await retry(apiCall);
  } catch (error) {
    console.error("Error generating completion speech after retries:", error);
    throw error;
  }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  const prompt = "Transcribe the following audio into a short, concise task name. Return ONLY the text of the task name, no punctuation.";
  
  const apiCall = async () => {
    const generatePromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          { text: prompt }
        ]
      }
    });

    const response = await withTimeout<GenerateContentResponse>(generatePromise, 15000, "Transcription timed out");
    return response.text?.trim() || "";
  };

  try {
    return await retry(apiCall, 2, 500);
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
};