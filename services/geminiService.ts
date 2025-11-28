import { GoogleGenAI } from "@google/genai";
import { FactionId, GameScenario, TurnResult } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_FLASH = 'gemini-2.5-flash';

// Helper to clean JSON string if Markdown code blocks are present
const cleanJson = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

/**
 * Step 1: Fetch Real-time News using Search Grounding
 */
export const fetchLiveContext = async (): Promise<{ summary: string; sources: { title: string; uri: string }[] }> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: "Find the latest news (last 7 days) regarding geopolitical tensions, military movements, and diplomatic statements between Taiwan, China, Japan, and the USA. Summarize the key 3 most critical events.",
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const summary = response.text || "No recent news found. Simulating standard tension.";
    
    // Extract sources
    const sources: { title: string; uri: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      });
    }

    return { summary, sources };
  } catch (error) {
    console.error("News fetch failed", error);
    return { 
      summary: "Communication breakdown. Intelligence systems offline. Relying on historical simulations.", 
      sources: [] 
    };
  }
};

/**
 * Step 2: Generate a Game Scenario based on the news
 */
export const generateScenario = async (
  newsSummary: string, 
  faction: FactionId,
  turn: number,
  tension: number
): Promise<GameScenario> => {
  // Logic to allow Nuclear option
  const allowNuclear = tension > 85;
  
  const prompt = `
    You are a game master for a high-stakes geopolitical thriller game called "Taiwan Emergency".
    The tone should be urgent, serious, and cinematic.
    
    Current Context:
    - Player Faction: ${faction}
    - Global Tension: ${tension}/100 (If > 90, war is imminent)
    - Turn: ${turn}
    - Input Data: ${newsSummary}

    Task:
    Generate a crisis scenario. 
    1. Create a "Breaking News" headline in 3 languages.
    2. Create 3 short "Live Ticker" updates (newsTicker) reflecting real-time events.
       Examples: "Nikkei Index drops 5%", "US Carrier Group Ronald Reagan entering South China Sea", "Protests erupt in Taipei".
       These should be atmospheric and provide "real-time" context.
    3. Create a Scenario Title and Description.
    4. Select a "visualTheme" from: 'WAR_ROOM', 'OCEAN', 'CYBER', 'DIPLOMACY', 'CHAOS'.
    5. Provide 3 standard choices (DIPLOMATIC, MILITARY, ECONOMIC).
    ${allowNuclear ? '6. CRITICAL: Tension is high. You MAY provide a 4th hidden choice with type "NUCLEAR" or "CLANDESTINE" that is extreme.' : ''}
    
    IMPORTANT for Japanese ("ja"):
    You MUST use HTML <ruby> tags for difficult Kanji. 
    Example: <ruby>台湾<rt>たいわん</rt></ruby><ruby>有事<rt>ゆうじ</rt></ruby>
    
    JSON Schema:
    {
      "newsHeadline": { "zh": "...", "en": "BREAKING: ...", "ja": "..." },
      "newsTicker": [
        { "zh": "...", "en": "...", "ja": "..." },
        { "zh": "...", "en": "...", "ja": "..." },
        { "zh": "...", "en": "...", "ja": "..." }
      ],
      "title": { "zh": "...", "en": "...", "ja": "..." },
      "description": { "zh": "...", "en": "...", "ja": "..." },
      "visualTheme": "WAR_ROOM",
      "choices": [
        { "id": "A", "text": { "zh": "...", "en": "...", "ja": "..." }, "type": "DIPLOMATIC" }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model: MODEL_FLASH,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    const data = JSON.parse(cleanJson(response.text || ""));
    return { ...data, newsSummary } as GameScenario;
  } catch (e) {
    console.error("Failed to parse scenario JSON", e);
    return {
      title: { zh: "系统错误", en: "System Error", ja: "システム<ruby>エラー<rt>error</rt></ruby>" },
      description: { zh: "无法生成场景。", en: "Could not generate scenario.", ja: "<ruby>生成<rt>せいせい</rt></ruby>できませんでした。" },
      newsHeadline: { zh: "连接丢失", en: "CONNECTION LOST", ja: "<ruby>接続<rt>せつぞく</rt></ruby>が<ruby>切<rt>き</rt></ruby>れました" },
      newsTicker: [],
      choices: [],
      visualTheme: 'CYBER',
      newsSummary: "Data corrupted."
    };
  }
};

/**
 * Step 3: Resolve the Action
 */
export const resolveTurnAction = async (
  scenario: GameScenario,
  choiceId: string,
  currentStats: { tension: number; economy: number; support: number }
): Promise<TurnResult> => {
  const choice = scenario.choices.find(c => c.id === choiceId);
  const prompt = `
    Resolve this game turn for "Taiwan Emergency".
    
    Scenario: ${scenario.description.en}
    Player Choice: ${choice?.text.en} (${choice?.type})
    Current Stats: Tension ${currentStats.tension}, Economy ${currentStats.economy}, Support ${currentStats.support}.

    Task:
    Determine the outcome.
    - If type is NUCLEAR, Tension becomes 100 instantly, Economy drops to 0.
    - If choice is aggressive, increase Tension.
    - Include random events (e.g., "Market crash", "Typhoon", "Spy scandal") in the description to add flavor.
    
    Output JSON:
    {
      "outcomeTitle": { "zh": "...", "en": "...", "ja": "..." },
      "outcomeDescription": { "zh": "...", "en": "...", "ja": "..." },
      "statsEffect": {
        "tension": number (change, e.g. +10 or -5),
        "economy": number,
        "support": number
      }
    }
    Again, use <ruby> tags for Japanese Kanji.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_FLASH,
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  const data = JSON.parse(cleanJson(response.text || "{}"));
  
  return data as TurnResult;
};