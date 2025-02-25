const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

const players = {};
const platforms = [];
const PLATFORM_SPACING = 120;
let highestFloor = 15;

function generatePlatforms(upToFloor) {
  while (platforms.length < upToFloor) {
    const floor = platforms.length;
    let x, width, movementType, speed;
    if (floor % 20 === 0) {
      x = 400; // Full-width static
      width = 800;
      movementType = 'none';
      speed = 0;
    } else if (floor % 10 === 0) { // Bonus platform
      x = Math.floor(Math.random() * (600 - 100 + 1)) + 100;
      width = 200;
      movementType = 'none';
      speed = 0;
    } else {
      x = 100; // Start at left edge
      width = 200;
      movementType = 'horizontal'; // All move across screen
      speed = Math.random() * 100 + 50; // 50-150px/s
    }
    platforms.push({
      x: x,
      y: 600 - floor * PLATFORM_SPACING,
      width: width,
      movementType: movementType,
      speed: speed,
      baseX: x,
      baseY: 600 - floor * PLATFORM_SPACING,
      isBonus: floor % 10 === 0,
    });
  }
}

generatePlatforms(highestFloor);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  players[socket.id] = {
    x: 400,
    y: 568,
    score: 0, // Track score per player
  };

  socket.emit('currentPlayers', players);
  socket.emit('mapData', platforms);

  socket.broadcast.emit('newPlayer', { id: socket.id, x: players[socket.id].x, y: players[socket.id].y });

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].score = movementData.score || 0; // Update score
      socket.broadcast.emit('playerMoved', { id: socket.id, x: movementData.x, y: movementData.y, score: movementData.score });

      const playerFloor = Math.floor((600 - movementData.y) / PLATFORM_SPACING);
      if (playerFloor > highestFloor - 5) {
        highestFloor += 5;
        generatePlatforms(highestFloor);
        io.emit('mapUpdate', platforms.slice(-5));
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Update moving platforms
setInterval(() => {
  platforms.forEach((platform) => {
    if (platform.movementType === 'horizontal') {
      platform.x += platform.speed * (1 / 30); // Move based on speed
      if (platform.x > 700) platform.speed = -platform.speed; // Reverse at right edge (800 - 200/2)
      if (platform.x < 100) platform.speed = -platform.speed; // Reverse at left edge
    }
  });
  io.emit('mapUpdate', platforms);
}, 1000 / 30); // 30 FPS

const PORT = process.env.PORT || 8081;

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});