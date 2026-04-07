import { Server } from "@rahoot/common/types/game/socket"
import { inviteCodeValidator } from "@rahoot/common/validators/auth"
import Config from "@rahoot/socket/services/config"
import Game from "@rahoot/socket/services/game"
import Registry from "@rahoot/socket/services/registry"
import { withGame } from "@rahoot/socket/utils/game"
import { Server as ServerIO } from "socket.io"
import { createServer } from "http"

const WS_PORT = 3001

const WANDBOX_API = "https://wandbox.org/api/compile.json"

// Map our language names to Wandbox compiler IDs (exact names from Wandbox API)
const COMPILER_MAP: Record<string, { compiler: string; options?: string }> = {
  python:     { compiler: "cpython-3.12.7" },
  javascript: { compiler: "nodejs-20.17.0" },
  "c++":      { compiler: "gcc-13.2.0" },
  c:          { compiler: "gcc-13.2.0-c" },
  java:       { compiler: "openjdk-jdk-22+36" },
  go:         { compiler: "go-1.23.2" },
}

const httpServer = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/execute") {
    let body = ""
    req.on("data", (chunk: Buffer) => { body += chunk.toString() })
    req.on("end", async () => {
      try {
        // Parse the Piston-format request from the frontend
        const pistonReq = JSON.parse(body)
        const lang = pistonReq.language as string
        const code = pistonReq.files?.[0]?.content || ""
        const compilerInfo = COMPILER_MAP[lang]

        if (!compilerInfo) {
          res.writeHead(400, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ run: { stdout: "", stderr: `Unsupported language: ${lang}` }, compile: null }))
          return
        }

        // Build the Wandbox request
        const wandboxBody: Record<string, string> = {
          code,
          compiler: compilerInfo.compiler,
        }
        if (compilerInfo.options) {
          wandboxBody["compiler-option-raw"] = compilerInfo.options
        }

        console.log(`Executing ${lang} code via Wandbox (${compilerInfo.compiler})...`)

        const response = await fetch(WANDBOX_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wandboxBody),
        })

        if (!response.ok) {
          const errText = await response.text()
          console.error(`Wandbox returned ${response.status}: ${errText}`)
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
          res.end(JSON.stringify({
            compile: null,
            run: { stdout: "", stderr: `Execution engine error (${response.status})`, signal: null, code: 1 },
          }))
          return
        }

        const result = await response.json() as Record<string, string>

        console.log(`Wandbox raw response:`, JSON.stringify(result, null, 2))

        // Translate Wandbox response → Piston response format
        // Only treat as compile error if there's no program output AND status is non-zero
        const hasCompileError = result.compiler_error && result.status !== "0" && !result.program_output
        const pistonResponse = {
          compile: hasCompileError ? { code: 1, output: result.compiler_error || "" } : null,
          run: {
            stdout: result.program_output || "",
            stderr: result.program_error || "",
            signal: result.signal || null,
            code: parseInt(result.status || "0", 10),
          },
        }

        console.log(`Translated stdout: [${pistonResponse.run.stdout}]`)

        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" })
        res.end(JSON.stringify(pistonResponse))
      } catch (err: unknown) {
        console.error("Execution API error:", err)
        res.writeHead(502, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ message: "Failed to reach execution engine" }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end()
})

const io: Server = new ServerIO(httpServer, {
  path: "/ws",
})
Config.init()

const registry = Registry.getInstance()

console.log(`Socket server running on port ${WS_PORT}`)
httpServer.listen(WS_PORT)

io.on("connection", (socket) => {
  console.log(
    `A user connected: socketId: ${socket.id}, clientId: ${socket.handshake.auth.clientId}`,
  )

  socket.on("player:reconnect", ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, socket.handshake.auth.clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit("game:reset", "Game not found")
  })

  socket.on("manager:reconnect", ({ gameId }) => {
    const game = registry.getManagerGame(gameId, socket.handshake.auth.clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit("game:reset", "Game expired")
  })

  socket.on("manager:auth", (password) => {
    try {
      const config = Config.game()

      if (config.managerPassword === "PASSWORD") {
        socket.emit("manager:errorMessage", "Manager password is not configured")

        return
      }

      if (password !== config.managerPassword) {
        socket.emit("manager:errorMessage", "Invalid password")

        return
      }

      socket.emit("manager:quizzList", Config.quizz())
      socket.emit("manager:reverseQuizzList", Config.reverseQuizz())
      socket.emit("manager:blindCodingQuizzList", Config.blindCoding())
    } catch (error) {
      console.error("Failed to read game config:", error)
      socket.emit("manager:errorMessage", "Failed to read game config")
    }
  })

  socket.on("game:create", (quizzId) => {
    const quizzList = Config.quizz()
    const quizz = quizzList.find((q) => q.id === quizzId)

    if (!quizz) {
      socket.emit("game:errorMessage", "Quizz not found")

      return
    }


    const game = new Game(io, socket, quizz)
    registry.addGame(game)
  })

  socket.on("game:createReverse", (quizzId) => {
    const quizzList = Config.reverseQuizz()
    const quizz = quizzList.find((q) => q.id === quizzId)

    if (!quizz) {
      socket.emit("game:errorMessage", "Reverse programming challenge not found")

      return
    }

    const game = new Game(io, socket, null, quizz, "reverse_programming")
    registry.addGame(game)
  })

  socket.on("game:createBlindCoding", (quizzId) => {
    const quizzList = Config.blindCoding()
    const quizz = quizzList.find((q) => q.id === quizzId)

    if (!quizz) {
      socket.emit("game:errorMessage", "Blind coding challenge not found")

      return
    }

    const game = new Game(io, socket, null, null, "blind_coding", quizz)
    registry.addGame(game)
  })

  socket.on("player:join", (inviteCode) => {
    const result = inviteCodeValidator.safeParse(inviteCode)

    if (result.error) {
      socket.emit("game:errorMessage", result.error.issues[0].message)

      return
    }

    const game = registry.getGameByInviteCode(inviteCode)

    if (!game) {
      socket.emit("game:errorMessage", "Game not found")

      return
    }

    socket.emit("game:successRoom", game.gameId)
  })

  socket.on("player:login", ({ gameId, data }) =>
    withGame(gameId, socket, (game) => game.join(socket, data.username, data.teamName)),
  )

  socket.on("manager:kickPlayer", ({ gameId, playerId }) =>
    withGame(gameId, socket, (game) => game.kickPlayer(socket, playerId)),
  )

  socket.on("manager:startGame", ({ gameId }) =>
    withGame(gameId, socket, (game) => game.start(socket)),
  )

  socket.on("player:selectedAnswer", ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.selectAnswer(socket, data.answerKey),
    ),
  )

  socket.on("player:submitCode", ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.submitCode(socket, data.code, data.output),
    ),
  )

  socket.on("player:submitBlindCode", ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.submitBlindCode(socket, data.code, data.language),
    ),
  )

  socket.on("manager:abortQuiz", ({ gameId }) =>
    withGame(gameId, socket, (game) => game.abortRound(socket)),
  )

  socket.on("manager:nextQuestion", ({ gameId }) =>
    withGame(gameId, socket, (game) => game.nextRound(socket)),
  )

  socket.on("manager:showLeaderboard", ({ gameId }) =>
    withGame(gameId, socket, (game) => game.showLeaderboard()),
  )

  socket.on("disconnect", () => {
    console.log(`A user disconnected : ${socket.id}`)

    const managerGame = registry.getGameByManagerSocketId(socket.id)

    if (managerGame) {
      managerGame.manager.connected = false
      registry.markGameAsEmpty(managerGame)

      if (!managerGame.started) {
        console.log("Reset game (manager disconnected)")
        managerGame.abortCooldown()
        io.to(managerGame.gameId).emit("game:reset", "Manager disconnected")
        registry.removeGame(managerGame.gameId)

        return
      }
    }

    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      return
    }

    const player = game.players.find((p) => p.id === socket.id)

    if (!player) {
      return
    }

    if (!game.started) {
      game.players = game.players.filter((p) => p.id !== socket.id)

      io.to(game.manager.id).emit("manager:removePlayer", player.id)
      io.to(game.gameId).emit("game:totalPlayers", game.players.length)

      console.log(`Removed player ${player.username} from game ${game.gameId}`)

      return
    }

    player.connected = false
    io.to(game.gameId).emit("game:totalPlayers", game.players.length)
  })
})

process.on("SIGINT", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})

process.on("SIGTERM", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})
