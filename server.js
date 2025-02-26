const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.use(express.static('public'));

const players = {};
const platforms = [];
let basePlatformSpacing = 120;
let highestFloor = 15;
const MAX_PLAYERS = 8;

function generatePlatforms(upToFloor) {
    while (platforms.length < upToFloor) {
      const floor = platforms.length;
      const difficultyTier = Math.min(Math.floor(floor / 20), 4);
      const spacing = basePlatformSpacing + difficultyTier * 5;
      const speedMin = 50 + difficultyTier * 50;
      const speedMax = 300 + difficultyTier * 50;
      const bonusInterval = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
  
      let x, width, height, movementType, speed, isStatic;
      const isNarrow = Math.random() < 0.1;
      width = isNarrow ? 50 : Math.floor(Math.random() * (300 - 100 + 1)) + 100;
      height = Math.floor(Math.random() * (36 - 28 + 1)) + 28;
      x = Math.floor(Math.random() * (750 - 50 + 1)) + 50;
  
      let isBonus, isSpecialBonus;
      if (floor === 0) { // Guarantee bonus at floor 0
        x = 400; // Center for visibility
        width = 200;
        height = 32;
        movementType = 'none';
        speed = 0;
        isStatic = true;
        isBonus = true;
        isSpecialBonus = Math.random() < 0.2; // 20% chance for special bonus
      } else if (floor % 20 === 0) {
        x = 400;
        width = 800;
        height = 32;
        movementType = 'none';
        speed = 0;
        isStatic = true;
        isBonus = false;
        isSpecialBonus = false;
      } else {
        isBonus = floor % bonusInterval === 0 || (floor > 5 && Math.random() < 0.1 && platforms.length > 5 && platforms[platforms.length - 5].isBonus); // Increased chance to 10%
        isSpecialBonus = isBonus && Math.random() < 0.2;
        movementType = 'horizontal';
        speed = Math.random() * (speedMax - speedMin) + speedMin;
        isStatic = false;
        if (isNarrow) width = 50;
      }
      platforms.push({
        x: x,
        y: 600 - floor * spacing,
        width: width,
        height: height,
        movementType: movementType,
        speed: speed,
        baseX: x,
        baseY: 600 - floor * spacing,
        isBonus: isBonus,
        isSpecialBonus: isSpecialBonus,
        isStatic: isStatic,
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
        highestFloor = playerFloor + 5;
        generatePlatforms(highestFloor);
        io.emit('mapUpdate', platforms.slice(-5));
      }

      const difficultyTier = Math.min(Math.floor(movementData.score / 20), 4);
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
    if (platform.movementType === 'horizontal' && !platform.isStatic) {
      platform.x += platform.speed * (1 / 60);
      if (platform.x > (platform.width / 2 + 750)) platform.speed = -platform.speed;
      if (platform.x < (platform.width / 2 + 50)) platform.speed = -platform.speed;
    }
  });
  io.emit('mapUpdate', platforms);
}, 1000 / 60);

const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});