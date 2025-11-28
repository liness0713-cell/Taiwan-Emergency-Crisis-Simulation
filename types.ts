export enum FactionId {
  TW = 'TW',
  JP = 'JP',
  CN = 'CN',
  US = 'US'
}

export interface TrilingualText {
  zh: string;
  en: string;
  ja: string; // Contains HTML <ruby> tags
}

export interface Choice {
  id: string;
  text: TrilingualText;
  type: 'DIPLOMATIC' | 'MILITARY' | 'ECONOMIC' | 'NUCLEAR' | 'CLANDESTINE';
}

export interface GameScenario {
  title: TrilingualText;
  description: TrilingualText;
  newsHeadline: TrilingualText; // New: Trilingual breaking news
  choices: Choice[];
  visualTheme: 'WAR_ROOM' | 'OCEAN' | 'CYBER' | 'DIPLOMACY' | 'CHAOS'; // For background rendering
  newsSummary?: string; // Internal context
}

export interface TurnResult {
  outcomeTitle: TrilingualText;
  outcomeDescription: TrilingualText;
  statsEffect: {
    tension: number;
    economy: number;
    support: number;
  };
  sources?: { title: string; uri: string }[];
}

export interface GameState {
  turn: number;
  tension: number; // 0-100
  economy: number; // 0-100
  support: number; // 0-100
  history: TurnResult[];
  currentScenario: GameScenario | null;
  selectedFaction: FactionId | null;
  isGameOver: boolean;
  gameStatus: 'IDLE' | 'LOADING' | 'PLAYING' | 'RESOLVING' | 'GAME_OVER';
  sources: { title: string; uri: string }[];
}