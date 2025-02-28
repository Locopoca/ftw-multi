import { baseConfig } from "./config.js";
import { preload } from "./preload.js";
import { create, update } from "./gameScene.js";
import { initializeMultiplayer, setupLobbyListeners } from "./multiplayer.js";

// Assign scene functions to config
const config = {
  ...baseConfig, // Spread the base config
  scene: {
    preload: preload,
    create: function () {
      create.call(this);
      initializeMultiplayer(this);
      setupLobbyListeners();
    },
    update: update,
  },
};

const game = new Phaser.Game(config);