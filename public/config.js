export const baseConfig = {
  type: Phaser.AUTO,
  parent: "gameContainer",
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
};