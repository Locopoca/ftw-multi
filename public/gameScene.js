import { socket } from "./multiplayer.js";
import {
  gameOverText,
  initializeUI,
  updateScoreboard,
  removePlayerFromScoreboard,
  bonusTimerText, // ***CHANGED***: This will now specifically be for bonusTimer
} from "./ui.js";

let player;
let otherPlayers = [];
let platforms;
let bottomFloor;
let cursors;
let score = 0;
let highestScore = 0;
let gameOver = false;
let bonusTimer = 0;
let mapLoaded = false;
let difficultyTier = 0;
let bottomFloorDelay = 3000;
let initialFrames = 5; // Extended to 5 frames for safety
let remainingTime = 42000; // Starting time in milliseconds (30 seconds)
let jumpEmitter; // Particle emitter for jump effect
let jumpEmitterManager; // Particle emitter manager
// ***CHANGED***: Added gameTimerText for remainingTime
let gameTimerText;

const JUMP_VELOCITY = -750;
const MAX_VELOCITY_X = 450;
const ACCELERATION_X = 100;
const DECELERATION_FACTOR = 0.95;
const BOOST_VELOCITY = 150;
const BONUS_JUMP_VELOCITY = -920;
const BONUS_TIME_ADD = 5000; // Time added to remainingTime on bonus collection (5 seconds)
const BONUS_DURATION = 5000; // Duration of bonus effect (5 seconds)
const MAX_TIME = 42000; // Maximum cap for remainingTime (30 seconds)
const PLAYER_COLORS = [
  0xff0000, 0x00ff00, 0xffff00, 0xff00ff, 0x00ffff, 0xff8000, 0x800080, 0x808080,
];

export function create() {
  console.log("Creating game scene...");
  const canvas = document.getElementById("gameContainer");
  console.log(
    "Game canvas exists:",
    !!canvas,
    "visibility:",
    canvas.style.visibility,
    "display:",
    canvas.style.display
  );

  const background = this.add.image(400, 300, "background").setScrollFactor(0);
  console.log("Background added, visible:", background.visible);

  this.physics.world.setBounds(0, -Infinity, 800, Infinity);
  console.log("Physics world bounds set");

  platforms = this.physics.add.staticGroup();
  console.log("Platforms group created, count:", platforms.countActive());

  bottomFloor = this.add.rectangle(400, 600, 800, 32, 0xff0000);
  this.physics.add.existing(bottomFloor, true); // Corrected typo
  bottomFloor.body.checkCollision.down = true;
  console.log("Bottom floor added, visible:", bottomFloor.visible);

  player = this.physics.add.sprite(400, 550, "player");
  player.body.setBounce(0);
  player.body.setCollideWorldBounds(true);
  player.body.setMaxVelocity(MAX_VELOCITY_X, 1200);
  player.body.setGravityY(700);
  player.body.setVelocity(0, 0);
  console.log("Player added, visible:", player.visible);

  jumpEmitterManager = this.add.particles("__DEFAULT");
  jumpEmitterManager.setDepth(5);
  jumpEmitter = jumpEmitterManager.createEmitter({
    speed: { min: 20, max: 50 },
    angle: { min: 180, max: 360 },
    scale: { start: 0.5, end: 0 },
    alpha: { start: 0.8, end: 0 },
    lifespan: 300,
    frequency: -1,
    quantity: 5,
    blendMode: "ADD",
    tint: 0x00ccff,
  });
  jumpEmitter.stop();
  console.log("Jump particle emitter created and stopped");

  this.physics.add.collider(player, platforms, (player, platform) => {
    console.log("Player collided with platform at:", platform.x, platform.y);
    if (platform.isBonus && player.body.touching.down) {
      bonusTimer = BONUS_DURATION;
      remainingTime = Math.min(remainingTime + BONUS_TIME_ADD, MAX_TIME);
      // ***CHANGED***: Update bonusTimerText specifically for bonusTimer
      bonusTimerText.setText(`Bonus: ${(bonusTimer / 1000).toFixed(3)}`);
      console.log("Bonus activated, bonusTimer set to 5000ms, remainingTime:", remainingTime);
    }
  });

  this.physics.add.collider(player, bottomFloor, () => {
    if (!gameOver && initialFrames <= 0) {
      gameOver = true;
      player.setTexture("player");
      gameOverText.setText("Game Over\nPress R to Restart");
      gameOverText.setVisible(true);
      socket.emit("playerDisconnected", socket.id);
      console.log("Game over triggered");
    }
  });

  cursors = this.input.keyboard.createCursorKeys();
  this.spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

  initializeUI.call(this);
  // ***CHANGED***: Initialize gameTimerText after UI setup
  gameTimerText = this.add
    .text(780, 40, `Time: ${(remainingTime / 1000).toFixed(1)}`, {
      fontSize: "20px",
      fill: "#00ff00",
      stroke: "#000000",
      strokeThickness: 2,
      align: "right",
    })
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setDepth(10);
  console.log("Game timer text added in upper-right corner below bonus timer");

  this.cameras.main.startFollow(player, true);
  this.cameras.main.setBounds(0, -Infinity, 800, Infinity);
  console.log("Camera following player, bounds set");

  this.physics.world.pause();
  console.log("Physics world paused initially");
}

export function update(time, delta) {
  if (!mapLoaded) {
    console.log("Map not loaded, skipping update");
    return;
  }

  console.log("Updating game state, player at:", player.x, player.y);

  if (initialFrames > 0) {
    initialFrames--;
    console.log(`Initial frames remaining: ${initialFrames}, player at (${player.x}, ${player.y}), bottomFloor at ${bottomFloor.y}`);
  }

  if (gameOver) {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      console.log("Restarting game...");
      let startingPlatform = platforms.getChildren().find(p => p.floor === 0);
      let safeX = 400;
      let safeY = 550;
      if (startingPlatform) {
        safeX = startingPlatform.x;
        safeY = startingPlatform.y - (startingPlatform.height || 32) / 2 - 20;
        console.log(`Positioning player on starting platform at (${safeX}, ${safeY})`);
      } else {
        console.warn("No starting platform found on restart, using default position");
      }
      player.setPosition(safeX, safeY);
      player.setTexture("player");
      player.body.setVelocity(0, 0);
      bonusTimer = 0;
      remainingTime = MAX_TIME;
      // ***CHANGED***: Reset both timers
      bonusTimerText.setText("Bonus: 0.000");
      gameTimerText.setText(`Time: ${(remainingTime / 1000).toFixed(1)}`);
      score = 0;
      highestScore = 0;
      bottomFloorDelay = 2000;
      bottomFloor.setPosition(400, 600);
      bottomFloor.body.updateFromGameObject();
      updateScoreboard(this, socket.id, 0, true);
      gameOver = false;
      gameOverText.setVisible(false);
      socket.emit("playerMovement", { x: player.x, y: player.y, score: score });
      console.log("Game restarted, player at:", player.x, player.y);
      initialFrames = 5;
    }
    return;
  }

  // ***CHANGED***: Update bonusTimer and its display separately
  if (bonusTimer > 0) {
    bonusTimer -= delta;
    bonusTimerText.setText(`Bonus: ${(bonusTimer / 1000).toFixed(3)}`);
    console.log("Bonus active, time remaining:", bonusTimer);
    player.setTexture("player2");
  } else {
    player.setTexture("player");
    bonusTimerText.setText("Bonus: 0.000"); // Show 0 when inactive
  }

  // ***CHANGED***: Update remainingTime and its display separately
  if (remainingTime > 0) {
    remainingTime -= delta;
    gameTimerText.setText(`Time: ${(remainingTime / 1000).toFixed(1)}`);
    if (remainingTime <= 0) {
      gameOver = true;
      gameOverText.setText("Time's Up!\nPress R to Restart");
      gameOverText.setVisible(true);
      socket.emit("playerDisconnected", socket.id);
      console.log("Game over due to time out");
    }
  }

  if (bottomFloorDelay > 0) {
    bottomFloorDelay -= delta;
    console.log("Bottom floor delay:", bottomFloorDelay);
  } else {
    const bottomSpeed = 10 + difficultyTier * 2;
    const targetY = 600 - highestScore * 120 + 1200;
    bottomFloor.y -= (bottomSpeed * delta) / 1000;
    if (bottomFloor.y > targetY) bottomFloor.y = targetY;
    bottomFloor.body.updateFromGameObject();
    console.log("Bottom floor moved to:", bottomFloor.y);
  }

  const currentVelocityX = player.body.velocity.x;

  if (cursors.left.isDown) {
    console.log("Left arrow pressed");
    if (
      Phaser.Input.Keyboard.JustDown(cursors.left) &&
      (currentVelocityX >= 0 || Math.abs(currentVelocityX) < 50)
    ) {
      player.body.setVelocityX(-BOOST_VELOCITY);
      console.log("Left boost applied, velocity:", player.body.velocity.x);
    }
    player.body.setAccelerationX(-ACCELERATION_X);
  } else if (cursors.right.isDown) {
    console.log("Right arrow pressed");
    if (
      Phaser.Input.Keyboard.JustDown(cursors.right) &&
      (currentVelocityX <= 0 || Math.abs(currentVelocityX) < 50)
    ) {
      player.body.setVelocityX(BOOST_VELOCITY);
      console.log("Right boost applied, velocity:", player.body.velocity.x);
    }
    player.body.setAccelerationX(ACCELERATION_X);
  } else {
    player.body.setAccelerationX(0);
    player.body.setVelocityX(currentVelocityX * DECELERATION_FACTOR);
    console.log("No movement, velocity:", player.body.velocity.x);
  }

  if (Phaser.Input.Keyboard.JustDown(this.spaceBar)) {
    console.log("Spacebar pressed");
    if (player.body.touching.down || player.body.velocity.y === 0) {
      player.body.setVelocityY(
        bonusTimer > 0 ? BONUS_JUMP_VELOCITY : JUMP_VELOCITY
      );
      jumpEmitter.setPosition(player.x, player.y + 10);
      jumpEmitter.explode(5);
      console.log("Jump initiated with particle effect, velocity:", player.body.velocity.y);
    } else {
      console.log(
        "Jump blocked, not on ground, touching:",
        player.body.touching.down,
        "velocity:",
        player.body.velocity.y
      );
    }
  }

  const spacing = 120;
  const playerHeight = Math.floor((600 - player.y) / spacing);
  if (playerHeight > score) {
    score = playerHeight;
    updateScoreboard(this, socket.id, score, true);
    console.log("Score updated to:", score);
    if (score > highestScore) highestScore = score;
  }

  const movementData = { x: player.x, y: player.y, score: score };
  socket.emit("playerMovement", movementData);
  console.log("Player movement emitted:", movementData);
}

export function addOtherPlayer(id, playerInfo) {
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
  updateScoreboard(this, id, 0, false);
  console.log(
    `Other player ${id} added, position: (${otherPlayer.x}, ${otherPlayer.y})`
  );
}

export function setMapLoaded(value) {
  mapLoaded = value;
}

export { platforms, bottomFloor, player, otherPlayers, remainingTime };