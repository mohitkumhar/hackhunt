export type Player = {
  id: string
  clientId: string
  connected: boolean
  username: string
  teamName: string
  year?: number
  points: number
  completionTime?: number
}

export type Answer = {
  playerId: string
  answerId: number
  points: number
  questionIndex?: number
}

export type Quizz = {
  subject: string
  questions: {
    id: string
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
  id: string
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

export type BlindCodingExample = {
  input: string
  output: string
  explanation?: string
}

export type BlindCodingQuestion = {
  id: string
  title: string
  description: string
  examples: BlindCodingExample[]
  constraints: string[]
  language: string
  cooldown: number
  time: number
}

export type BlindCodingQuizz = {
  subject: string
  questions: BlindCodingQuestion[]
}

export type BlindCodingQuizzWithId = BlindCodingQuizz & { id: string }

export type BugHuntingQuestion = {
  title: string
  description: string
  buggyCode: string
  language: string
  expectedOutput: string
  cooldown: number
  time: number
}

export type BugHuntingQuizz = {
  subject: string
  questions: BugHuntingQuestion[]
}

export type BugHuntingQuizzWithId = BugHuntingQuizz & { id: string }

export type GameMode = "quiz" | "reverse_programming" | "blind_coding" | "bug_hunting"

export type GameUpdateQuestion = {
  current: number
  total: number
}
