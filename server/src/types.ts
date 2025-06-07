export interface Player {
  id: string;
  paddleY: number;
  score: number;
  ready: boolean;
}

export interface Ball {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export interface GameState {
  player1: Player;
  player2: Player;
  ball: Ball;
  gameStarted: boolean;
  gameEnded: boolean;
  winner?: string;
}

export interface GameRoom {
  id: string;
  players: Map<string, Player>;
  gameState: GameState;
  gameLoop?: NodeJS.Timeout;
}