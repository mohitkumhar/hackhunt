import type { Player } from "@rahoot/common/types/game"

export const STATUS = {
  SHOW_ROOM: "SHOW_ROOM",
  SHOW_START: "SHOW_START",
  SHOW_PREPARED: "SHOW_PREPARED",
  SHOW_QUESTION: "SHOW_QUESTION",
  SELECT_ANSWER: "SELECT_ANSWER",
  SHOW_RESULT: "SHOW_RESULT",
  SHOW_RESPONSES: "SHOW_RESPONSES",
  SHOW_LEADERBOARD: "SHOW_LEADERBOARD",
  FINISHED: "FINISHED",
  WAIT: "WAIT",
  REVERSE_WRITE_CODE: "REVERSE_WRITE_CODE",
  REVERSE_SHOW_RESPONSES: "REVERSE_SHOW_RESPONSES",
  BLIND_CODING_WRITE: "BLIND_CODING_WRITE",
  BLIND_CODING_SHOW_RESPONSES: "BLIND_CODING_SHOW_RESPONSES",
  BUG_HUNTING_WRITE: "BUG_HUNTING_WRITE",
  BUG_HUNTING_SHOW_RESPONSES: "BUG_HUNTING_SHOW_RESPONSES",
} as const

export type Status = (typeof STATUS)[keyof typeof STATUS]

export type CommonStatusDataMap = {
  SHOW_START: { time: number; subject: string }
  SHOW_PREPARED: { totalAnswers: number; questionNumber: number }
  SHOW_QUESTION: { question: string; image?: string; cooldown: number }
  SELECT_ANSWER: {
    question: string
    answers: string[]
    image?: string
    video?: string
    audio?: string
    time: number
    totalPlayer: number
    selectedAnswer?: number
  }
  SHOW_RESULT: {
    correct: boolean
    message: string
    points: number
    myPoints: number
    rank: number
    aheadOfMe: string | null
    hideRank?: boolean
  }
  WAIT: { text: string }
  FINISHED: { 
    subject: string; 
    top: Player[]; 
    blindSubmissionsHistory?: { 
      question: string; 
      language: string; 
      submissions: { 
        username: string; 
        code: string; 
        language: string; 
        submitted: boolean; 
      }[] 
    }[];
    blindPlayerResults?: {
      username: string;
      completionTime: number;
      answers: {
        question: string;
        code: string;
        language: string;
        submitted: boolean;
      }[];
    }[];
    quizzResults?: {
      rank: number;
      username: string;
      teamName?: string;
      correctAnswers: number;
      totalQuestions: number;
      totalPoints: number;
      timeTaken: string;
      timeTakenSeconds: number;
    }[];
  }
  REVERSE_WRITE_CODE: {
    title: string
    output: string
    language: string
    hint?: string
    example?: string[]
    explanation?: string
    time: number
    totalPlayer: number
  }
  BLIND_CODING_WRITE: {
    title: string
    description: string
    examples: { input: string; output: string; explanation?: string }[]
    constraints: string[]
    language: string
    time: number
    totalPlayer: number
  }
  BUG_HUNTING_WRITE: {
    title: string
    description: string
    buggyCode: string
    language: string
    expectedOutput: string
    time: number
    totalPlayer: number
  }
}

type ManagerExtraStatus = {
  SHOW_ROOM: { text: string; inviteCode?: string }
  SHOW_RESPONSES: {
    question: string
    responses: Record<number, number>
    correct: number
    answers: string[]
    image?: string
    video?: string
  }
  SHOW_LEADERBOARD: { oldLeaderboard: Player[]; leaderboard: Player[]; isQuizz?: boolean }
  REVERSE_SHOW_RESPONSES: {
    output: string
    expectedCode: string
    language: string
    totalCorrect: number
    totalWrong: number
    totalPlayers: number
  }
  BLIND_CODING_SHOW_RESPONSES: {
    title: string
    description: string
    language: string
    submissions: {
      username: string
      code: string
      language: string
      submitted: boolean
    }[]
    totalSubmitted: number
    totalPlayers: number
  }
  BUG_HUNTING_SHOW_RESPONSES: {
    title: string
    expectedOutput: string
    language: string
    totalCorrect: number
    totalWrong: number
    totalPlayers: number
  }
}

export type PlayerStatusDataMap = CommonStatusDataMap
export type ManagerStatusDataMap = CommonStatusDataMap & ManagerExtraStatus
export type StatusDataMap = PlayerStatusDataMap & ManagerStatusDataMap
