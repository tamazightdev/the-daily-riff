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

    let parsedPosts: BlogPost[] = [];

    // Robust JSON extraction logic
    try {
      // 1. Try to find the JSON array bracket pair first (handles conversational prefixes/suffixes)
      const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedPosts = JSON.parse(jsonMatch[0]);
      } else {
        // 2. Fallback: Try cleaning markdown code blocks if the regex failed to find brackets
        let cleanJson = textResponse.trim();
        // Remove markdown code blocks if present
        cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
        parsedPosts = JSON.parse(cleanJson);
      }
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
    } else if (error.message && error.message.includes("Failed to parse")) {
      message = "The model generated an invalid format. Please try again.";
    }
    throw new Error(message);
  }
};