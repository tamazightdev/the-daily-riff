import { GoogleGenAI, Tool } from "@google/genai";
import { GeminiModel, BlogPost, GroundingChunk } from "../types";
import { GODIN_STYLE_PROMPT } from "../constants";

interface GenerateResponse {
  posts: BlogPost[];
  sources: string[];
}

export const generateBlogPosts = async (
  apiKey: string,
  model: GeminiModel,
  topic: string
): Promise<GenerateResponse> => {
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

  // Setup tools for Search Grounding
  const tools: Tool[] = [
    {
      googleSearch: {},
    },
  ];

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${GODIN_STYLE_PROMPT}\n\nTOPIC: ${topic}`,
            },
          ],
        },
      ],
      config: {
        tools: tools,
        temperature: 0.7, // A bit of creativity, but not too chaotic
        // Note: We cannot use responseMimeType: "application/json" or responseSchema when using googleSearch tool.
        // We must rely on the prompt to enforce JSON structure and then parse it manually.
      },
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("No content generated from Gemini.");
    }

    // Extract Sources from Grounding Metadata
    const sources: string[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
    
    if (groundingChunks) {
      groundingChunks.forEach((chunk) => {
        if (chunk.web?.uri) {
          sources.push(chunk.web.uri);
        }
      });
    }

    // Clean up the response text to ensure it's valid JSON
    // sometimes models wrap in ```json ... ```
    let cleanJson = textResponse.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.replace(/^```json/, "").replace(/```$/, "");
    } else if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```/, "").replace(/```$/, "");
    }

    let parsedPosts: BlogPost[];
    try {
      parsedPosts = JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON Parse Error", e);
      console.log("Raw Text:", textResponse);
      throw new Error("Failed to parse the generated content. Please try again.");
    }

    // Deduplicate sources
    const uniqueSources = Array.from(new Set(sources));

    return {
      posts: parsedPosts,
      sources: uniqueSources
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let message = "An error occurred while communicating with Gemini.";
    if (error.message && error.message.includes("API key")) {
      message = "Invalid API Key provided.";
    }
    throw new Error(message);
  }
};
