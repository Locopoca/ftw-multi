import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";
import {
  addOtherPlayer,
  setMapLoaded,
  platforms,
  player,
  otherPlayers,
} from "./gameScene.js";
import {
  hideLobby,
  updateScoreboard,
  removePlayerFromScoreboard,
} from "./ui.js";

export const socket = io();

export function initializeMultiplayer(scene) {
  socket.on("connect", () => console.log("Connected to server"));

  socket.on("gameStart", (data) => {
    console.log("Game started with map data:", data.mapData);
    hideLobby();
    scene.physics.world.resume();
    setMapLoaded(true);

    platforms.clear(true, true);
    console.log("Clearing platforms, new count:", platforms.count);
    data.mapData.forEach((platformData) => {
      if (
        platformData.id.toString().includes("_left") ||
        platformData.id.toString().includes("_right")
      ) {
        const platform = scene.add.rectangle(
          platformData.x,
          platformData.y,
          platformData.width,
          platformData.height || 32,
          platformData.isBonus ? 0xFFA500 : 0x000000
        );
        scene.physics.add.existing(platform, true);
        platform.id = platformData.id;
        platform.isStatic = platformData.isStatic;
        platform.isBonus = platformData.isBonus;
        platform.isSpecialBonus = platformData.isSpecialBonus;
        platform.floor = platformData.floor;
        platforms.add(platform);
        console.log(
          `Platform segment added at (${platform.x}, ${platform.y}), visible:`,
          platform.visible
        );
      } else {
        const platform = scene.add.rectangle(
          platformData.x,
          platformData.y,
          platformData.width,
          platformData.height || 32,
          platformData.isBonus ? 0xFFA500 : 0x000000
        );
        scene.physics.add.existing(platform, true);
        platform.id = platformData.id;
        platform.isStatic = platformData.isStatic;
        platform.isBonus = platformData.isBonus;
        platform.isSpecialBonus = platformData.isSpecialBonus;
        platform.floor = platformData.floor;
        platforms.add(platform);
        console.log(
          `Platform added at (${platform.x}, ${platform.y}), visible:`,
          platform.visible
        );
      }
    });

    const playerData = data.players[socket.id];
    if (playerData) {
      player.setPosition(playerData.x, playerData.y);
      console.log(`Player positioned at (${player.x}, ${player.y})`);
    }

    otherPlayers.length = 0;
    Object.keys(data.players).forEach((id) => {
      if (id !== socket.id) {
        addOtherPlayer.call(scene, id, data.players[id]);
        console.log(`Other player ${id} added`);
      }
    });
  });

  socket.on("mapUpdate", (serverPlatforms) => {
    console.log("Map update received with platforms:", serverPlatforms.length);
    serverPlatforms.forEach((platformData) => {
      let existing = platforms
        .getChildren()
        .find((p) => p.id === platformData.id);
      if (existing) {
        if (!existing.isStatic) {
          existing.x = platformData.x;
          console.log(
            `Updated moving platform ${platformData.id} x to ${platformData.x}`
          );
        }
        existing.body.updateFromGameObject();
      } else {
        if (
          platformData.id.toString().includes("_left") ||
          platformData.id.toString().includes("_right")
        ) {
          const platform = scene.add.rectangle(
            platformData.x,
            platformData.y,
            platformData.width,
            platformData.height || 32,
            platformData.isBonus ? 0xFFA500 : 0x000000
          );
          scene.physics.add.existing(platform, true);
          platform.id = platformData.id;
          platform.isStatic = platformData.isStatic;
          platform.isBonus = platformData.isBonus;
          platform.isSpecialBonus = platformData.isSpecialBonus;
          platform.floor = platformData.floor;
          platforms.add(platform);
          console.log(
            `New platform segment added at (${platform.x}, ${platform.y}), visible:`,
            platform.visible
          );
        } else {
          const platform = scene.add.rectangle(
            platformData.x,
            platformData.y,
            platformData.width,
            platformData.height || 32,
            platformData.isBonus ? 0xFFA500 : 0x000000
          );
          scene.physics.add.existing(platform, true);
          platform.id = platformData.id;
          platform.isStatic = platformData.isStatic;
          platform.isBonus = platformData.isBonus;
          platform.isSpecialBonus = platformData.isSpecialBonus;
          platform.floor = platformData.floor;
          platforms.add(platform);
          console.log(
            `New platform added at (${platform.x}, ${platform.y}), visible:`,
            platform.visible
          );
        }
      }
    });
  });

  socket.on("playerMoved", (data) => {
    console.log(
      `Player ${data.id} moved to (${data.x}, ${data.y}), score: ${data.score}`
    );
    otherPlayers.forEach((otherPlayer) => {
      if (otherPlayer.playerId === data.id) {
        otherPlayer.setPosition(data.x, data.y);
        otherPlayer.score = data.score;
        updateScoreboard(scene, data.id, data.score, false);
      }
    });
  });

  socket.on("newPlayer", (playerInfo) => {
    console.log(`New player joined: ${playerInfo.id}`);
    addOtherPlayer.call(scene, playerInfo.id, playerInfo);
  });

  socket.on("playerDisconnected", (id) => {
    console.log(`Player ${id} disconnected`);
    removePlayerFromScoreboard(id);
    otherPlayers = otherPlayers.filter((otherPlayer) => {
      if (otherPlayer.playerId === id) {
        otherPlayer.destroy();
        return false;
      }
      return true;
    });
  });
}

export function setupLobbyListeners() {
  ["solo", "duo", "quad", "octet"].forEach((mode) => {
    document.getElementById(mode).addEventListener("click", () => {
      console.log(`Joining room with mode: ${mode}`);
      document.getElementById("waiting").style.display = "block";
      document.getElementById("waiting").style.visibility = "visible";
      socket.emit("joinRoom", mode);
    });
  });
}