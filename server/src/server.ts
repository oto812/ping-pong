import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameRoom, Player, ClientToServerEvents, ServerToClientEvents, GAME_CONFIG } from './types';
import { GameEngine } from './game';




const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.static('public'));

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

const gameRooms = new Map<string, GameRoom>();

// Helper function to create a new room
function createRoom(roomId: string): GameRoom {
  return {
    id: roomId,
    players: new Map<string, Player>(),
    gameState: {
      player1: { id: '', paddleY: 0, score: 0, ready: false },
      player2: { id: '', paddleY: 0, score: 0, ready: false },
      ball: { x: 0, y: 0, velocityX: 0, velocityY: 0 },
      gameStarted: false,
      gameEnded: false
    }
  };
}

// Helper function to find or create room
function findAvailableRoom(): string {
  // Find existing room with one player
  for (const [roomId, room] of gameRooms) {
    if (room.players.size === 1 && !room.gameState.gameStarted) {
      return roomId;
    }
  }
  
  // Create new room
  const roomId = Math.random().toString(36).substr(2, 9);
  gameRooms.set(roomId, createRoom(roomId));
  return roomId;
}

// Main socket connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  let currentRoomId: string | null = null;
  let gameEngine: GameEngine | null = null;

  // Auto-join available room
  const roomId = findAvailableRoom();
  const room = gameRooms.get(roomId)!;
  currentRoomId = roomId;
  
  // Create new player
  const newPlayer: Player = {
    id: socket.id,
    paddleY: GAME_CONFIG.CANVAS_HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2,
    score: 0,
    ready: false
  };
  
  room.players.set(socket.id, newPlayer);
  socket.join(roomId);
  
  const playerNumber = room.players.size;
  socket.emit('playerJoined', socket.id, playerNumber);
  
  if (room.players.size === 2) {
    // Room is full, initialize game
    gameEngine = new GameEngine(room);
    gameEngine.initializeGame();
    
    io.to(roomId).emit('gameStateUpdate', room.gameState);
  } else {
    socket.emit('waitingForPlayer');
  }

  // Handle paddle movement
  socket.on('paddleMove', (y: number) => {
    if (!gameEngine || !currentRoomId) return;
    
    gameEngine.updatePaddlePosition(socket.id, y);
    io.to(currentRoomId).emit('gameStateUpdate', room.gameState);
  });

  // Handle player ready
  socket.on('playerReady', () => {
    if (!room || !gameEngine) return;
    
    const player = room.players.get(socket.id);
    if (player) {
      player.ready = true;
      
      if (gameEngine.canStartGame()) {
        gameEngine.startGame();
        io.to(roomId).emit('gameStarted');
        
        // Start game loop
        const gameLoop = setInterval(() => {
          const gameEnded = gameEngine!.updateGame();
          io.to(roomId).emit('gameStateUpdate', room.gameState);
          
          if (gameEnded) {
            clearInterval(gameLoop);
            io.to(roomId).emit('gameEnded', room.gameState.winner!);
            
            // Clean up room after game ends
            setTimeout(() => {
              gameRooms.delete(roomId);
            }, 10000); // Give players 10 seconds to see results
          }
        }, 1000 / GAME_CONFIG.FRAME_RATE);
        
        room.gameLoop = gameLoop;
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    if (currentRoomId) {
      const room = gameRooms.get(currentRoomId);
      if (room) {
        room.players.delete(socket.id);
        socket.to(currentRoomId).emit('playerLeft', socket.id);
        
        // Clean up room if empty or game was in progress
        if (room.players.size === 0 || room.gameState.gameStarted) {
          if (room.gameLoop) {
            clearInterval(room.gameLoop);
          }
          gameRooms.delete(currentRoomId);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game rooms: ${gameRooms.size}`);
});

// Cleanup empty rooms periodically
setInterval(() => {
  for (const [roomId, room] of gameRooms) {
    if (room.players.size === 0) {
      if (room.gameLoop) {
        clearInterval(room.gameLoop);
      }
      gameRooms.delete(roomId);
    }
  }
}, 30000); // Check every 30 seconds