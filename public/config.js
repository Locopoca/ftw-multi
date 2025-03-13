export const baseConfig = {
  type: Phaser.AUTO,
  parent: "gameContainer",
  width: 800,
  height: 600,
  scale: {
    mode: Phaser.Scale.FIT, // Scale to fit the screen while maintaining aspect ratio
    autoCenter: Phaser.Scale.CENTER_BOTH, // Center the game on screen
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 700 },
      debug: false,
      fps: 120,
    },
  },
};