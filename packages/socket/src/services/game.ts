/* eslint-disable max-params, no-plusplus, require-unicode-regexp, logical-assignment-operators, no-unused-vars, max-lines, no-inline-comments, line-comment-position, array-callback-return, no-nested-ternary, init-declarations */
import { Answer, BlindCodingQuizz, GameMode, Player, Quizz, ReverseQuizz } from "@rahoot/common/types/game"
import { Server, Socket } from "@rahoot/common/types/game/socket"
import { Status, STATUS, StatusDataMap } from "@rahoot/common/types/game/status"
import { usernameValidator } from "@rahoot/common/validators/auth"
import Registry from "@rahoot/socket/services/registry"
import { createInviteCode, timeToPoint } from "@rahoot/socket/utils/game"
import sleep from "@rahoot/socket/utils/sleep"
import { v4 as uuid } from "uuid"
import { Participant, Submission } from "./db"

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
  quizzFinishedPlayers = new Set<string>()

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
    this.allBlindCodeSubmissions = []

    // For reverse programming mode, create a compatible quizz object
    if (mode === "reverse_programming" && reverseQuizz) {
      this.quizz = {
        subject: reverseQuizz.subject,
        questions: reverseQuizz.questions.map((q) => ({
          id: q.id,
          question: `Output: ${q.output}`,
          answers: [],
          solution: 0,
          cooldown: q.cooldown,
          time: q.time,
        })),
      } as Quizz
    } else if (mode === "blind_coding" && blindCodingQuizz) {
      this.quizz = {
        subject: blindCodingQuizz.subject,
        questions: blindCodingQuizz.questions.map((q) => ({
          id: q.id,
          question: q.title,
          answers: [],
          solution: 0,
          cooldown: q.cooldown,
          time: q.time,
        })),
      } as Quizz
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

  join(socket: Socket, username: string, teamName: string, year?: number) {
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
      year: year || 1,
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

    // Save participants to DB
    try {
      const dbParticipants = this.players.map(p => ({
        participantId: p.id,
        username: p.username,
        eventType: this.gameMode || "quiz",
        year: null,
        startTime: Date.now(),
        durationMinutes: 40
      }));
      // Upsert to handle disconnects/reconnects gracefully if necessary
      for (const dp of dbParticipants) {
        await Participant.findOneAndUpdate(
          { participantId: dp.participantId },
          { $set: dp },
          { upsert: true }
        );
      }
    } catch (dbErr) {
      console.error("Failed to save participants to DB:", dbErr);
    }

    if (this.gameMode === "reverse_programming") {
      this.newReverseRound()
    } else if (this.gameMode === "blind_coding") {
      this.startAsyncBlindCoding()
    } else {
      this.startAsyncQuizz()
    }
  }

  async startAsyncQuizz() {
    if (!this.quizz) { return }

    if (!this.started) { return }

    this.playerStatus.clear()
    this.round.playersAnswers = []
    this.quizzFinishedPlayers = new Set<string>()

    this.players.forEach(p => {
      this.playerCurrentQuestion[p.id] = 0
    })

    this.io.to(this.gameId).emit("game:updateQuestion", {
      current: 1,
      total: this.quizz.questions.length,
    })

    this.managerStatus = null
    this.broadcastStatus(STATUS.SHOW_PREPARED, {
      totalAnswers: 0,
      questionNumber: 1,
    })

    await sleep(2)

    if (!this.started) { return }

    this.broadcastStatus(STATUS.SHOW_QUESTION, {
      question: "Async Quizz Challenge...",
      cooldown: 3,
    })

    await sleep(3)

    if (!this.started) { return }

    this.round.startTime = Date.now()

    this.players.forEach(p => {
      this.sendPlayerQuizzQuestion(p.id)
    })

    this.sendManagerQuizzLeaderboard()

    await this.startCooldown(2400)

    if (!this.started) { return }

    this.showQuizzLeaderboard()
  }

  sendManagerQuizzLeaderboard() {
    const currentLeaderboard = this.leaderboard
    this.sendStatus(this.manager.id, STATUS.SHOW_LEADERBOARD, {
      oldLeaderboard: currentLeaderboard,
      leaderboard: currentLeaderboard,
      isQuizz: true,
    })
  }

  showQuizzLeaderboard() {
    const totalQuestions = this.quizz.questions.length

    const sortedPlayers = this.players.map(p => {
      const playerAnswers = this.round.playersAnswers.filter(a => a.playerId === p.id)
      const points = playerAnswers.reduce((acc, curr) => acc + curr.points, 0)
      const correctAnswers = playerAnswers.filter(a => a.points > 0).length
      const timeTakenSeconds = this.playerCompletionTime[p.id] || 2400
      return { ...p, points, correctAnswers, timeTakenSeconds }
    }).sort((a, b) => {
      // Sort by points descending, then by time ascending (minimum time first)
      if (b.points !== a.points) return b.points - a.points
      return a.timeTakenSeconds - b.timeTakenSeconds
    })

    this.leaderboard = sortedPlayers
    this.players = sortedPlayers

    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = seconds % 60
      if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`
      return `${m}m ${s.toString().padStart(2, "0")}s`
    }

    const quizzResults = sortedPlayers.map((p, idx) => ({
      rank: idx + 1,
      username: p.username,
      teamName: p.teamName,
      correctAnswers: (p as any).correctAnswers,
      totalQuestions,
      totalPoints: p.points,
      timeTaken: formatTime((p as any).timeTakenSeconds),
      timeTakenSeconds: (p as any).timeTakenSeconds,
    }))

    this.started = false
    this.broadcastStatus(STATUS.FINISHED, {
      subject: this.quizz.subject,
      top: this.leaderboard.slice(0, 3),
      quizzResults,
    })
  }

  sendPlayerQuizzQuestion(playerId: string) {
    const player = this.players.find((p) => p.id === playerId)
    if (!player || !this.quizz) { return }

    const qIndex = this.playerCurrentQuestion[playerId] ?? 0
    if (qIndex < 0 || qIndex >= this.quizz.questions.length) { return }

    const question = this.quizz.questions[qIndex]
    const remainingTime = this.cooldown.count || 2400

    const playerAnswers = this.round.playersAnswers.filter(a => a.playerId === playerId && a.questionIndex === qIndex)
    const prevAnswer = playerAnswers.length > 0 ? playerAnswers[playerAnswers.length - 1].answerId : undefined

    this.sendStatus(playerId, STATUS.SELECT_ANSWER, {
      question: question.question,
      answers: question.answers,
      image: question.image,
      video: question.video,
      audio: question.audio,
      time: remainingTime,
      totalPlayer: this.players.length,
      selectedAnswer: prevAnswer,
    })

    this.io.to(playerId).emit("game:updateQuestion", {
      current: qIndex + 1,
      total: this.quizz.questions.length,
    })
  }

  navigateQuizzQuestion(socket: Socket, direction: "prev" | "next") {
    const player = this.players.find((p) => p.id === socket.id)
    if (!player || !this.quizz || !this.started || this.gameMode !== "quiz") { return }

    const currentIndex = this.playerCurrentQuestion[player.id] ?? 0
    const offset = direction === "next" ? 1 : -1
    const targetIndex = Math.min(
      Math.max(currentIndex + offset, 0),
      this.quizz.questions.length - 1,
    )

    if (targetIndex === currentIndex) { return }

    this.playerCurrentQuestion[player.id] = targetIndex
    this.sendPlayerQuizzQuestion(player.id)
  }

  finishQuizz(socket: Socket, answers: Record<string, number>) {
    const player = this.players.find((p) => p.id === socket.id)
    if (!player || !this.started || this.gameMode !== "quiz") { return }

    // Process all answers submitted in bulk
    for (const [qIndexStr, answerId] of Object.entries(answers)) {
      const qIndex = parseInt(qIndexStr)
      const question = this.quizz.questions[qIndex]
      if (!question) continue

      // Remove any previous answer for this question by this player
      this.round.playersAnswers = this.round.playersAnswers.filter(
        (a) => !(a.playerId === player.id && a.questionIndex === qIndex)
      )

      const isCorrect = question.solution === answerId
      this.round.playersAnswers.push({
        playerId: player.id,
        answerId,
        points: isCorrect ? 500 : 0,
        questionIndex: qIndex,
      })
    }

    // Recalculate total points for this player
    player.points = this.round.playersAnswers
      .filter((a) => a.playerId === player.id)
      .reduce((acc, curr) => acc + curr.points, 0)

    this.quizzFinishedPlayers.add(player.id)

    // Record completion time (seconds since round started)
    if (!this.playerCompletionTime[player.id]) {
      this.playerCompletionTime[player.id] = Math.round((Date.now() - this.round.startTime) / 1000)
    }

    // Update the manager's live leaderboard
    this.sendManagerQuizzLeaderboard()

    this.sendStatus(socket.id, STATUS.WAIT, {
      text: "wait for the result",
    })

    if (this.quizzFinishedPlayers.size === this.players.length) {
      this.abortCooldown()
    }
  }

  async newRound() {}

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
      time: 3600,
      totalPlayer: this.players.length,
    })

    await this.startCooldown(3600)

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
    const remainingTime = this.cooldown.count || 3600

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

    // Save submission to DB
    Submission.findOneAndUpdate(
      { participantId: player.id, questionId: question.id, eventType: this.gameMode },
      {
        username: player.username,
        participantId: player.id,
        eventType: this.gameMode,
        year: player.year || null,
        questionId: question.id,
        question: question.output,
        answer: code,
        language: question.language,
        timeTaken,
        score: points,
        isCorrect
      },
      { upsert: true }
    ).catch(err => console.error("Failed to save submission to DB:", err));

    // Update aggregate participant metrics
    Participant.findOne({ participantId: player.id }).then(pDoc => {
      if (!pDoc) return;
      const qIndex = pDoc.questionDetails.findIndex(q => q.questionId === question.id);
      if (qIndex >= 0) {
        // Update existing question data if code is re-submitted
        pDoc.totalTimeTaken -= (pDoc.questionDetails[qIndex].timeTaken || 0);
        pDoc.totalScore -= (pDoc.questionDetails[qIndex].score || 0);
        pDoc.questionDetails[qIndex].timeTaken = timeTaken;
        pDoc.questionDetails[qIndex].isCorrect = isCorrect;
        pDoc.questionDetails[qIndex].score = points;
        pDoc.questionDetails[qIndex].language = question.language;
      } else {
        // New question answered
        pDoc.totalQuestionsSubmitted = (pDoc.totalQuestionsSubmitted || 0) + 1;
        pDoc.questionDetails.push({ questionId: question.id, timeTaken, isCorrect, score: points, language: question.language });
      }
      pDoc.totalTimeTaken = (pDoc.totalTimeTaken || 0) + timeTaken;
      pDoc.totalScore = (pDoc.totalScore || 0) + points;
      pDoc.save().catch(err => console.error("Failed to update participant metrics:", err));
    }).catch(err => console.error("Failed to retrieve participant:", err));

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

    // Save submission to DB
    const timeTaken = Math.round((Date.now() - this.round.startTime) / 1000)
    const question = this.blindCodingQuizz.questions[pIndex]
    
    Submission.findOneAndUpdate(
      { participantId: player.id, questionId: question.id, eventType: this.gameMode },
      {
        username: player.username,
        participantId: player.id,
        eventType: this.gameMode,
        year: player.year || null,
        questionId: question.id,
        question: question.title,
        answer: code,
        language,
        timeTaken,
        score: 0,
        isCorrect: true
      },
      { upsert: true }
    ).catch(err => console.error("Failed to save submission to DB:", err));

    // Update aggregate participant metrics
    Participant.findOne({ participantId: player.id }).then(pDoc => {
      if (!pDoc) return;
      const qIndex = pDoc.questionDetails.findIndex(q => q.questionId === question.id);
      if (qIndex >= 0) {
        pDoc.totalTimeTaken -= (pDoc.questionDetails[qIndex].timeTaken || 0);
        pDoc.questionDetails[qIndex].timeTaken = timeTaken;
        pDoc.questionDetails[qIndex].language = language;
      } else {
        pDoc.totalQuestionsSubmitted = (pDoc.totalQuestionsSubmitted || 0) + 1;
        pDoc.questionDetails.push({ questionId: question.id, timeTaken, isCorrect: true, score: 0, language });
      }
      pDoc.totalTimeTaken = (pDoc.totalTimeTaken || 0) + timeTaken;
      pDoc.save().catch(err => console.error("Failed to update participant metrics:", err));
    }).catch(err => console.error("Failed to retrieve participant:", err));

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
    if (!player) { return }

    const qIndex = this.playerCurrentQuestion[player.id] ?? 0
    const question = this.quizz.questions[qIndex]

    // Remove previous answer for this specific question by this player
    this.round.playersAnswers = this.round.playersAnswers.filter(
      (a) => !(a.playerId === player.id && a.questionIndex === qIndex)
    )

    const points = timeToPoint(this.round.startTime, question.time);

    this.round.playersAnswers.push({
      playerId: player.id,
      answerId,
      points,
    })

    // Save submission to DB
    const isCorrect = answerId === question.solution;
    const timeTaken = Math.round((Date.now() - this.round.startTime) / 1000);
    Submission.findOneAndUpdate(
      { participantId: player.id, questionId: question.id, eventType: this.gameMode },
      {
        username: player.username,
        participantId: player.id,
        eventType: this.gameMode || "quiz",
        year: player.year || null,
        questionId: question.id,
        question: question.question,
        answer: answerId.toString(),
        timeTaken,
        score: isCorrect ? points : 0,
        isCorrect
      },
      { upsert: true }
    ).catch(err => console.error("Failed to save sumbission to DB:", err));

    // Update aggregate participant metrics
    Participant.findOne({ participantId: player.id }).then(pDoc => {
      if (!pDoc) return;
      const qIndex = pDoc.questionDetails.findIndex(q => q.questionId === question.id);
      if (qIndex >= 0) {
        pDoc.totalTimeTaken -= (pDoc.questionDetails[qIndex].timeTaken || 0);
        pDoc.totalScore -= (pDoc.questionDetails[qIndex].score || 0);
        pDoc.questionDetails[qIndex].timeTaken = timeTaken;
        pDoc.questionDetails[qIndex].isCorrect = isCorrect;
        pDoc.questionDetails[qIndex].score = isCorrect ? points : 0;
      } else {
        pDoc.totalQuestionsSubmitted = (pDoc.totalQuestionsSubmitted || 0) + 1;
        pDoc.questionDetails.push({ questionId: question.id, timeTaken, isCorrect, score: isCorrect ? points : 0 });
      }
      pDoc.totalTimeTaken = (pDoc.totalTimeTaken || 0) + timeTaken;
      pDoc.totalScore = (pDoc.totalScore || 0) + (isCorrect ? points : 0);
      pDoc.save().catch(err => console.error("Failed to update participant metrics:", err));
    }).catch(err => console.error("Failed to retrieve participant:", err));

    this.sendStatus(socket.id, STATUS.WAIT, {
      text: "Waiting for the players to answer",
    })

    // Acknowledge by simply re-sending the question state to refresh UI with correct button feedback
    this.sendPlayerQuizzQuestion(player.id)

    // Update the manager's live leaderboard
    this.sendManagerQuizzLeaderboard()

    // In async mode, "playerAnswer" might just track total answers currently given.
    socket.to(this.gameId).emit("game:playerAnswer", this.round.playersAnswers.length)
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
