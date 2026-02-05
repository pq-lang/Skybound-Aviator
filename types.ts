
export enum GameStatus {
  IDLE = 'IDLE',
  WAITING = 'WAITING',
  FLYING = 'FLYING',
  CRASHED = 'CRASHED'
}

export interface User {
  username: string;
  balance: number;
}

export interface Bet {
  id: string;
  amount: number;
  multiplier?: number;
  cashedOut: boolean;
  playerName: string;
}

export interface GameHistory {
  id: string;
  multiplier: number;
  timestamp: number;
}

export interface AICommentary {
  text: string;
  type: 'neutral' | 'hype' | 'warning' | 'sad';
}
