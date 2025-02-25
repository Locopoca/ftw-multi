const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

const players = {};
const platforms = [];
let basePlatformSpacing = 120; // Fixed spacing
let highestFloor = 15;
const MAX_PLAYERS = 8;

function generatePlatforms(upToFloor) {
  while (platforms.length < upToFloor) {
    const floor = platforms.length;
    const difficultyTier = Math.min(Math.floor(floor / 20), 5);
    const spacing = basePlatformSpacing; // No tier increase—fixed 120px
    const speedMin = 50 + difficultyTier * 25;
    const speedMax = 150 + difficultyTier * 25;

    let x, width, movementType, speed;
    if (floor % 20 === 0) {
      x = 400;
      width = 800;
      movementType = 'none';
      speed = 0;
    } else if (floor % 10 === 0) {
      x = Math.floor(Math.random() * (700 - 50 + 1)) + 50; // Wider range
      width = 200;
      movementType = 'none';
      speed = 0;
    } else {
      x = 100;
      width = 200;
      movementType = 'horizontal';
      speed = Math.random() * (speedMax - speedMin) + speedMin;
    }
    platforms.push({
      x: x,
      y: 600 - floor * spacing,
      width: width,
      movementType: movementType,
      speed: speed,
      baseX: x,
      baseY: 600 - floor * spacing,
      isBonus: floor % 10 === 0,
    });
  }
}

generatePlatforms(highestFloor);

io.on('connection', (socket) => {
  if (Object.keys(players).length >= MAX_PLAYERS) {
    socket.emit('serverFull', 'Server limit reached (8 players). Try again later!');
    socket.disconnect(true);
    return;
  }

  console.log('A user connected:', socket.id);

  players[socket.id] = {
    x: 400,
    y: 550,
    score: 0,
  };

  socket.emit('currentPlayers', players);
  socket.emit('mapData', platforms);

  socket.broadcast.emit('newPlayer', { id: socket.id, x: players[socket.id].x, y: players[socket.id].y });

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].score = movementData.score || 0;
      socket.broadcast.emit('playerMoved', { id: socket.id, x: movementData.x, y: movementData.y, score: movementData.score });

      const playerFloor = Math.floor((600 - movementData.y) / basePlatformSpacing);
      if (playerFloor > highestFloor - 5) {
        highestFloor = playerFloor + 5; // Align with player progress
        generatePlatforms(highestFloor);
        io.emit('mapUpdate', platforms.slice(-5));
      }

      const difficultyTier = Math.min(Math.floor(movementData.score / 20), 5);
      io.emit('difficultyUpdate', { tier: difficultyTier });
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

setInterval(() => {
  platforms.forEach((platform) => {
    if (platform.movementType === 'horizontal') {
      platform.x += platform.speed * (1 / 30);
      if (platform.x > 700) platform.speed = -platform.speed;
      if (platform.x < 100) platform.speed = -platform.speed;
    }
  });
  io.emit('mapUpdate', platforms);
}, 1000 / 30);

const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});