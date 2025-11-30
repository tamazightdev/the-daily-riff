export enum GeminiModel {
  PRO = 'gemini-2.5-pro',
  FLASH = 'gemini-flash-latest',
  GEMINI_3_PRO = 'gemini-3-pro-preview'
}

export interface BlogPost {
  title: string;
  content: string; // HTML or Markdown string
  searchAttribution?: string[];
}

export interface SavedPost extends BlogPost {
  id: string;
  createdAt: number;
}

export interface AppState {
  apiKey: string;
  googleClientId: string;
  model: GeminiModel;
  hasKey: boolean;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}