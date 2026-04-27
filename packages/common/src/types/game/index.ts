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
  description?: string
  created_at: string
  updated_at: string
  questions: {
    question_type?: "multiple_choice" | "free_text"
    question: string
    image?: string
    answers: string[]
    solution: number
    cooldown: number
    time: number
  }[]
}

export type QuizzWithId = Quizz & { id: string }

export type GameUpdateQuestion = {
  current: number
  total: number
}

export type GameHistoryPlayer = {
  username: string
  points: number
}

export type GameHistoryItem = {
  id: string
  quizId: string
  subject: string
  description?: string
  startedAt: string
  endedAt: string | null
  winner: GameHistoryPlayer | null
  topPlayers: GameHistoryPlayer[]
}
