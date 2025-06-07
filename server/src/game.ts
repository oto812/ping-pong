import { GameRoom, GameState, Ball, Player, GAME_CONFIG } from './types';

export class GameEngine {
  private room: GameRoom;

  constructor(room: GameRoom) {
    this.room = room;
  }

  initializeGame(): void {
    const players = Array.from(this.room.players.values());
    
    this.room.gameState = {
      player1: {
        id: players[0].id,
        paddleY: GAME_CONFIG.CANVAS_HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2,
        score: 0,
        ready: players[0].ready
      },
      player2: {
        id: players[1].id,
        paddleY: GAME_CONFIG.CANVAS_HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2,
        score: 0,
        ready: players[1].ready
      },
      ball: this.resetBall(),
      gameStarted: false,
      gameEnded: false
    };
  }

  private resetBall(): Ball {
    return {
      x: GAME_CONFIG.CANVAS_WIDTH / 2,
      y: GAME_CONFIG.CANVAS_HEIGHT / 2,
      velocityX: Math.random() > 0.5 ? GAME_CONFIG.BALL_SPEED : -GAME_CONFIG.BALL_SPEED,
      velocityY: (Math.random() - 0.5) * GAME_CONFIG.BALL_SPEED
    };
  }

  updatePaddlePosition(playerId: string, y: number): void {
    const clampedY = Math.max(0, Math.min(y, GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.PADDLE_HEIGHT));
    
    if (this.room.gameState.player1.id === playerId) {
      this.room.gameState.player1.paddleY = clampedY;
    } else if (this.room.gameState.player2.id === playerId) {
      this.room.gameState.player2.paddleY = clampedY;
    }
  }

  updateGame(): boolean {
    if (!this.room.gameState.gameStarted || this.room.gameState.gameEnded) {
      return false;
    }

    this.updateBall();
    return this.checkWinCondition();
  }

  private updateBall(): void {
    const ball = this.room.gameState.ball;
    
    // Update ball position
    ball.x += ball.velocityX;
    ball.y += ball.velocityY;

    // Ball collision with top and bottom walls
    if (ball.y <= 0 || ball.y >= GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.BALL_SIZE) {
      ball.velocityY = -ball.velocityY;
      ball.y = Math.max(0, Math.min(ball.y, GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.BALL_SIZE));
    }

    // Ball collision with paddles
    this.checkPaddleCollision();

    // Ball goes out of bounds (scoring)
    if (ball.x <= 0) {
      this.room.gameState.player2.score++;
      this.room.gameState.ball = this.resetBall();
    } else if (ball.x >= GAME_CONFIG.CANVAS_WIDTH) {
      this.room.gameState.player1.score++;
      this.room.gameState.ball = this.resetBall();
    }
  }

  private checkPaddleCollision(): void {
    const ball = this.room.gameState.ball;
    const player1 = this.room.gameState.player1;
    const player2 = this.room.gameState.player2;

    // Left paddle (Player 1)
    if (ball.x <= GAME_CONFIG.PADDLE_WIDTH && 
        ball.y >= player1.paddleY && 
        ball.y <= player1.paddleY + GAME_CONFIG.PADDLE_HEIGHT &&
        ball.velocityX < 0) {
      ball.velocityX = -ball.velocityX;
      ball.x = GAME_CONFIG.PADDLE_WIDTH;
      
      // Add spin based on where ball hits paddle
      const paddleCenter = player1.paddleY + GAME_CONFIG.PADDLE_HEIGHT / 2;
      const hitPosition = (ball.y - paddleCenter) / (GAME_CONFIG.PADDLE_HEIGHT / 2);
      ball.velocityY = hitPosition * GAME_CONFIG.BALL_SPEED;
    }

    // Right paddle (Player 2)
    if (ball.x >= GAME_CONFIG.CANVAS_WIDTH - GAME_CONFIG.PADDLE_WIDTH - GAME_CONFIG.BALL_SIZE && 
        ball.y >= player2.paddleY && 
        ball.y <= player2.paddleY + GAME_CONFIG.PADDLE_HEIGHT &&
        ball.velocityX > 0) {
      ball.velocityX = -ball.velocityX;
      ball.x = GAME_CONFIG.CANVAS_WIDTH - GAME_CONFIG.PADDLE_WIDTH - GAME_CONFIG.BALL_SIZE;
      
      // Add spin based on where ball hits paddle
      const paddleCenter = player2.paddleY + GAME_CONFIG.PADDLE_HEIGHT / 2;
      const hitPosition = (ball.y - paddleCenter) / (GAME_CONFIG.PADDLE_HEIGHT / 2);
      ball.velocityY = hitPosition * GAME_CONFIG.BALL_SPEED;
    }
  }

  private checkWinCondition(): boolean {
    const { player1, player2 } = this.room.gameState;
    
    if (player1.score >= GAME_CONFIG.WINNING_SCORE) {
      this.room.gameState.gameEnded = true;
      this.room.gameState.winner = player1.id;
      return true;
    } else if (player2.score >= GAME_CONFIG.WINNING_SCORE) {
      this.room.gameState.gameEnded = true;
      this.room.gameState.winner = player2.id;
      return true;
    }
    
    return false;
  }

  startGame(): void {
    this.room.gameState.gameStarted = true;
  }

  canStartGame(): boolean {
    const players = Array.from(this.room.players.values());
    return players.length === 2 && players.every(player => player.ready);
  }
}