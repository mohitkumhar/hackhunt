import type {
  BlindCodingQuizzWithId,
  GameUpdateQuestion,
  Player,
  QuizzWithId,
  ReverseQuizzWithId,
} from "@rahoot/common/types/game"
import type { Status, StatusDataMap } from "@rahoot/common/types/game/status"
import { Server as ServerIO, Socket as SocketIO } from "socket.io"

export type Server = ServerIO<ClientToServerEvents, ServerToClientEvents>
export type Socket = SocketIO<ClientToServerEvents, ServerToClientEvents>

export type Message<K extends keyof StatusDataMap = keyof StatusDataMap> = {
  gameId?: string
  status: K
  data: StatusDataMap[K]
}

export type MessageWithoutStatus<T = any> = {
  gameId?: string
  data: T
}

export type MessageGameId = {
  gameId?: string
}

export type MessageBlindNavigate = MessageGameId & {
  data: {
    direction: "prev" | "next"
  }
}

export interface ServerToClientEvents {
  connect: () => void

  // Game events
  "game:status": (_data: { name: Status; data: StatusDataMap[Status] }) => void
  "game:successRoom": (_data: string) => void
  "game:successJoin": (_gameId: string) => void
  "game:totalPlayers": (_count: number) => void
  "game:errorMessage": (_message: string) => void
  "game:startCooldown": () => void
  "game:cooldown": (_count: number) => void
  "game:reset": (_message: string) => void
  "game:updateQuestion": (_data: { current: number; total: number }) => void
  "game:playerAnswer": (_count: number) => void

  // Player events
  "player:successReconnect": (_data: {
    gameId: string
    status: { name: Status; data: StatusDataMap[Status] }
    player: { username: string; points: number }
    currentQuestion: GameUpdateQuestion
  }) => void
  "player:updateLeaderboard": (_data: { leaderboard: Player[] }) => void

  // Manager events
  "manager:successReconnect": (_data: {
    gameId: string
    status: { name: Status; data: StatusDataMap[Status] }
    players: Player[]
    currentQuestion: GameUpdateQuestion
  }) => void
  "manager:quizzList": (_quizzList: QuizzWithId[]) => void
  "manager:gameCreated": (_data: { gameId: string; inviteCode: string }) => void
  "manager:statusUpdate": (_data: {
    status: Status
    data: StatusDataMap[Status]
  }) => void
  "manager:newPlayer": (_player: Player) => void
  "manager:removePlayer": (_playerId: string) => void
  "manager:errorMessage": (_message: string) => void
  "manager:playerKicked": (_playerId: string) => void
  "manager:reverseQuizzList": (_quizzList: ReverseQuizzWithId[]) => void
  "manager:blindCodingQuizzList": (_quizzList: BlindCodingQuizzWithId[]) => void
  "manager:playerSubmitted": (_data: {
    playerId: string
    username: string
    completionTime: number | null
    points: number
    isCorrect: boolean
  }) => void
}

export interface ClientToServerEvents {
  // Manager actions
  "game:create": (_quizzId: string) => void
  "manager:auth": (_password: string) => void
  "manager:reconnect": (_message: { gameId: string }) => void
  "manager:kickPlayer": (_message: { gameId: string; playerId: string }) => void
  "manager:startGame": (_message: MessageGameId) => void
  "manager:abortQuiz": (_message: MessageGameId) => void
  "manager:nextQuestion": (_message: MessageGameId) => void
  "manager:showLeaderboard": (_message: MessageGameId) => void

  // Player actions
  "player:join": (_inviteCode: string) => void
  "player:login": (_message: MessageWithoutStatus<{ username: string; teamName: string }>) => void
  "player:reconnect": (_message: { gameId: string }) => void
  "player:selectedAnswer": (
    _message: MessageWithoutStatus<{ answerKey: number }>,
  ) => void
  "player:submitCode": (
    _message: MessageWithoutStatus<{ code: string; output: string }>,
  ) => void
  "player:navigateReverseQuestion": (_message: MessageBlindNavigate) => void

  // Reverse programming
  "game:createReverse": (_quizzId: string) => void
  "game:createBlindCoding": (_quizzId: string) => void
  "player:submitBlindCode": (
    _message: MessageWithoutStatus<{ code: string; language: string }>,
  ) => void
  "player:submitAllBlindCodes": (
    _message: MessageWithoutStatus<{ submissions: Record<number, { code: string; language: string }> }>,
  ) => void
  "player:navigateBlindQuestion": (_message: MessageBlindNavigate) => void

  // Common
  disconnect: () => void
}
