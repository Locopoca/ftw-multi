export let scoreBoard = [];
export let gameOverText;
export let bonusTimerText; //
export let gameTimerText; // In ui.js at the top

export function initializeUI() {
  gameOverText = this.add
    .text(400, 300, "", {
      fontSize: "32px",
      fill: "#ff0000",
      stroke: "#000000",
      strokeThickness: 2,
    })
    .setOrigin(0.5)
    .setScrollFactor(0);
  gameOverText.setVisible(false);
  console.log("Game over text added, initially hidden");

  gameTimerText = null; // Initialize it as null, set in gameScene.js
  // Initialize bonus countdown timer
  bonusTimerText = this.add
    .text(780, 20, "Time: 30.0", {
      fontSize: "20px",
      fill: "#00ff00",
      stroke: "#000000",
      strokeThickness: 2,
      align: "right",
    })
    .setOrigin(1, 0) // Anchor to top-right
    .setScrollFactor(0)
    .setDepth(10);
  console.log("Bonus timer text added in upper-right corner");

  scoreBoard = [];
  console.log("Scoreboard initialized");
}

export function updateScoreboard(scene, playerId, score, isLocalPlayer = false) {
  let scoreEntry = scoreBoard.find((entry) => entry.id === playerId);
  const yPosition = 20 + scoreBoard.length * 30;

  if (!scoreEntry) {
    scoreEntry = {
      id: playerId,
      text: scene.add
        .text(20, yPosition, "", {
          fontSize: "16px",
          fill: isLocalPlayer ? "#00ff00" : "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          shadow: {
            offsetX: 2,
            offsetY: 2,
            color: "#ff00ff",
            blur: 1,
            stroke: true,
            fill: true,
          },
        })
        .setScrollFactor(0)
        .setDepth(10),
    };
    scoreBoard.push(scoreEntry);
  }

  scoreEntry.text.setText(
    `${isLocalPlayer ? "P1" : "P" + (scoreBoard.indexOf(scoreEntry) + 1)}: ${score}`
  );
  scoreEntry.text.setPosition(20, 20 + scoreBoard.indexOf(scoreEntry) * 30);
}

export function removePlayerFromScoreboard(playerId) {
  const index = scoreBoard.findIndex((entry) => entry.id === playerId);
  if (index !== -1) {
    scoreBoard[index].text.destroy();
    scoreBoard.splice(index, 1);
    scoreBoard.forEach((entry, i) => {
      entry.text.setPosition(20, 20 + i * 30);
    });
  }
}

function addFlickerEffect() {
  const canvas = this.sys.game.canvas;
  canvas.style.transition = "opacity 0.05s ease-in-out";

  const flicker = () => {
    const flickerChance = Math.random();
    if (flickerChance < 0.05) {
      canvas.style.opacity = "0.8";
      setTimeout(() => {
        canvas.style.opacity = "1";
      }, 50);
    } else if (flickerChance < 0.1) {
      canvas.style.opacity = "0.9";
      setTimeout(() => {
        canvas.style.opacity = "1";
      }, 100);
    }
    setTimeout(flicker, Math.random() * 30 + 20);
  };

  flicker();
}

export function hideLobby() {
  const lobby = document.getElementById("lobby");
  const waiting = document.getElementById("waiting");
  const canvas = document.getElementById("gameContainer");
  lobby.style.display = "none";
  lobby.style.visibility = "hidden";
  waiting.style.display = "none";
  waiting.style.visibility = "hidden";
  canvas.style.display = "block";
  canvas.style.visibility = "visible";
  console.log(
    "Game canvas visibility after start:",
    canvas.style.visibility,
    "display:",
    canvas.style.display
  );
}