/* eslint-disable max-params, no-plusplus, require-unicode-regexp, logical-assignment-operators, no-unused-vars, max-lines, no-inline-comments, line-comment-position, array-callback-return, no-nested-ternary, init-declarations */
import { Answer, BlindCodingQuizz, GameMode, Player, Quizz, ReverseQuizz } from "@rahoot/common/types/game"
import { Server, Socket } from "@rahoot/common/types/game/socket"
import { Status, STATUS, StatusDataMap } from "@rahoot/common/types/game/status"
import { usernameValidator } from "@rahoot/common/validators/auth"
import Registry from "@rahoot/socket/services/registry"
import { createInviteCode, timeToPoint } from "@rahoot/socket/utils/game"
import sleep from "@rahoot/socket/utils/sleep"
import { v4 as uuid } from "uuid"

const registry = Registry.getInstance()

class Game {
  io: Server

  gameId: string
  manager: {
    id: string
    clientId: string
    connected: boolean
  }
  inviteCode: string
  started: boolean

  lastBroadcastStatus: { name: Status; data: StatusDataMap[Status] } | null =
    null
  managerStatus: { name: Status; data: StatusDataMap[Status] } | null = null
  playerStatus: Map<string, { name: Status; data: StatusDataMap[Status] }> =
    new Map()

  leaderboard: Player[]
  tempOldLeaderboard: Player[] | null

  quizz: Quizz
  players: Player[]

  round: {
    currentQuestion: number
    playersAnswers: Answer[]
    startTime: number
  }

  cooldown: {
    active: boolean
    ms: number
    count?: number
  }

  playerCurrentQuestion: Record<string, number> = {}
  playerCompletionTime: Record<string, number> = {}
  playerMinCorrectTime: Record<string, number> = {}
  playerQuestionOrder: Record<string, number[]> = {}
  reverseSubmittedQuestions: Record<string, Set<number>> = {}

  gameMode: GameMode
  reverseQuizz: ReverseQuizz | null
  blindCodingQuizz: BlindCodingQuizz | null
  codeSubmissions: {
    playerId: string
    questionIndex: number
    code: string
    output: string
    correct: boolean
    points: number
  }[]
  blindCodeSubmissions: { playerId: string; username: string; code: string; language: string; submitted: boolean }[]
  allBlindCodeSubmissions: {
    question: string
    language: string
    submissions: {
      username: string
      code: string
      language: string
      submitted: boolean
    }[]
  }[]

  constructor(io: Server, socket: Socket, quizz: Quizz | null, reverseQuizz?: ReverseQuizz | null, mode: GameMode = "quiz", blindCodingQuizz?: BlindCodingQuizz | null) {
    if (!io) {
      throw new Error("Socket server not initialized")
    }

    this.io = io
    this.gameId = uuid()
    this.manager = {
      id: "",
      clientId: "",
      connected: false,
    }
    this.inviteCode = ""
    this.started = false

    this.lastBroadcastStatus = null
    this.managerStatus = null
    this.playerStatus = new Map()

    this.leaderboard = []
    this.tempOldLeaderboard = null

    this.players = []

    this.round = {
      playersAnswers: [],
      currentQuestion: 0,
      startTime: 0,
    }

    this.cooldown = {
      active: false,
      ms: 0,
    }

    this.playerCurrentQuestion = {}
    this.playerCompletionTime = {}
    this.playerMinCorrectTime = {}
    this.playerQuestionOrder = {}
    this.reverseSubmittedQuestions = {}

    this.gameMode = mode
    this.reverseQuizz = reverseQuizz || null
    this.blindCodingQuizz = blindCodingQuizz || null
    this.codeSubmissions = []
    this.blindCodeSubmissions = []
    this.allBlindCodeSubmissions = []

    // For reverse programming mode, create a compatible quizz object
    if (mode === "reverse_programming" && reverseQuizz) {
      this.quizz = {
        subject: reverseQuizz.subject,
        questions: reverseQuizz.questions.map((q) => ({
          question: `Output: ${q.output}`,
          answers: [],
          solution: 0,
          cooldown: q.cooldown,
          time: q.time,
        })),
      }
    } else if (mode === "blind_coding" && blindCodingQuizz) {
      this.quizz = {
        subject: blindCodingQuizz.subject,
        questions: blindCodingQuizz.questions.map((q) => ({
          question: q.title,
          answers: [],
          solution: 0,
          cooldown: q.cooldown,
          time: q.time,
        })),
      }
    } else {
      this.quizz = quizz!
    }

    const roomInvite = createInviteCode()
    this.inviteCode = roomInvite
    this.manager = {
      id: socket.id,
      clientId: socket.handshake.auth.clientId,
      connected: true,
    }

    socket.join(this.gameId)
    socket.emit("manager:gameCreated", {
      gameId: this.gameId,
      inviteCode: roomInvite,
    })

    console.log(
      `New game created: ${roomInvite} subject: ${this.quizz.subject} mode: ${this.gameMode}`,
    )
  }

  broadcastStatus<T extends Status>(status: T, data: StatusDataMap[T]) {
    const statusData = { name: status, data }
    this.lastBroadcastStatus = statusData
    this.io.to(this.gameId).emit("game:status", statusData)
  }

  sendStatus<T extends Status>(
    target: string,
    status: T,
    data: StatusDataMap[T],
  ) {
    const statusData = { name: status, data }

    if (this.manager.id === target) {
      this.managerStatus = statusData
    } else {
      this.playerStatus.set(target, statusData)
    }

    this.io.to(target).emit("game:status", statusData)
  }

  join(socket: Socket, username: string, teamName: string) {
    const isAlreadyConnected = this.players.find(
      (p) => p.clientId === socket.handshake.auth.clientId,
    )

    if (isAlreadyConnected) {
      socket.emit("game:errorMessage", "Player already connected")

      return
    }

    const usernameResult = usernameValidator.safeParse(username)

    if (usernameResult.error) {
      socket.emit("game:errorMessage", usernameResult.error.issues[0].message)

      return
    }

    // Removed team name validation, defaulting to username if empty
    const finalTeamName = teamName.trim() ? teamName : username

    socket.join(this.gameId)

    const playerData = {
      id: socket.id,
      clientId: socket.handshake.auth.clientId,
      connected: true,
      username,
      teamName: finalTeamName,
      points: 0,
    }

    this.players.push(playerData)

    this.io.to(this.manager.id).emit("manager:newPlayer", playerData)
    this.io.to(this.gameId).emit("game:totalPlayers", this.players.length)

    socket.emit("game:successJoin", this.gameId)
  }

  kickPlayer(socket: Socket, playerId: string) {
    if (this.manager.id !== socket.id) {
      return
    }

    const player = this.players.find((p) => p.id === playerId)

    if (!player) {
      return
    }

    this.players = this.players.filter((p) => p.id !== playerId)
    this.playerStatus.delete(playerId)

    this.io.in(playerId).socketsLeave(this.gameId)
    this.io
      .to(player.id)
      .emit("game:reset", "You have been kicked by the manager")
    this.io.to(this.manager.id).emit("manager:playerKicked", player.id)

    this.io.to(this.gameId).emit("game:totalPlayers", this.players.length)
  }

  reconnect(socket: Socket) {
    const { clientId } = socket.handshake.auth
    const isManager = this.manager.clientId === clientId

    if (isManager) {
      this.reconnectManager(socket)
    } else {
      this.reconnectPlayer(socket)
    }
  }

  private reconnectManager(socket: Socket) {
    if (this.manager.connected) {
      socket.emit("game:reset", "Manager already connected")

      return
    }

    socket.join(this.gameId)
    this.manager.id = socket.id
    this.manager.connected = true

    const status = this.managerStatus ||
      this.lastBroadcastStatus || {
        name: STATUS.WAIT,
        data: { text: "Waiting for players" },
      }

    socket.emit("manager:successReconnect", {
      gameId: this.gameId,
      currentQuestion: {
        current: this.round.currentQuestion + 1,
        total: this.quizz.questions.length,
      },
      status,
      players: this.players,
    })
    socket.emit("game:totalPlayers", this.players.length)

    registry.reactivateGame(this.gameId)
    console.log(`Manager reconnected to game ${this.inviteCode}`)
  }

  private reconnectPlayer(socket: Socket) {
    const { clientId } = socket.handshake.auth
    const player = this.players.find((p) => p.clientId === clientId)

    if (!player) {
      return
    }

    if (player.connected) {
      socket.emit("game:reset", "Player already connected")

      return
    }

    socket.join(this.gameId)

    const oldSocketId = player.id
    player.id = socket.id
    player.connected = true

    const status = this.playerStatus.get(oldSocketId) ||
      this.lastBroadcastStatus || {
        name: STATUS.WAIT,
        data: { text: "Waiting for players" },
      }

    if (this.playerStatus.has(oldSocketId)) {
      const oldStatus = this.playerStatus.get(oldSocketId)!
      this.playerStatus.delete(oldSocketId)
      this.playerStatus.set(socket.id, oldStatus)
    }

    socket.emit("player:successReconnect", {
      gameId: this.gameId,
      currentQuestion: {
        current: this.round.currentQuestion + 1,
        total: this.quizz.questions.length,
      },
      status,
      player: {
        username: player.username,
        points: player.points,
      },
    })
    socket.emit("game:totalPlayers", this.players.length)
    console.log(
      `Player ${player.username} reconnected to game ${this.inviteCode}`,
    )
  }

  startCooldown(seconds: number): Promise<void> {
    if (this.cooldown.active) {
      return Promise.resolve()
    }

    this.cooldown.active = true
    let count = seconds - 1

    return new Promise<void>((resolve) => {
      const cooldownTimeout = setInterval(() => {
        if (!this.cooldown.active || count <= 0) {
          this.cooldown.active = false
          clearInterval(cooldownTimeout)
          resolve()

          return
        }

        this.io.to(this.gameId).emit("game:cooldown", count)
        count -= 1
        this.cooldown.count = count
      }, 1000)
    })
  }

  abortCooldown() {
    this.cooldown.active &&= false
  }

  async start(socket: Socket) {
    if (this.manager.id !== socket.id) {
      return
    }

    if (this.started) {
      return
    }

    if (this.players.length === 0) {
      socket.emit("game:errorMessage", "No players connected")

      return
    }

    this.started = true

    this.broadcastStatus(STATUS.SHOW_START, {
      time: 3,
      subject: this.quizz.subject,
    })

    await sleep(3)

    this.io.to(this.gameId).emit("game:startCooldown")
    await this.startCooldown(3)

    if (this.gameMode === "reverse_programming") {
      this.newReverseRound()
    } else if (this.gameMode === "blind_coding") {
      this.startAsyncBlindCoding()
    } else {
      this.newRound()
    }
  }

  async newRound() {
    const question = this.quizz.questions[this.round.currentQuestion]

    if (!this.started) {
      return
    }

    this.playerStatus.clear()

    this.io.to(this.gameId).emit("game:updateQuestion", {
      current: this.round.currentQuestion + 1,
      total: this.quizz.questions.length,
    })

    this.managerStatus = null
    this.broadcastStatus(STATUS.SHOW_PREPARED, {
      totalAnswers: question.answers.length,
      questionNumber: this.round.currentQuestion + 1,
    })

    await sleep(2)

    if (!this.started) {
      return
    }

    this.broadcastStatus(STATUS.SHOW_QUESTION, {
      question: question.question,
      image: question.image,
      cooldown: question.cooldown,
    })

    await sleep(question.cooldown)

    if (!this.started) {
      return
    }

    this.round.startTime = Date.now()

    this.broadcastStatus(STATUS.SELECT_ANSWER, {
      question: question.question,
      answers: question.answers,
      image: question.image,
      video: question.video,
      audio: question.audio,
      time: question.time,
      totalPlayer: this.players.length,
    })

    await this.startCooldown(question.time)

    if (!this.started) {
      return
    }

    this.showResults(question)
  }

  async newReverseRound() {
    if (!this.reverseQuizz) {
      return
    }

    const question = this.reverseQuizz.questions[this.round.currentQuestion]

    if (!this.started) {
      return
    }

    // Initialize random question orders for players if not done yet
    if (Object.keys(this.playerQuestionOrder).length === 0) {
      this.players.forEach(p => {
        const indices = this.reverseQuizz!.questions.map((_, i) => i)
        // Shuffle indices using Fisher-Yates
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]]
        }
        this.playerQuestionOrder[p.id] = indices
      })
    }

    this.playerStatus.clear()
    this.codeSubmissions = []
    this.reverseSubmittedQuestions = {}

    this.io.to(this.gameId).emit("game:updateQuestion", {
      current: this.round.currentQuestion + 1,
      total: this.reverseQuizz.questions.length,
    })

    this.managerStatus = null
    this.broadcastStatus(STATUS.SHOW_PREPARED, {
      totalAnswers: 0,
      questionNumber: this.round.currentQuestion + 1,
    })

    await sleep(2)

    if (!this.started) {
      return
    }

    this.broadcastStatus(STATUS.SHOW_QUESTION, {
      question: `Write code that produces this output`,
      cooldown: question.cooldown,
    })

    await sleep(question.cooldown)

    if (!this.started) {
      return
    }

    this.round.startTime = Date.now()

    this.players.forEach(p => {
      const pIndices = this.playerQuestionOrder[p.id]
      let qIndex = 0

      if (pIndices && pIndices.length > this.round.currentQuestion) {
        qIndex = pIndices[this.round.currentQuestion]
      }

      this.playerCurrentQuestion[p.id] = qIndex
      this.sendPlayerReverseQuestion(p.id)
    })

    // Manager status should just be generic for the ROUND
    this.sendStatus(this.manager.id, STATUS.REVERSE_WRITE_CODE, {
      output: "Multi-Question Random Assignment...",
      language: "multi",
      hint: "",
      time: question.time,
      totalPlayer: this.players.length,
    })

    await this.startCooldown(question.time)

    if (!this.started) {
      return
    }

    this.showReverseResults(question)
  }

  sendPlayerReverseQuestion(playerId: string) {
    const player = this.players.find((p) => p.id === playerId)

    if (!player || !this.reverseQuizz) {
      return
    }

    const qIndex = this.playerCurrentQuestion[playerId] ?? 0

    if (qIndex < 0 || qIndex >= this.reverseQuizz.questions.length) {
      return
    }

    const question = this.reverseQuizz.questions[qIndex]
    const remainingTime = this.cooldown.count || question.time

    this.sendStatus(playerId, STATUS.REVERSE_WRITE_CODE, {
      output: question.output,
      language: question.language,
      hint: question.hint,
      time: remainingTime,
      totalPlayer: this.players.length,
    })

    this.io.to(playerId).emit("game:updateQuestion", {
      current: qIndex + 1,
      total: this.reverseQuizz.questions.length,
    })
  }

  navigateReverseQuestion(socket: Socket, direction: "prev" | "next") {
    const player = this.players.find((p) => p.id === socket.id)

    if (!player || !this.reverseQuizz || !this.started || this.gameMode !== "reverse_programming") {
      return
    }

    const currentIndex = this.playerCurrentQuestion[player.id] ?? 0
    const offset = direction === "next" ? 1 : -1
    const targetIndex = Math.min(
      Math.max(currentIndex + offset, 0),
      this.reverseQuizz.questions.length - 1,
    )

    if (targetIndex === currentIndex) {
      return
    }

    this.playerCurrentQuestion[player.id] = targetIndex
    this.sendPlayerReverseQuestion(player.id)
  }

  submitCode(socket: Socket, code: string, output: string) {
    const player = this.players.find((player) => player.id === socket.id)

    if (!player) {
      return
    }

    if (!this.reverseQuizz) {
      return
    }

    const pIndex = this.playerCurrentQuestion[player.id] !== undefined 
      ? this.playerCurrentQuestion[player.id] 
      : this.round.currentQuestion

    const submittedForPlayer =
      this.reverseSubmittedQuestions[player.id] ?? new Set<number>()
    if (submittedForPlayer.has(pIndex)) {
      return
    }
      
    const question = this.reverseQuizz.questions[pIndex]

    // Ultra-forgiving normalization: remove ALL spaces, newlines, and make lowercase
    // This way "Sum: 15", "sum:15", "SUM  :  15\n" all match correctly!
    const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase()

    const expectedOutput = normalize(question.output)
    const playerOutput = normalize(output)
    const isCorrect = playerOutput === expectedOutput

    console.log(`[COMPARE] Expected: [${expectedOutput}]`)
    console.log(`[COMPARE] Player:   [${playerOutput}]`)
    console.log(`[COMPARE] Match: ${isCorrect}`)

    const points = isCorrect ? Math.round(timeToPoint(this.round.startTime, question.time)) : 0

    const timeTaken = Math.round((Date.now() - this.round.startTime) / 1000)

    // Track minimum time taken to submit a correct solution across reverse rounds.
    if (isCorrect) {
      const prevMin = this.playerMinCorrectTime[player.id]
      this.playerMinCorrectTime[player.id] = prevMin
        ? Math.min(prevMin, timeTaken)
        : timeTaken
      player.completionTime = this.playerMinCorrectTime[player.id]
    }

    this.codeSubmissions.push({
      playerId: player.id,
      questionIndex: pIndex,
      code,
      output: playerOutput,
      correct: isCorrect,
      points,
    })
    submittedForPlayer.add(pIndex)
    this.reverseSubmittedQuestions[player.id] = submittedForPlayer

    // Immediately process points for the submitting player
    if (isCorrect) {
      player.points += points
    }

    // Notify the manager explicitly that this specific player submitted real-time
    this.io.to(this.manager.id).emit("manager:playerSubmitted", {
      playerId: player.id,
      username: player.username,
      completionTime: player.completionTime ?? null,
      points: player.points,
      isCorrect,
    })

    const currentIndex = this.playerCurrentQuestion[player.id] ?? pIndex
    const hasNext = currentIndex < this.reverseQuizz.questions.length - 1

    if (hasNext) {
      this.playerCurrentQuestion[player.id] = currentIndex + 1
      this.sendPlayerReverseQuestion(player.id)
    } else {
      this.sendStatus(player.id, STATUS.WAIT, {
        text: "Submission received. Waiting for round results.",
      })
    }

    socket
      .to(this.gameId)
      .emit("game:playerAnswer", this.codeSubmissions.length)

    this.io.to(this.gameId).emit("game:totalPlayers", this.players.length)

    // Keep the reverse round running until the configured timer ends.
    // Even if all students submit early, results should only finalize at timeout.
  }

  showReverseResults(question: any) {
    const oldLeaderboard =
      this.leaderboard.length === 0
        ? this.players.map((p) => ({ ...p }))
        : this.leaderboard.map((p) => ({ ...p }))

    const totalCorrect = this.codeSubmissions.filter((s) => s.correct).length
    const totalWrong = this.codeSubmissions.filter((s) => !s.correct).length

    // Points are already awarded at submission time (instant feedback),
    // so here we only compute rankings without re-adding points.
    const sortedPlayers = this.players
      .map((player) => {
        const playerSubmissions = this.codeSubmissions.filter(
          (s) => s.playerId === player.id,
        )
        const submission = playerSubmissions[playerSubmissions.length - 1]

        const isCorrect = submission ? submission.correct : false
        const points = submission && isCorrect ? Math.round(submission.points) : 0

        return { ...player, lastCorrect: isCorrect, lastPoints: points }
      })
      .sort((a, b) => {
        // Primary: more points wins
        if (b.points !== a.points) {return b.points - a.points}

        // Tiebreaker: less total time wins
        const aTime = a.completionTime || Infinity
        const bTime = b.completionTime || Infinity

        
return aTime - bTime
      })

    this.players = sortedPlayers

    sortedPlayers.forEach((player) => {
      this.sendStatus(player.id, STATUS.WAIT, {
        text: "Wait for the result",
      })
    })

    this.sendStatus(this.manager.id, STATUS.REVERSE_SHOW_RESPONSES, {
      output: "Randomized questions provided to players",
      expectedCode: "Evaluate individual submissions for codes",
      language: "multi",
      totalCorrect,
      totalWrong,
      totalPlayers: this.players.length,
    })

    this.leaderboard = sortedPlayers
    this.tempOldLeaderboard = oldLeaderboard

    this.codeSubmissions = []

    // Auto transition to the Leaderboard showing everyone's time
    setTimeout(() => {
      if (!this.started || this.gameMode !== "reverse_programming" || !this.reverseQuizz) {
        return
      }

      this.showLeaderboard()
    }, 4000)
  }

  async startAsyncBlindCoding() {
    if (!this.blindCodingQuizz) {return}

    this.started = true
    this.playerStatus.clear()
    
    // Initialize history data structure for all questions
    this.allBlindCodeSubmissions = this.blindCodingQuizz.questions.map(q => ({
      question: q.title,
      language: q.language,
      submissions: []
    }))

    // Start each player at question index 0
    this.players.forEach(p => {
      this.playerCurrentQuestion[p.id] = 0
      this.playerCompletionTime[p.id] = 0 // 0 means not finished yet
    })

    // Start global 1 hr cooldown for the test (3600 secs)
    this.round.startTime = Date.now()
    this.io.to(this.gameId).emit("game:updateQuestion", { current: 1, total: this.blindCodingQuizz.questions.length })
    
    // Notify manager that test is proceeding independently 
    this.sendStatus(this.manager.id, STATUS.WAIT, {
      text: "Asynchronous Test in Progress (1 Hr)... Waiting for players to complete.",
    })

    // Dispatch questions to players
    this.players.forEach(p => this.sendPlayerNextBlindQuestion(p.id))

    await this.startCooldown(3600)

    if (!this.started) {return}

    // Sort players by completion time (fastest first)
    // Players who didn't finish get Infinity so they rank last
    this.players.sort((a, b) => {
      const aTime = this.playerCompletionTime[a.id] || Infinity
      const bTime = this.playerCompletionTime[b.id] || Infinity

      
return aTime - bTime
    })
    this.leaderboard = this.players

    this.showLeaderboard()
  }

  sendPlayerNextBlindQuestion(playerId: string) {
    const player = this.players.find(p => p.id === playerId)

    if (!player || !this.blindCodingQuizz) {return}

    const pIndex = this.playerCurrentQuestion[playerId]
    
    if (pIndex >= this.blindCodingQuizz.questions.length) {
      this.sendStatus(playerId, STATUS.WAIT, { text: "Test completed. Waiting for other players." })

      
return
    }

    const question = this.blindCodingQuizz.questions[pIndex]
    const remainingTime = this.cooldown.count || 3600

    this.sendStatus(playerId, STATUS.BLIND_CODING_WRITE, {
      title: question.title,
      description: question.description,
      examples: question.examples,
      constraints: question.constraints,
      language: question.language,
      time: remainingTime,
      totalPlayer: this.players.length,
    })

    this.io.to(playerId).emit("game:updateQuestion", {
      current: pIndex + 1,
      total: this.blindCodingQuizz.questions.length,
    })
  }

  navigateBlindQuestion(socket: Socket, direction: "prev" | "next") {
    const player = this.players.find((p) => p.id === socket.id)

    if (!player || !this.blindCodingQuizz || !this.started || this.gameMode !== "blind_coding") {
      return
    }

    const currentIndex = this.playerCurrentQuestion[player.id] ?? 0
    const offset = direction === "next" ? 1 : -1
    const targetIndex = Math.min(
      Math.max(currentIndex + offset, 0),
      this.blindCodingQuizz.questions.length - 1,
    )

    if (targetIndex === currentIndex) {
      return
    }

    this.playerCurrentQuestion[player.id] = targetIndex
    this.sendPlayerNextBlindQuestion(player.id)
  }

  submitBlindCode(socket: Socket, code: string, language: string) {
    const player = this.players.find((player) => player.id === socket.id)

    if (!player || !this.blindCodingQuizz) {return}

    const pIndex = this.playerCurrentQuestion[player.id]

    if (pIndex === undefined || pIndex >= this.blindCodingQuizz.questions.length) {return}

    // Save submission to global history
    const historyEntry = this.allBlindCodeSubmissions[pIndex]

    if (!historyEntry.submissions.find(s => s.username === player.username)) {
      historyEntry.submissions.push({
        username: player.username,
        code,
        language,
        submitted: true,
      })
    }

    // Move to the next question index after this submission.
    this.playerCurrentQuestion[player.id]++

    // Check if this player just finished ALL questions
    const justFinished = this.playerCurrentQuestion[player.id] >= this.blindCodingQuizz.questions.length

    if (justFinished && !this.playerCompletionTime[player.id]) {
      // Record elapsed time in seconds since test started
      this.playerCompletionTime[player.id] = Math.round((Date.now() - this.round.startTime) / 1000)
    }

    // Send brief result feedback
    this.sendStatus(player.id, STATUS.SHOW_RESULT, {
      correct: true,
      message: "Code submitted!",
      points: 0,
      myPoints: 0,
      rank: 0,
      aheadOfMe: null,
      hideRank: true,
      hidePoints: true,
    })

    // Keep current flow: brief feedback, then continue to the next question.
    setTimeout(() => {
      if (!this.started) {return}

      this.sendPlayerNextBlindQuestion(player.id)

      const allDone = this.players.every(p => (this.playerCurrentQuestion[p.id] || 0) >= this.blindCodingQuizz!.questions.length)

      if (allDone) {
        this.abortCooldown()
      }
    }, 2000)
  }

  submitAllBlindCodes(socket: Socket, submissions: Record<number, { code: string; language: string }>) {
    const player = this.players.find((player) => player.id === socket.id)

    if (!player || !this.blindCodingQuizz) {return}

    // Process all submissions
    for (const [indexStr, sub] of Object.entries(submissions)) {
      const pIndex = parseInt(indexStr) - 1; // questionStates.current is 1-indexed

      if (isNaN(pIndex) || pIndex < 0 || pIndex >= this.blindCodingQuizz.questions.length) {
        continue;
      }

      const historyEntry = this.allBlindCodeSubmissions[pIndex];
      let existingSub = historyEntry.submissions.find(s => s.username === player.username);

      if (!existingSub) {
        historyEntry.submissions.push({
          username: player.username,
          code: sub.code,
          language: sub.language,
          submitted: true,
        });
      } else {
        existingSub.code = sub.code;
        existingSub.language = sub.language;
        existingSub.submitted = true;
      }
    }

    // Mark player as completely done
    this.playerCurrentQuestion[player.id] = this.blindCodingQuizz.questions.length;
    
    if (!this.playerCompletionTime[player.id]) {
      this.playerCompletionTime[player.id] = Math.round((Date.now() - this.round.startTime) / 1000);
    }

    this.sendStatus(player.id, STATUS.SHOW_RESULT, {
      correct: true,
      message: "All answers submitted successfully!",
      points: 0,
      myPoints: 0,
      rank: 0,
      aheadOfMe: null,
      hideRank: true,
      hidePoints: true,
    });

    const allDone = this.players.every(p => (this.playerCurrentQuestion[p.id] || 0) >= this.blindCodingQuizz!.questions.length);

    if (allDone) {
      this.abortCooldown();
    }
  }

  showResults(question: any) {
    const oldLeaderboard =
      this.leaderboard.length === 0
        ? this.players.map((p) => ({ ...p }))
        : this.leaderboard.map((p) => ({ ...p }))

    const totalType = this.round.playersAnswers.reduce(
      (acc: Record<number, number>, { answerId }) => {
        acc[answerId] = (acc[answerId] || 0) + 1

        return acc
      },
      {},
    )

    const sortedPlayers = this.players
      .map((player) => {
        const playerAnswer = this.round.playersAnswers.find(
          (a) => a.playerId === player.id,
        )

        const isCorrect = playerAnswer
          ? playerAnswer.answerId === question.solution
          : false

        const points =
          playerAnswer && isCorrect ? Math.round(playerAnswer.points) : 0

        player.points += points

        return { ...player, lastCorrect: isCorrect, lastPoints: points }
      })
      .sort((a, b) => b.points - a.points)

    this.players = sortedPlayers

    sortedPlayers.forEach((player, index) => {
      const rank = index + 1
      const aheadPlayer = sortedPlayers[index - 1]

      this.sendStatus(player.id, STATUS.SHOW_RESULT, {
        correct: player.lastCorrect,
        message: player.lastCorrect ? "Nice!" : "Too bad",
        points: player.lastPoints,
        myPoints: player.points,
        rank,
        aheadOfMe: aheadPlayer ? aheadPlayer.username : null,
      })
    })

    this.sendStatus(this.manager.id, STATUS.SHOW_RESPONSES, {
      question: question.question,
      responses: totalType,
      correct: question.solution,
      answers: question.answers,
      image: question.image,
    })

    this.leaderboard = sortedPlayers
    this.tempOldLeaderboard = oldLeaderboard

    this.round.playersAnswers = []

    // Auto transition
    setTimeout(() => {
      if (!this.started || this.gameMode !== "quiz" || !this.quizz) {
        return
      }

      if (this.quizz.questions[this.round.currentQuestion + 1]) {
        this.round.currentQuestion += 1
        this.newRound()
      } else {
        this.showLeaderboard()
      }
    }, 4000)
  }
  selectAnswer(socket: Socket, answerId: number) {
    const player = this.players.find((player) => player.id === socket.id)
    const question = this.quizz.questions[this.round.currentQuestion]

    if (!player) {
      return
    }

    if (this.round.playersAnswers.find((p) => p.playerId === socket.id)) {
      return
    }

    this.round.playersAnswers.push({
      playerId: player.id,
      answerId,
      points: timeToPoint(this.round.startTime, question.time),
    })

    this.sendStatus(socket.id, STATUS.WAIT, {
      text: "Waiting for the players to answer",
    })

    socket
      .to(this.gameId)
      .emit("game:playerAnswer", this.round.playersAnswers.length)

    this.io.to(this.gameId).emit("game:totalPlayers", this.players.length)

    if (this.round.playersAnswers.length === this.players.length) {
      this.abortCooldown()
    }
  }

  nextRound(socket: Socket) {
    if (!this.started) {
      return
    }

    if (socket.id !== this.manager.id) {
      return
    }

    if (this.gameMode === "reverse_programming" && this.reverseQuizz) {
      if (!this.reverseQuizz.questions[this.round.currentQuestion + 1]) {
        this.showLeaderboard()

        
return
      }

      this.round.currentQuestion += 1
      this.newReverseRound()

      return
    }



    if (!this.quizz.questions[this.round.currentQuestion + 1]) {
      this.showLeaderboard()

      
return
    }

    this.round.currentQuestion += 1
    this.newRound()
  }

  abortRound(socket: Socket) {
    if (!this.started) {
      return
    }

    if (socket.id !== this.manager.id) {
      return
    }

    this.abortCooldown()
  }

  showLeaderboard() {
    const totalQuestions = this.gameMode === "reverse_programming" && this.reverseQuizz
      ? this.reverseQuizz.questions.length
      : this.gameMode === "blind_coding" && this.blindCodingQuizz
        ? this.blindCodingQuizz.questions.length
        : this.quizz.questions.length

    const isLastRound =
      this.gameMode === "blind_coding" || this.round.currentQuestion + 1 === totalQuestions

    if (isLastRound) {
      this.started = false

      // For blind coding, build per-player result view
      let blindPlayerResults: { username: string; completionTime: number; answers: { question: string; code: string; language: string; submitted: boolean }[] }[] | undefined

      if (this.gameMode === "blind_coding" && this.blindCodingQuizz) {
        blindPlayerResults = this.leaderboard.map(player => {
          const completionTime = this.playerCompletionTime[player.id] || 0
          const answers = this.allBlindCodeSubmissions.map(entry => {
            const sub = entry.submissions.find(s => s.username === player.username)

            
return {
              question: entry.question,
              code: sub ? sub.code : "",
              language: sub ? sub.language : entry.language,
              submitted: sub ? sub.submitted : false,
            }
          })

          
return { username: player.username, completionTime, answers }
        })
      }

      this.broadcastStatus(STATUS.FINISHED, {
        subject: this.quizz.subject,
        top: this.leaderboard,
        blindSubmissionsHistory: this.gameMode === "blind_coding" ? this.allBlindCodeSubmissions : undefined,
        blindPlayerResults,
      })

      return
    }

    const oldLeaderboard = this.tempOldLeaderboard
      ? this.tempOldLeaderboard
      : this.leaderboard

    this.sendStatus(this.manager.id, STATUS.SHOW_LEADERBOARD, {
      oldLeaderboard,
      leaderboard: this.leaderboard,
    })

    this.tempOldLeaderboard = null
  }
}

export default Game
