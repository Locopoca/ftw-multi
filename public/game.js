const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: 800,
  height: 600,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 700 },
      debug: false,
      fps: 120,
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

const game = new Phaser.Game(config);

function preload() {
  this.load.image("background", "/assets/background.jpeg");
  this.load.image("player", "/assets/player2.png");
  this.load.image("player2", "/assets/player.png");
}

let player;
let otherPlayers = [];
let platforms;
let bottomFloor;
let cursors;
let socket;
let score = 0;
let highestScore = 0;
let scoreText;
let gameOver = false;
let gameOverText;
let JUMP_VELOCITY = -600;
let MAX_VELOCITY_X = 450;
let ACCELERATION_X = 100;
let DECELERATION_FACTOR = 0.95;
const BOOST_VELOCITY = 150;
const BONUS_JUMP_VELOCITY = -800;
const PLAYER_COLORS = [
  0xff0000, 0x00ff00, 0xffff00, 0xff00ff, 0x00ffff, 0xff8000, 0x800080,
  0x808080,
];
let bonusTimer = 0;
let playerId;
let mapLoaded = false;
let difficultyTier = 0;
let bottomFloorDelay = 2000;

function create() {
  socket = io();

  this.add.image(400, 300, "background").setScrollFactor(0);

  this.physics.world.setBounds(0, -Infinity, 800, Infinity);

  platforms = this.physics.add.staticGroup();

  bottomFloor = this.add.rectangle(400, 600, 800, 32, 0xff0000);
  this.physics.add.existing(bottomFloor, true);

  player = this.physics.add.sprite(400, 550, "player");
  player.body.setBounce(0);
  player.body.setCollideWorldBounds(true);
  player.body.setMaxVelocity(MAX_VELOCITY_X, 1200);
  player.body.setVelocity(0, 0);

  this.physics.add.collider(player, platforms, (player, platform) => {
    if (platform.isBonus && player.body.touching.down) {
      bonusTimer = 5000;
    }
  });

  this.physics.add.collider(player, bottomFloor, () => {
    if (!gameOver) {
      gameOver = true;
      player.setTexture("player");
      gameOverText.setText("Game Over\nPress R to Restart");
      gameOverText.setVisible(true);
      socket.emit("playerDisconnected", socket.id);
    }
  });

  cursors = this.input.keyboard.createCursorKeys();
  this.spaceBar = this.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SPACE
  );
  this.restartKey = this.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.R
  );

  scoreText = this.add
    .text(16, 16, "Score: 0", { fontSize: "20px", fill: "#ffffff" })
    .setScrollFactor(0);
  gameOverText = this.add
    .text(400, 300, "", { fontSize: "40px", fill: "#ff0000" })
    .setOrigin(0.5)
    .setScrollFactor(0);
  gameOverText.setVisible(false);

  this.cameras.main.startFollow(player, false, 0.1, 0.1);
  this.cameras.main.setBounds(0, -Infinity, 800, Infinity);

  if (!this.textures.exists('paper')) {
    const paperTexture = this.textures.createCanvas('paper', 128, 32);
    const ctx = paperTexture.context;
    for (let x = 0; x < 128; x++) {
      for (let y = 0; y < 32; y++) {
        const alpha = Math.random() * 0.2;
        ctx.fillStyle = `rgba(245, 245, 220, ${alpha})`; // Beige paper-like
        ctx.fillRect(x, y, 1, 1);
      }
    }
    paperTexture.refresh();
  }

  document.getElementById("jumpVelocity").addEventListener("input", (e) => {
    JUMP_VELOCITY = parseInt(e.target.value);
    document.getElementById("jumpValue").textContent = JUMP_VELOCITY;
  });
  document.getElementById("maxVelocityX").addEventListener("input", (e) => {
    MAX_VELOCITY_X = parseInt(e.target.value);
    player.body.setMaxVelocity(MAX_VELOCITY_X, 1200);
    document.getElementById("maxVelocityXValue").textContent = MAX_VELOCITY_X;
  });
  document.getElementById("accelerationX").addEventListener("input", (e) => {
    ACCELERATION_X = parseInt(e.target.value);
    document.getElementById("accelerationXValue").textContent = ACCELERATION_X;
  });
  document.getElementById("deceleration").addEventListener("input", (e) => {
    DECELERATION_FACTOR = parseFloat(e.target.value);
    document.getElementById("decelerationValue").textContent =
      DECELERATION_FACTOR.toFixed(2);
  });
  document.getElementById("gravity").addEventListener("input", (e) => {
    const baseGravity = 700 + Math.min(difficultyTier, 2) * 50;
    const userAdjustment = parseInt(e.target.value) - baseGravity;
    this.physics.world.gravity.y = baseGravity + userAdjustment;
    document.getElementById("gravityValue").textContent =
      this.physics.world.gravity.y;
  });

  socket.on("serverFull", (message) => {
    alert(message);
  });

  socket.on("currentPlayers", (players) => {
    Object.keys(players).forEach((id) => {
      if (id !== socket.id) {
        addOtherPlayer.call(this, id, players[id]);
      } else {
        playerId = id;
      }
    });
    updateScoreboard(players);
  });

  socket.on("newPlayer", (playerInfo) => {
    addOtherPlayer.call(this, playerInfo.id, playerInfo);
  });

  socket.on("playerMoved", (data) => {
    otherPlayers.forEach((otherPlayer) => {
      if (otherPlayer.playerId === data.id) {
        otherPlayer.setPosition(data.x, data.y);
        otherPlayer.score = data.score;
      }
    });
    updateScoreboard(getAllPlayers());
  });

  socket.on("playerDisconnected", (id) => {
    otherPlayers = otherPlayers.filter((otherPlayer) => {
      if (otherPlayer.playerId === id) {
        otherPlayer.destroy();
        return false;
      }
      return true;
    });
    updateScoreboard(getAllPlayers());
  });

  socket.on("mapData", (mapData) => {
    platforms.clear(true, true);
    mapData.forEach((platformData) => {
        const platform = this.add.rectangle(platformData.x, platformData.y, platformData.width, 32, platformData.isBonus ? 0xFFA500 : 0x000000);
        this.physics.add.existing(platform, true);
        
        platforms.add(platform);
        
        platform.body.checkCollision.down = false;
        platform.isBonus = platformData.isBonus;
      });
    mapLoaded = true;
  });

  socket.on("mapUpdate", (newPlatforms) => {
    newPlatforms.forEach((platformData) => {
        let existing = platforms.getChildren().find((p) => p.y === platformData.y);
        if (!existing) {
          const platform = this.add.rectangle(platformData.x, platformData.y, platformData.width, 32, platformData.isBonus ? 0xFFA500 : 0x000000);
          this.physics.add.existing(platform, true);

          platforms.add(platform);
          platform.body.checkCollision.down = false;
          platform.isBonus = platformData.isBonus;
        } else {
          existing.x = platformData.x;
          existing.y = platformData.y;
          existing.body.updateFromGameObject();
        }
      });
  });

  socket.on("difficultyUpdate", (data) => {
    difficultyTier = data.tier;
    const baseGravity = 700 + Math.min(difficultyTier, 2) * 50;
    const sliderGravity = parseInt(document.getElementById("gravity").value);
    this.physics.world.gravity.y = Math.max(baseGravity, sliderGravity);
    document.getElementById("gravityValue").textContent =
      this.physics.world.gravity.y;
  });

  this.physics.world.pause();
  socket.on("mapData", () => {
    this.physics.world.resume();
  });
}

function update(time, delta) {
  if (!mapLoaded) return;

  if (gameOver) {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      player.setPosition(400, 550);
      player.setTexture("player");
      player.body.setVelocity(0, 0);
      bonusTimer = 0;
      score = 0;
      highestScore = 0; // Reset highest score too
      bottomFloorDelay = 2000;
      bottomFloor.setPosition(400, 600);
      bottomFloor.body.updateFromGameObject(); // Ensure physics syncs
      scoreText.setText("Score: 0");
      gameOver = false;
      gameOverText.setVisible(false);
      socket.emit("playerMovement", { x: player.x, y: player.y, score: score });
    }
    return;
  }

  if (bonusTimer > 0) {
    bonusTimer -= delta;
    player.setTexture("player2");
  } else {
    player.setTexture("player");
  }

  if (bottomFloorDelay > 0) {
    bottomFloorDelay -= delta;
  } else {
    const bottomSpeed = 10 + difficultyTier * 2;
    const targetY = 600 - highestScore * 120 + 1200; // Fixed 120px spacing
    bottomFloor.y -= (bottomSpeed * delta) / 1000;
    if (bottomFloor.y > targetY) bottomFloor.y = targetY;
    bottomFloor.body.updateFromGameObject();
  }

  const currentVelocityX = player.body.velocity.x;

  if (cursors.left.isDown) {
    if (
      Phaser.Input.Keyboard.JustDown(cursors.left) &&
      (currentVelocityX >= 0 || Math.abs(currentVelocityX) < 50)
    ) {
      player.body.setVelocityX(-BOOST_VELOCITY);
    }
    player.body.setAccelerationX(-ACCELERATION_X);
  } else if (cursors.right.isDown) {
    if (
      Phaser.Input.Keyboard.JustDown(cursors.right) &&
      (currentVelocityX <= 0 || Math.abs(currentVelocityX) < 50)
    ) {
      player.body.setVelocityX(BOOST_VELOCITY);
    }
    player.body.setAccelerationX(ACCELERATION_X);
  } else {
    player.body.setAccelerationX(0);
    player.body.setVelocityX(currentVelocityX * DECELERATION_FACTOR);
  }

  if (Phaser.Input.Keyboard.JustDown(this.spaceBar)) {
    if (player.body.touching.down || player.body.velocity.y === 0) {
      player.body.setVelocityY(
        bonusTimer > 0 ? BONUS_JUMP_VELOCITY : JUMP_VELOCITY
      );
    }
  }

  const spacing = 120; // Fixed spacing
  const playerHeight = Math.floor((600 - player.y) / spacing);
  if (playerHeight > score) {
    score = playerHeight;
    scoreText.setText("Score: " + score);
    if (score > highestScore) highestScore = score;
  }

  const movementData = { x: player.x, y: player.y, score: score };
  socket.emit("playerMovement", movementData);
}

function addOtherPlayer(id, playerInfo) {
  const colorIndex = otherPlayers.length + 1;
  const otherPlayer = this.physics.add.sprite(
    playerInfo.x,
    playerInfo.y,
    "player"
  );
  otherPlayer.setTint(PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]);
  otherPlayer.playerId = id;
  otherPlayer.score = 0;
  otherPlayers.push(otherPlayer);
}

function getAllPlayers() {
  const allPlayers = { [playerId]: { x: player.x, y: player.y, score: score } };
  otherPlayers.forEach((otherPlayer) => {
    allPlayers[otherPlayer.playerId] = {
      x: otherPlayer.x,
      y: otherPlayer.y,
      score: otherPlayer.score,
    };
  });
  return allPlayers;
}

function updateScoreboard(players) {
  const scoresDiv = document.getElementById("scores");
  scoresDiv.innerHTML = "";
  Object.keys(players).forEach((id) => {
    const playerColor =
      PLAYER_COLORS[Object.keys(players).indexOf(id) % PLAYER_COLORS.length];
    const colorHex = `#${playerColor.toString(16).padStart(6, "0")}`;
    const scoreEntry = document.createElement("div");
    scoreEntry.innerHTML = `<span style="color: ${colorHex};">Player ${id.slice(
      0,
      4
    )}</span>: ${players[id].score}`;
    scoresDiv.appendChild(scoreEntry);
  });
}
