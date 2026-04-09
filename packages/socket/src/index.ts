import { Server } from "@rahoot/common/types/game/socket"
import { inviteCodeValidator } from "@rahoot/common/validators/auth"
import Config from "@rahoot/socket/services/config"
import Game from "@rahoot/socket/services/game"
import Registry from "@rahoot/socket/services/registry"
import { withGame } from "@rahoot/socket/utils/game"
import { mkdtemp, rm, writeFile } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { Server as ServerIO } from "socket.io"
import { createServer } from "http"
import { spawn } from "child_process"

const WS_PORT = 3001

const EXECUTION_TIMEOUT_MS = 30000

type ExecutionResult = {
  stdout: string
  stderr: string
  code: number
}

type LocalExecutionResponse = {
  compile: null | { code: number; output: string }
  run: { stdout: string; stderr: string; signal: string | null; code: number }
}

const normalizeLanguage = (lang: string) =>
  lang === "cpp" ? "c++" : lang

const runCommand = (
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = EXECUTION_TIMEOUT_MS,
) =>
  new Promise<ExecutionResult>((resolve) => {
    const child = spawn(command, args, { cwd, windowsHide: true })
    let stdout = ""
    let stderr = ""
    let killedByTimeout = false

    const timer = setTimeout(() => {
      killedByTimeout = true
      child.kill()
    }, timeoutMs)

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({
        stdout: "",
        stderr: `Failed to run ${command}: ${error.message}`,
        code: 1,
      })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({
        stdout,
        stderr: killedByTimeout
          ? `${stderr}\nExecution timed out after ${timeoutMs / 1000}s`
          : stderr,
        code: killedByTimeout ? 1 : (code ?? 1),
      })
    })
  })

const runCommandWithFallback = async (
  commands: Array<{ command: string; args: string[] }>,
  cwd: string,
  timeoutMs = EXECUTION_TIMEOUT_MS,
) => {
  let lastResult: ExecutionResult | null = null

  for (const option of commands) {
    const result = await runCommand(option.command, option.args, cwd, timeoutMs)
    lastResult = result
    if (!result.stderr.includes("Failed to run")) {
      return result
    }
  }

  return (
    lastResult || {
      stdout: "",
      stderr: "Failed to run local command",
      code: 1,
    }
  )
}

const executeLocally = async (
  lang: string,
  code: string,
): Promise<LocalExecutionResponse> => {
  const normalizedLang = normalizeLanguage(lang)
  const tempDir = await mkdtemp(join(tmpdir(), "hackhunt-"))

  try {
    switch (normalizedLang) {
      case "python": {
        const filePath = join(tempDir, "main.py")
        await writeFile(filePath, code, "utf8")
        const run = await runCommandWithFallback(
          [
            { command: "python", args: [filePath] },
            { command: "py", args: [filePath] },
          ],
          tempDir,
        )

        return {
          compile: null,
          run: { stdout: run.stdout, stderr: run.stderr, signal: null, code: run.code },
        }
      }
      case "javascript": {
        const filePath = join(tempDir, "main.js")
        await writeFile(filePath, code, "utf8")
        const run = await runCommand("node", [filePath], tempDir)

        return {
          compile: null,
          run: { stdout: run.stdout, stderr: run.stderr, signal: null, code: run.code },
        }
      }
      case "c": {
        const sourcePath = join(tempDir, "main.c")
        const outputPath = join(tempDir, process.platform === "win32" ? "main.exe" : "main")
        await writeFile(sourcePath, code, "utf8")
        const compile = await runCommand("gcc", [sourcePath, "-o", outputPath], tempDir)
        if (compile.code !== 0) {
          return {
            compile: { code: compile.code, output: compile.stderr || compile.stdout },
            run: { stdout: "", stderr: "", signal: null, code: 1 },
          }
        }
        const run = await runCommand(outputPath, [], tempDir)

        return {
          compile: null,
          run: { stdout: run.stdout, stderr: run.stderr, signal: null, code: run.code },
        }
      }
      case "c++": {
        const sourcePath = join(tempDir, "main.cpp")
        const outputPath = join(tempDir, process.platform === "win32" ? "main.exe" : "main")
        await writeFile(sourcePath, code, "utf8")
        const compile = await runCommand("g++", [sourcePath, "-o", outputPath], tempDir)
        if (compile.code !== 0) {
          return {
            compile: { code: compile.code, output: compile.stderr || compile.stdout },
            run: { stdout: "", stderr: "", signal: null, code: 1 },
          }
        }
        const run = await runCommand(outputPath, [], tempDir)

        return {
          compile: null,
          run: { stdout: run.stdout, stderr: run.stderr, signal: null, code: run.code },
        }
      }
      case "java": {
        const sourcePath = join(tempDir, "Main.java")
        await writeFile(sourcePath, code, "utf8")
        const compile = await runCommand("javac", [sourcePath], tempDir)
        if (compile.code !== 0) {
          return {
            compile: { code: compile.code, output: compile.stderr || compile.stdout },
            run: { stdout: "", stderr: "", signal: null, code: 1 },
          }
        }
        const run = await runCommand("java", ["-cp", tempDir, "Main"], tempDir)

        return {
          compile: null,
          run: { stdout: run.stdout, stderr: run.stderr, signal: null, code: run.code },
        }
      }
      case "go": {
        const sourcePath = join(tempDir, "main.go")
        await writeFile(sourcePath, code, "utf8")
        const run = await runCommand("go", ["run", sourcePath], tempDir)

        return {
          compile: null,
          run: { stdout: run.stdout, stderr: run.stderr, signal: null, code: run.code },
        }
      }
      default: {
        return {
          compile: null,
          run: {
            stdout: "",
            stderr: `Unsupported language: ${normalizedLang}`,
            signal: null,
            code: 1,
          },
        }
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
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
        const normalizedLang = normalizeLanguage(lang)
        console.log(`Executing ${normalizedLang} code with local compiler/runtime...`)
        const pistonResponse = await executeLocally(normalizedLang, code)

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

  socket.on("player:navigateReverseQuestion", ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.navigateReverseQuestion(socket, data.direction),
    ),
  )

  socket.on("player:submitBlindCode", ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.submitBlindCode(socket, data.code, data.language),
    ),
  )

  socket.on("player:submitAllBlindCodes", ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.submitAllBlindCodes(socket, data.submissions),
    ),
  )

  socket.on("player:navigateBlindQuestion", ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.navigateBlindQuestion(socket, data.direction),
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
