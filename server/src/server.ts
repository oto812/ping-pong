import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import {
  GameRoom,
  Player,
  ClientToServerEvents,
  ServerToClientEvents,
  GAME_CONFIG,
} from "./types";
import { GameEngine } from "./game";

const app = express();
const httpServer = http.createServer(app);

app.use(cors());

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*", // In production, you'd want to restrict this
    methods: ["GET", "POST"],
  },
});

const PORT = 3000;
const gameRooms = new Map<string, GameRoom>();

function createRoom(roomId: string): GameRoom {
  return {
    id: roomId,
    players: new Map<string, Player>(),
    gameState: {
      player1: { id: "", paddleY: 0, score: 0, ready: false },
      player2: { id: "", paddleY: 0, score: 0, ready: false },
      ball: { x: 0, y: 0, velocityX: 0, velocityY: 0 },
      gameStarted: false,
      gameEnded: false,
    },
  };
}

function findAvailableRoom(): string {
  for (const [roomId, room] of gameRooms) {
    if (room.players.size === 1 && !room.gameState.gameStarted) {
      return roomId;
    }
  }
  const roomId = Math.random().toString(36).substr(2, 9);
  gameRooms.set(roomId, createRoom(roomId));
  return roomId;
}

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);
  let currentRoomId: string | null = null;

  // --- START OF THE CRITICAL LOGIC FIX ---
  const roomId = findAvailableRoom();
  const room = gameRooms.get(roomId)!;
  currentRoomId = roomId;

  // 1. Create the new player object
  const newPlayer: Player = {
    id: socket.id,
    paddleY: GAME_CONFIG.CANVAS_HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2,
    score: 0,
    ready: false,
  };

  // 2. Add the player to the room's player map and have their socket join the room
  room.players.set(socket.id, newPlayer);
  socket.join(roomId);
  
  // 3. Determine the player number *after* they have been added
  const playerNumber = room.players.size;
  socket.emit('playerJoined', socket.id, playerNumber);
  console.log(`Player ${socket.id} joined room ${roomId} as player ${playerNumber}`);

  // 4. NOW, check the number of players and act accordingly
  if (room.players.size === 2) {
    console.log(`Room ${roomId} is now full. Initializing game.`);
    room.gameEngine = new GameEngine(room);
    room.gameEngine.initializeGame();

    io.to(roomId).emit("roomReady");
    io.to(roomId).emit("gameStateUpdate", room.gameState);
  } else {
    socket.emit("waitingForPlayer");
  }
  // --- END OF THE CRITICAL LOGIC FIX ---

  socket.on("paddleMove", (y: number) => {
    const gameEngine = room.gameEngine;
    if (!gameEngine || !currentRoomId) return;
    gameEngine.updatePaddlePosition(socket.id, y);
    // The game loop will broadcast the state, no need to do it here.
  });

  socket.on("playerReady", () => {
    const gameEngine = room.gameEngine;
    if (!room || !gameEngine) return;

    const player = room.players.get(socket.id);
    if (player) {
      player.ready = true;
      console.log(`Player ${socket.id} is ready.`);

      // Also update the gameState so the client can see the opponent is ready
      const playerInGame = room.gameState.player1.id === socket.id ? room.gameState.player1 : room.gameState.player2;
      if(playerInGame) playerInGame.ready = true;
      io.to(roomId).emit("gameStateUpdate", room.gameState);


      if (gameEngine.canStartGame()) {
        console.log(`Both players ready. Starting game in room ${roomId}`);
        gameEngine.startGame();
        io.to(roomId).emit("gameStarted");

        room.gameLoop = setInterval(() => {
          const gameEnded = gameEngine!.updateGame();
          io.to(roomId).emit("gameStateUpdate", room.gameState);

          if (gameEnded) {
            clearInterval(room.gameLoop!);
            io.to(roomId).emit("gameEnded", room.gameState.winner!);
            setTimeout(() => gameRooms.delete(roomId), 10000);
          }
        }, 1000 / GAME_CONFIG.FRAME_RATE);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    if (currentRoomId) {
      const room = gameRooms.get(currentRoomId);
      if (room) {
        if (room.gameLoop) clearInterval(room.gameLoop);
        room.players.delete(socket.id);
        io.to(currentRoomId).emit("playerLeft", socket.id); // Use io.to instead of socket.to
        if (room.players.size < 2) {
            // If the game is over or not started, clean up the room.
            if (room.gameState.gameEnded || !room.gameState.gameStarted) {
                gameRooms.delete(currentRoomId);
                console.log(`Room ${currentRoomId} deleted.`);
            }
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});