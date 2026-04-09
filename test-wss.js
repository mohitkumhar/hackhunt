const { io } = require("socket.io-client");

// Set up Manager Socket
const managerSocket = io("http://localhost:3000", {
  path: "/ws",
  auth: { clientId: "SYSTEM_TESTER_MANAGER" }
});

// Set up Player Socket
const playerSocket = io("http://localhost:3000", {
  path: "/ws",
  auth: { clientId: "SYSTEM_TESTER_PLAYER_1" }
});

let testGameId = null;
let testInviteCode = null;

managerSocket.on("connect", () => {
  console.log("[Manager] connected!");
  // Authenticate as manager
  managerSocket.emit("manager:auth", "1234");
});

managerSocket.on("manager:quizzList", (quizzes) => {
  console.log("[Manager] Got quizzes. Creating room...");
  // Create first quiz in the list
  if (quizzes.length > 0) {
    managerSocket.emit("game:create", quizzes[0].id);
  }
});

managerSocket.on("manager:gameCreated", ({ gameId, inviteCode }) => {
  console.log(`[Manager] Game created. GameId: ${gameId}, InviteCode: ${inviteCode}`);
  testGameId = gameId;
  testInviteCode = inviteCode;
  
  // Now player can join using the invite code
  console.log(`[Player] Connecting to room with PIN: ${inviteCode}`);
  playerSocket.emit("player:join", inviteCode);
});

playerSocket.on("game:successRoom", (gameId) => {
  console.log("[Player] Successfully found room. Logging in...");
  // Login with username "TestPlayer"
  playerSocket.emit("player:login", { gameId, data: { username: "TestPlayer", teamName: "Testers" } });
});

playerSocket.on("game:successJoin", () => {
  console.log("[Player] Successfully configured character context and joined lobby!");
  // Start the game via Manager
  console.log("[Manager] Starting the game...");
  managerSocket.emit("manager:startGame", { gameId: testGameId });
});

playerSocket.on("game:status", (status) => {
  if (status.name === "showQuestion") {
    console.log("[Game] Status advanced to " + status.name);
  }
  if (status.name === "selectAnswer") {
    console.log("[Player] Received question! Submitting answer...");
    // Submit an answer (e.g. answer key 0)
    playerSocket.emit("player:selectedAnswer", { gameId: testGameId, data: { answerKey: 0 } });
  }
  if (status.name === "showResult") {
    console.log("[Player] Result computed: ", status.data);
    setTimeout(() => {
      console.log("[Test] Finishing test suite. Success.");
      process.exit(0);
    }, 1500);
  }
});

// Fail safe
setTimeout(() => {
  console.log("Test timed out!");
  process.exit(1);
}, 20000);
