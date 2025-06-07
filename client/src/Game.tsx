import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { type GameState, type ServerToClientEvents, type ClientToServerEvents, GAME_CONFIG } from './types';

const SERVER_URL = 'http://localhost:3000';

const Game: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const playerIdRef = useRef<string>('');
  const keysPressedRef = useRef<Set<string>>(new Set());
  const animationFrameIdRef = useRef<number>(0);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerNumber, setPlayerNumber] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => setConnectionStatus('Connected.'));
    socket.on('disconnect', () => {
      setConnectionStatus('Disconnected');
      setGameState(null);
    });
    socket.on('playerJoined', (id, number) => {
      playerIdRef.current = id;
      setPlayerNumber(number);
    });
    socket.on('waitingForPlayer', () => setConnectionStatus('Waiting for an opponent...'));
    socket.on('roomReady', () => setConnectionStatus('Opponent found! Get ready!'));
    socket.on('gameStateUpdate', setGameState);
    socket.on('gameStarted', () => setConnectionStatus('Game Started!'));
    socket.on('gameEnded', (winnerId) => {
      const isWinner = winnerId === playerIdRef.current;
      setConnectionStatus(isWinner ? 'You Won!' : 'You Lost!');
    });
    socket.on('playerLeft', () => {
      setConnectionStatus('Opponent disconnected. Game over.');
      setGameState(null);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysPressedRef.current.add(e.key.toLowerCase());
    const handleKeyUp = (e: KeyboardEvent) => keysPressedRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const gameLoop = () => {
      if (socketRef.current && gameState && playerNumber && gameState.gameStarted) {
        const player = playerNumber === 1 ? gameState.player1 : gameState.player2;
        let newY = player.paddleY;
        const keys = keysPressedRef.current;

        if (keys.has('arrowup') || keys.has('w')) newY -= GAME_CONFIG.PADDLE_SPEED;
        if (keys.has('arrowdown') || keys.has('s')) newY += GAME_CONFIG.PADDLE_SPEED;
        
        const clampedY = Math.max(0, Math.min(newY, GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.PADDLE_HEIGHT));
        if (clampedY !== player.paddleY) {
            socketRef.current.emit('paddleMove', clampedY);
        }
      }
      animationFrameIdRef.current = requestAnimationFrame(gameLoop);
    };
    animationFrameIdRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameIdRef.current);
  }, [gameState, playerNumber]);

  useEffect(() => {
    if (!gameState || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(GAME_CONFIG.CANVAS_WIDTH / 2, 0);
    ctx.lineTo(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, gameState.player1.paddleY, GAME_CONFIG.PADDLE_WIDTH, GAME_CONFIG.PADDLE_HEIGHT);
    ctx.fillRect(GAME_CONFIG.CANVAS_WIDTH - GAME_CONFIG.PADDLE_WIDTH, gameState.player2.paddleY, GAME_CONFIG.PADDLE_WIDTH, GAME_CONFIG.PADDLE_HEIGHT);
    if(gameState.gameStarted) {
      ctx.fillRect(gameState.ball.x, gameState.ball.y, GAME_CONFIG.BALL_SIZE, GAME_CONFIG.BALL_SIZE);
    }
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(gameState.player1.score.toString(), GAME_CONFIG.CANVAS_WIDTH / 4, 60);
    ctx.fillText(gameState.player2.score.toString(), (GAME_CONFIG.CANVAS_WIDTH * 3) / 4, 60);
  }, [gameState]);

  const handleReady = useCallback(() => {
    if (socketRef.current && !isReady) {
      socketRef.current.emit('playerReady');
      setIsReady(true);
    }
  }, [isReady]);
  
  const getReadyButton = () => {
    if (!gameState || gameState.gameStarted) return null;

    if (isReady) {
      return <p>Waiting for opponent...</p>;
    }

    return (
      <button onClick={handleReady} style={{ marginTop: '20px', padding: '15px 30px', fontSize: '18px', cursor: 'pointer' }}>
        Ready to Play!
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#222', color: '#fff', minHeight: '100vh', fontFamily: 'Arial' }}>
      <h1>Multiplayer Pong</h1>
      <div style={{ margin: '20px', padding: '10px', backgroundColor: '#333', borderRadius: '5px' }}>
        Status: {connectionStatus}
      </div>
      {playerNumber > 0 && <p>You are Player {playerNumber}</p>}
      <canvas
        ref={canvasRef}
        width={GAME_CONFIG.CANVAS_WIDTH}
        height={GAME_CONFIG.CANVAS_HEIGHT}
        style={{ border: '2px solid #fff', backgroundColor: '#000' }}
      />
      {getReadyButton()}
    </div>
  );
};

export default Game;