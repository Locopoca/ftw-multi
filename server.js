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
    const minVerticalSpacing = 30;
    let lastY = 600;
  
    while (this.platforms.length < upToFloor) {
      const floor = this.platforms.length;
      const difficultyTier = Math.min(Math.floor(floor / 20), 4);
      const spacing = basePlatformSpacing;
      const speedMin = 50 + difficultyTier * 50;
      const speedMax = 300 + difficultyTier * 50;
      const bonusInterval = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
  
      let x, width, height, movementType, speed, isStatic, isBonus, isSpecialBonus;
      const isNarrow = Math.random() < 0.1;
      width = isNarrow ? 50 : Math.floor(Math.random() * (300 - 100 + 1)) + 100;
      height = Math.floor(Math.random() * (36 - 28 + 1)) + 28;
  
      // Adjust spacing for floor after split (e.g., floor 21, 41)
      let intendedY = 600 - floor * spacing;
      if (floor > 0 && this.platforms[floor - 1].id.toString().includes("_left")) {
        intendedY = this.platforms[floor - 1].y - 80; // Reduced spacing after split
        console.log(`Reduced spacing to 80px for floor ${floor} after split`);
      }
  
      if (lastY - intendedY < minVerticalSpacing) {
        intendedY = lastY - minVerticalSpacing;
      }
      lastY = intendedY;
  
      if (floor > 0) {
        const prevPlatform = this.platforms[floor - 1];
        const prevLeft = prevPlatform.x - prevPlatform.width / 2;
        const prevRight = prevPlatform.x + prevPlatform.width / 2;
  
        let attempts = 0;
        const maxAttempts = 10;
        do {
          if (floor % 3 === 0) {
            x = prevPlatform.x + Math.floor(Math.random() * 100 - 50);
            x = Math.max(60 + width / 2, Math.min(x, 740 - width / 2));
          } else {
            x = Math.floor(Math.random() * (680) + 60 + width / 2);
          }
          attempts++;
        } while (
          attempts < maxAttempts &&
          Math.abs(prevPlatform.y - intendedY) < minVerticalSpacing &&
          (x + width / 2 > prevLeft && x - width / 2 < prevRight)
        );
  
        if (attempts >= maxAttempts) {
          if (prevPlatform.x < 400) {
            x = Math.max(400, 740 - width / 2);
          } else {
            x = Math.min(400, 60 + width / 2);
          }
        }
      } else {
        x = Math.floor(Math.random() * (680) + 60 + width / 2);
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
  
        const gapWidth = 120;
        const minGapX = 60 + gapWidth / 2;
        const maxGapX = 740 - gapWidth / 2;
        const gapCenterX = Math.random() * (maxGapX - minGapX) + minGapX;
  
        const leftSegmentWidth = gapCenterX - gapWidth / 2 - 60;
        const rightSegmentWidth = 740 - (gapCenterX + gapWidth / 2);
  
        this.platforms.push({
          id: `${floor}_left`,
          x: 60 + leftSegmentWidth / 2,
          y: intendedY,
          width: leftSegmentWidth,
          height,
          movementType,
          speed,
          baseX: 60 + leftSegmentWidth / 2,
          baseY: intendedY,
          isBonus,
          isSpecialBonus,
          isStatic,
          floor,
        });
  
        this.platforms.push({
          id: `${floor}_right`,
          x: 740 - rightSegmentWidth / 2,
          y: intendedY,
          width: rightSegmentWidth,
          height,
          movementType,
          speed,
          baseX: 740 - rightSegmentWidth / 2,
          baseY: intendedY,
          isBonus,
          isSpecialBonus,
          isStatic,
          floor,
        });
  
        // Add a bonus platform above the split
        const bonusX = gapCenterX; // Center it in the gap
        const bonusY = intendedY - 60; // 60px above split, jumpable from either side
        this.platforms.push({
          id: `${floor}_bonus`,
          x: bonusX,
          y: bonusY,
          width: 80, // Small enough to fit in gap
          height: 32,
          movementType: "none",
          speed: 0,
          baseX: bonusX,
          baseY: bonusY,
          isBonus: true,
          isSpecialBonus: false,
          isStatic: true,
          floor,
        });
        console.log(`Added bonus platform at (${bonusX}, ${bonusY}) for split floor ${floor}`);
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
  
      this.platforms.push({
        id: floor,
        x,
        y: intendedY,
        width,
        height,
        movementType,
        speed,
        baseX: x,
        baseY: intendedY,
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