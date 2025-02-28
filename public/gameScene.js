import { socket } from "./multiplayer.js";
import {
  gameOverText,
  initializeUI,
  updateScoreboard,
  removePlayerFromScoreboard,
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
let bottomFloorDelay = 2000;

const JUMP_VELOCITY = -750;
const MAX_VELOCITY_X = 450;
const ACCELERATION_X = 100;
const DECELERATION_FACTOR = 0.95;
const BOOST_VELOCITY = 150;
const BONUS_JUMP_VELOCITY = -950;
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

  this.add.image(400, 300, "background").setScrollFactor(0);
  console.log("Background added, visible:", this.children.list[0].visible);

  this.physics.world.setBounds(0, -Infinity, 800, Infinity);

  platforms = this.physics.add.staticGroup();
  console.log("Platforms group created, count:", platforms.count);

  bottomFloor = this.add.rectangle(400, 600, 800, 32, 0xff0000);
  this.physics.add.existing(bottomFloor, true);
  console.log("Bottom floor added, visible:", bottomFloor.visible);

  player = this.physics.add.sprite(400, 550, "player");
  player.body.setBounce(0);
  player.body.setCollideWorldBounds(true);
  player.body.setMaxVelocity(MAX_VELOCITY_X, 1200);
  player.body.setGravityY(700);
  player.body.setVelocity(0, 0);
  console.log("Player added, visible:", player.visible);

  this.physics.add.collider(player, platforms, (player, platform) => {
    console.log("Player collided with platform at:", platform.x, platform.y);
    if (platform.isBonus && player.body.touching.down) {
      bonusTimer = 5000;
      console.log("Bonus activated, timer set to 5000ms");
    }
  });

  this.physics.add.collider(player, bottomFloor, () => {
    if (!gameOver) {
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

  if (gameOver) {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      console.log("Restarting game...");
      player.setPosition(400, 550);
      player.setTexture("player");
      player.body.setVelocity(0, 0);
      bonusTimer = 0;
      score = 0;
      highestScore = 0;
      bottomFloorDelay = 2000;
      bottomFloor.setPosition(400, 600);
      bottomFloor.body.updateFromGameObject();
      updateScoreboard(this, socket.id, 0, true);
      gameOver = false;
      gameOverText.setVisible(false);
      socket.emit("playerMovement", { x: player.x, y: player.y, score: score });
      console.log("Game restarted, player at initial position");
    }
    return;
  }

  if (bonusTimer > 0) {
    bonusTimer -= delta;
    console.log("Bonus active, time remaining:", bonusTimer);
    player.setTexture("player2");
  } else {
    player.setTexture("player");
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
      console.log("Jump initiated, velocity:", player.body.velocity.y);
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

export { platforms, bottomFloor, player, otherPlayers };