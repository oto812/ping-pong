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

export const GAME_CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 400,
  PADDLE_WIDTH: 10,
  PADDLE_HEIGHT: 80,
  BALL_SIZE: 10,
  PADDLE_SPEED: 5,
  BALL_SPEED: 3,
  WINNING_SCORE: 5,
  FRAME_RATE: 60
} as const;

export interface ServerToClientEvents {
  gameStateUpdate: (gameState: GameState) => void;
  playerJoined: (playerId: string, playerNumber: number) => void;
  playerLeft: (playerId: string) => void;
  gameStarted: () => void;
  gameEnded: (winner: string) => void;
  roomFull: () => void;
  waitingForPlayer: () => void;
}

export interface ClientToServerEvents {
  joinRoom: (roomId: string) => void;
  paddleMove: (y: number) => void;
  playerReady: () => void;
}