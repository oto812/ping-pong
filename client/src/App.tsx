import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';


// Connect to the server.
// IMPORTANT: The URL must match the server's address and port.
const socket = io('http://localhost:3000');

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    // Listener for connection event
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server!');
    });

    // Listener for disconnection event
    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server!');
    });

    // Clean up the event listeners when the component unmounts
    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  return (
    <div className="App">
      <h1>Multiplayer Pong</h1>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
    </div>
  );
}

export default App;