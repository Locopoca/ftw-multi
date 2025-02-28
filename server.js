const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

app.use(express.static("public"));

// Room Class
class Room {
  constructor(id, mode) {
    this.id = id;
    this.mode = mode; // 'solo', 'duo', 'quad', 'octet'
    this.playerCount = { solo: 1, duo: 2, quad: 4, octet: 8 }[mode];
    this.players = [];
    this.platforms = [];
    this.highestFloor = 15;
    this.started = false;
    this.playersData = {};
    this.ready = false;
  }

  addPlayer(socket) {
    if (this.players.length < this.playerCount && !this.started) {
      this.players.push(socket);
      socket.join(this.id);
      socket.roomId = this.id;
      this.playersData[socket.id] = { x: 400, y: 550, score: 0 };
      console.log(`Player ${socket.id} added to room ${this.id}`);
      if (this.players.length === this.playerCount) {
        this.ready = true;
        console.log(`Room ${this.id} is full, starting game`);
        setTimeout(() => this.startGame(), this.mode === "solo" ? 500 : 0);
      }
      return true;
    }
    return false;
  }

  removePlayer(socket) {
    const index = this.players.indexOf(socket);
    if (index !== -1) {
      this.players.splice(index, 1);
      socket.leave(this.id);
      delete this.playersData[socket.id];
      delete socket.roomId;
      this.ready = false;
    }
  }

  startGame() {
    if (this.ready && !this.started) {
      this.started = true;
      this.generatePlatforms(this.highestFloor);
      console.log(`Game starting for room ${this.id} with platforms:`, this.platforms);
      io.to(this.id).emit("gameStart", {
        mapData: this.platforms,
        players: this.playersData,
      });
    }
  }

  generatePlatforms(upToFloor) {
    const basePlatformSpacing = 120;
    while (this.platforms.length < upToFloor) {
      const floor = this.platforms.length;
      const difficultyTier = Math.min(Math.floor(floor / 20), 4);
      const spacing = Math.min(basePlatformSpacing + difficultyTier * 5, 150);
      const speedMin = 50 + difficultyTier * 50;
      const speedMax = 300 + difficultyTier * 50;
      const bonusInterval = Math.floor(Math.random() * (12 - 8 + 1)) + 8;

      let x, width, height, movementType, speed, isStatic, isBonus, isSpecialBonus;
      const isNarrow = Math.random() < 0.1;
      width = isNarrow ? 50 : Math.floor(Math.random() * (300 - 100 + 1)) + 100;
      height = Math.floor(Math.random() * (36 - 28 + 1)) + 28;

      if (floor > 0 && floor % 3 === 0) {
        const prevPlatform = this.platforms[floor - 1];
        x = prevPlatform.x + Math.floor(Math.random() * 100 - 50);
        x = Math.max(50, Math.min(x, 750 - width));
      } else {
        x = Math.floor(Math.random() * (750 - 50 + 1)) + 50;
      }

      if (floor === 0) {
        x = 400;
        width = 200;
        height = 32;
        movementType = "none";
        speed = 0;
        isStatic = true;
        isBonus = true;
        isSpecialBonus = Math.random() < 0.2;
      } else if (floor % 20 === 0) {
        x = 400;
        width = 800;
        height = 32;
        movementType = "none";
        speed = 0;
        isStatic = true;
        isBonus = false;
        isSpecialBonus = false;

        // Split the full-width platform into two segments with a 120px gap at a random position
        const gapWidth = 120;
        const minGapX = 60 + gapWidth / 2; // Minimum x position for the gap center (60px from left edge)
        const maxGapX = 740 - gapWidth / 2; // Maximum x position for the gap center (60px from right edge)
        const gapCenterX = Math.random() * (maxGapX - minGapX) + minGapX; // Random gap center between 90 and 710

        const leftSegmentWidth = gapCenterX - gapWidth / 2 - 60; // Width from left edge (x=60) to start of gap
        const rightSegmentWidth = 740 - (gapCenterX + gapWidth / 2); // Width from end of gap to right edge (x=740)

        // Left segment
        this.platforms.push({
          id: `${floor}_left`,
          x: 60 + leftSegmentWidth / 2, // Center of the left segment
          y: 600 - floor * spacing,
          width: leftSegmentWidth,
          height,
          movementType,
          speed,
          baseX: 60 + leftSegmentWidth / 2,
          baseY: 600 - floor * spacing,
          isBonus,
          isSpecialBonus,
          isStatic,
          floor,
        });
        console.log(
          `Generating left platform segment at floor ${floor}, x: ${
            60 + leftSegmentWidth / 2
          }, y: ${600 - floor * spacing}, width: ${leftSegmentWidth}, isBonus: ${isBonus}`
        );

        // Right segment
        this.platforms.push({
          id: `${floor}_right`,
          x: 740 - rightSegmentWidth / 2, // Center of the right segment
          y: 600 - floor * spacing,
          width: rightSegmentWidth,
          height,
          movementType,
          speed,
          baseX: 740 - rightSegmentWidth / 2,
          baseY: 600 - floor * spacing,
          isBonus,
          isSpecialBonus,
          isStatic,
          floor,
        });
        console.log(
          `Generating right platform segment at floor ${floor}, x: ${
            740 - rightSegmentWidth / 2
          }, y: ${600 - floor * spacing}, width: ${rightSegmentWidth}, isBonus: ${isBonus}`
        );
        continue;
      } else {
        isBonus =
          floor % bonusInterval === 0 || (floor > 5 && Math.random() < 0.05);
        isSpecialBonus = isBonus && Math.random() < 0.2;
        movementType = "horizontal";
        speed = Math.random() * (speedMax - speedMin) + speedMin;
        isStatic = false;
        if (isNarrow) width = 50;
      }

      console.log(
        `Generating platform at floor ${floor}, x: ${x}, y: ${
          600 - floor * spacing
        }, isBonus: ${isBonus}`
      );
      this.platforms.push({
        id: floor,
        x,
        y: 600 - floor * spacing,
        width,
        height,
        movementType,
        speed,
        baseX: x,
        baseY: 600 - floor * spacing,
        isBonus,
        isSpecialBonus,
        isStatic,
        floor,
      });
    }
  }

  updatePlatforms() {
    if (this.started) {
      this.platforms.forEach((platform) => {
        if (platform.movementType === "horizontal" && !platform.isStatic) {
          platform.x += platform.speed * (1 / 60);
          if (platform.x > platform.width / 2 + 750)
            platform.speed = -platform.speed;
          if (platform.x < platform.width / 2 + 50)
            platform.speed = -platform.speed;
        }
      });
      console.log(
        `Updating platforms in room ${this.id}, count: ${this.platforms.length}`
      );
      io.to(this.id).emit("mapUpdate", this.platforms);
    }
  }
}

// Room Management
const rooms = { solo: [], duo: [], quad: [], octet: [] };
const roomMap = {};
let roomCounter = 0;

function generateUniqueId() {
  return "room_" + ++roomCounter;
}

io.on("connection", (socket) => {
  socket.on("connect", () => console.log(`Player ${socket.id} connected`));
  socket.on("joinRoom", (mode) => {
    console.log(`Player ${socket.id} joining ${mode}`);
    if (!["solo", "duo", "quad", "octet"].includes(mode)) return;
    let joined = false;
    for (let room of rooms[mode]) {
      if (room.addPlayer(socket)) {
        joined = true;
        break;
      }
    }
    if (!joined) {
      const id = generateUniqueId();
      const newRoom = new Room(id, mode);
      roomMap[id] = newRoom;
      rooms[mode].push(newRoom);
      newRoom.addPlayer(socket);
    }
  });

  socket.on("playerMovement", (movementData) => {
    const room = roomMap[socket.roomId];
    if (room && room.started) {
      room.playersData[socket.id] = {
        x: movementData.x,
        y: movementData.y,
        score: movementData.score,
      };
      console.log(
        `Player ${socket.id} moved to (${movementData.x}, ${movementData.y}), score: ${movementData.score}`
      );
      io.to(room.id).emit("playerMoved", { id: socket.id, ...movementData });
      const playerFloor = Math.floor((600 - movementData.y) / 120);
      if (playerFloor > room.highestFloor - 5) {
        room.highestFloor = playerFloor + 5;
        room.generatePlatforms(room.highestFloor);
        io.to(room.id).emit("mapUpdate", room.platforms.slice(-5));
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player ${socket.id} disconnected`);
    if (socket.roomId && roomMap[socket.roomId]) {
      roomMap[socket.roomId].removePlayer(socket);
    }
  });
});

setInterval(() => {
  for (let mode in rooms) {
    rooms[mode].forEach((room) => room.updatePlatforms());
  }
}, 1000 / 60);

const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});