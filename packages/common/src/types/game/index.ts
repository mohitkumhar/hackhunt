export type Player = {
  id: string
  clientId: string
  connected: boolean
  username: string
  points: number
}

export type Answer = {
  playerId: string
  answerId: number
  points: number
}

export type Quizz = {
  subject: string
  questions: {
    question: string
    image?: string
    video?: string
    audio?: string
    answers: string[]
    solution: number
    cooldown: number
    time: number
  }[]
}

export type QuizzWithId = Quizz & { id: string }

export type ReverseQuestion = {
  output: string
  language: string
  expectedCode: string
  hint?: string
  cooldown: number
  time: number
}

export type ReverseQuizz = {
  subject: string
  questions: ReverseQuestion[]
}

export type ReverseQuizzWithId = ReverseQuizz & { id: string }

export type GameMode = "quiz" | "reverse_programming"

export type GameUpdateQuestion = {
  current: number
  total: number
}
