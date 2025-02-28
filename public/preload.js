export function preload() {
    console.log("Preloading assets...");
    this.load.image("background", "/assets/background.jpeg");
    this.load.image("player", "/assets/player2.png");
    this.load.image("player2", "/assets/player.png");
    this.load.on("complete", () => console.log("Assets preloaded successfully"));
    this.load.on("error", (file, error) =>
      console.error("Asset load error:", file, error)
    );
  }