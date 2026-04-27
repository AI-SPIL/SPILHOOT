// Configuration to read/write game settings and quizz data from/to database

import { GameHistoryItem, QuizzWithId } from "@rahoot/common/types/game"
import type { CreateQuizzPayload } from "@rahoot/common/types/game/socket"
// import fs from "fs"
// import { resolve } from "path"
import { prisma } from "../db/db"

class Config {
  private static toImageBytes(image?: string): Uint8Array | null {
    const raw = image?.trim()

    if (!raw) {
      return null
    }

    const dataUrlMatch = raw.match(/^data:([^;,]+)?;base64,(.+)$/i)

    if (dataUrlMatch) {
      const decoded = Buffer.from(dataUrlMatch[2], "base64")

      if (!decoded.length) {
        throw new Error("Image data is empty")
      }

      return new Uint8Array(decoded)
    }

    if (/^https?:\/\//i.test(raw)) {
      throw new Error("Image must be sent as base64 or data URL")
    }

    const normalizedBase64 = raw.replace(/\s+/g, "")
    const isValidBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(normalizedBase64)
      && normalizedBase64.length % 4 === 0

    if (!isValidBase64) {
      throw new Error("Image format is invalid")
    }

    const decoded = Buffer.from(normalizedBase64, "base64")

    if (!decoded.length) {
      throw new Error("Image data is empty")
    }

    return new Uint8Array(decoded)
  }

  private static detectImageMimeType(imageBytes: Uint8Array): string {
    if (
      imageBytes.length >= 8
      && imageBytes[0] === 0x89
      && imageBytes[1] === 0x50
      && imageBytes[2] === 0x4e
      && imageBytes[3] === 0x47
      && imageBytes[4] === 0x0d
      && imageBytes[5] === 0x0a
      && imageBytes[6] === 0x1a
      && imageBytes[7] === 0x0a
    ) {
      return "image/png"
    }

    if (
      imageBytes.length >= 3
      && imageBytes[0] === 0xff
      && imageBytes[1] === 0xd8
      && imageBytes[2] === 0xff
    ) {
      return "image/jpeg"
    }

    if (
      imageBytes.length >= 6
      && imageBytes[0] === 0x47
      && imageBytes[1] === 0x49
      && imageBytes[2] === 0x46
      && imageBytes[3] === 0x38
      && (imageBytes[4] === 0x37 || imageBytes[4] === 0x39)
      && imageBytes[5] === 0x61
    ) {
      return "image/gif"
    }

    if (
      imageBytes.length >= 12
      && imageBytes[0] === 0x52
      && imageBytes[1] === 0x49
      && imageBytes[2] === 0x46
      && imageBytes[3] === 0x46
      && imageBytes[8] === 0x57
      && imageBytes[9] === 0x45
      && imageBytes[10] === 0x42
      && imageBytes[11] === 0x50
    ) {
      return "image/webp"
    }

    return "application/octet-stream"
  }

  private static toDisplayImage(imageBytes: Uint8Array | null): string | undefined {
    if (!imageBytes || !imageBytes.length) {
      return undefined
    }

    const mimeType = Config.detectImageMimeType(imageBytes)
    const base64 = Buffer.from(imageBytes).toString("base64")

    return `data:${mimeType};base64,${base64}`
  }

  private static normalizeQuizzPayload(payload: CreateQuizzPayload) {
    const subject = payload.subject.trim()

    if (!subject) {
      throw new Error("Subject is required")
    }

    if (!payload.questions.length) {
      throw new Error("At least one question is required")
    }

    const normalizedQuestions = payload.questions.map((question, questionIndex) => {
      const questionText = question.question.trim()
      const questionType = question.question_type
      const answers = question.answers.map((answer) => answer.trim()).filter(Boolean)

      if (!questionText) {
        throw new Error(`Question ${questionIndex + 1} text is required`)
      }

      if (questionType === "multiple_choice" && answers.length < 2) {
        throw new Error(`Question ${questionIndex + 1} needs at least 2 answers`)
      }

      if (questionType === "free_text" && answers.length < 1) {
        throw new Error(`Question ${questionIndex + 1} needs an answer key`)
      }

      const normalizedAnswers = questionType === "free_text" ? [answers[0]] : answers

      if (question.solution < 0 || question.solution >= normalizedAnswers.length) {
        throw new Error(`Question ${questionIndex + 1} has invalid correct answer index`)
      }

      return {
        question_type: questionType,
        question_text: questionText,
        image_url: Config.toImageBytes(question.image) as Uint8Array<ArrayBuffer> | null,
        time_limit: question.time,
        cooldown: question.cooldown,
        answers: {
          create: normalizedAnswers.map((answerText, index) => ({
            answer_text: answerText,
            is_correct: index === question.solution,
          })),
        },
      }
    })

    return {
      subject,
      description: payload.description?.trim() || null,
      questions: normalizedQuestions,
    }
  }

  // Memastikan koneksi ke db
  static async init() {
    try {
      await prisma.$queryRaw`SELECT 1`
      console.log("Database Config Service Initialized")
    } catch (error) {
      console.error("Database Config Error:", error)
    }
  }

  // Mengambil password manager dari tabel app_settings
  static async game() {
    try {
      const setting = await prisma.app_settings.findFirst({
        where: { setting_key: "managerPassword" },
        select: { setting_value: true },
      })

      if (!setting) {
        return { managerPassword: "PASSWORD" }
      }

      return {
        managerPassword: setting.setting_value,
      }
    } catch (error) {
      console.error("Failed to read game config from DB:", error)
      return { managerPassword: "PASSWORD" }
    }
  }

  // Mengambil semua kuis beserta pertanyaan dan jawabannya
  static async quizz(): Promise<QuizzWithId[]> {
    try {
      const quizzes = await prisma.quizzes.findMany({
        where: {
          is_active: true,
        },
        include: {
          questions: {
            include: {
              answers: true,
            },
          },
        },
      })

      return quizzes.map((quiz) => ({
        id: quiz.id,
        subject: quiz.subject,
        description: quiz.description || undefined,
        created_at: quiz.created_at.toISOString(),
        updated_at: quiz.updated_at.toISOString(),
        questions: quiz.questions.map((question) => {
          const answersArray = question.answers.map((answer) => answer.answer_text)
          const solutionIndex = question.answers.findIndex((answer) => answer.is_correct)

          return {
            question_type: (question.question_type as "multiple_choice" | "free_text") || "multiple_choice",
            question: question.question_text,
            answers: answersArray,
            solution: solutionIndex,
            image: Config.toDisplayImage(question.image_url),
            cooldown: question.cooldown,
            time: question.time_limit,
          }
        }),
      }))
    } catch (error) {
      console.error("Failed to fetch quizzes from DB:", error)
      return []
    }
  }

  static async history(): Promise<GameHistoryItem[]> {
    try {
      const sessions = await prisma.game_sessions.findMany({
        where: {
          ended_at: {
            not: null,
          },
        },
        include: {
          quizzes: true,
          player_results: {
            orderBy: {
              total_score: "desc",
            },
          },
        },
        orderBy: {
          started_at: "desc",
        },
        take: 50,
      })

      return sessions.map((session) => {
        const rankedPlayers = session.player_results
          .map((player) => ({
            username: player.player_name,
            points: player.total_score,
          }))

        return {
          id: session.id,
          quizId: session.quiz_id,
          subject: session.quizzes.subject,
          description: session.quizzes.description || undefined,
          startedAt: session.started_at.toISOString(),
          endedAt: session.ended_at ? session.ended_at.toISOString() : null,
          winner: rankedPlayers[0] || null,
          topPlayers: rankedPlayers.slice(0, 3),
        }
      })
    } catch (error) {
      console.error("Failed to fetch game history from DB:", error)
      return []
    }
  }

  // Create quizz
  static async createQuizz(payload: CreateQuizzPayload) {
    const normalizedPayload = Config.normalizeQuizzPayload(payload)

    const created = await prisma.quizzes.create({
      data: {
        subject: normalizedPayload.subject,
        description: normalizedPayload.description,
        updated_at: new Date(),
        questions: {
          create: normalizedPayload.questions,
        },
      },
      select: {
        id: true,
        subject: true,
      },
    })

    return created
  }

  // update quizz
  static async updateQuizz(quizzId: string, payload: CreateQuizzPayload) {
    const normalizedPayload = Config.normalizeQuizzPayload(payload)

    return prisma.$transaction(async (tx) => {
      const existingQuizz = await tx.quizzes.findUnique({
        where: { id: quizzId },
        select: { id: true, is_active: true },
      })

      if (!existingQuizz) {
        throw new Error("Quiz not found")
      }

      if (!existingQuizz.is_active) {
        throw new Error("Quiz is archived")
      }

      await tx.questions.deleteMany({
        where: { quiz_id: quizzId },
      })

      return tx.quizzes.update({
        where: { id: quizzId },
        data: {
          subject: normalizedPayload.subject,
          description: normalizedPayload.description,
          updated_at: new Date(),
          questions: {
            create: normalizedPayload.questions,
          },
        },
        select: {
          id: true,
          subject: true,
        },
      })
    })
  }

  static async deleteQuizz(quizzId: string) {
    try {
      await prisma.quizzes.update({
        where: { id: quizzId },
        data: {
          is_active: false,
          updated_at: new Date(),
        },
      })
      return { success: true, message: "Quiz archived successfully" }
    } catch (error) {
      throw new Error("Failed to delete quiz")
    }
  }
}

export default Config

// const inContainerPath = process.env.CONFIG_PATH

// const getPath = (path: string = "") =>
//   inContainerPath
//     ? resolve(inContainerPath, path)
//     : resolve(process.cwd(), "../../config", path)

// class Config {
//   static init() {
//     const isConfigFolderExists = fs.existsSync(getPath())

//     if (!isConfigFolderExists) {
//       fs.mkdirSync(getPath())
//     }

//     const isGameConfigExists = fs.existsSync(getPath("game.json"))

//     if (!isGameConfigExists) {
//       fs.writeFileSync(
//         getPath("game.json"),
//         JSON.stringify(
//           {
//             managerPassword: "PASSWORD",
//           },
//           null,
//           2,
//         ),
//       )
//     }

//     const isQuizzExists = fs.existsSync(getPath("quizz"))

//     if (!isQuizzExists) {
//       fs.mkdirSync(getPath("quizz"))

//       fs.writeFileSync(
//         getPath("quizz/example.json"),
//         JSON.stringify(
//           {
//             subject: "Example Quizz",
//             questions: [
//               {
//                 question: "What is good answer ?",
//                 answers: ["No", "Good answer", "No", "No"],
//                 solution: 1,
//                 cooldown: 5,
//                 time: 15,
//               },
//               {
//                 question: "What is good answer with image ?",
//                 answers: ["No", "No", "No", "Good answer"],
//                 image: "https://placehold.co/600x400.png",
//                 solution: 3,
//                 cooldown: 5,
//                 time: 20,
//               },
//               {
//                 question: "What is good answer with two answers ?",
//                 answers: ["Good answer", "No"],
//                 image: "https://placehold.co/600x400.png",
//                 solution: 0,
//                 cooldown: 5,
//                 time: 20,
//               },
//             ],
//           },
//           null,
//           2,
//         ),
//       )
//     }
//   }

//   static game() {
//     const isExists = fs.existsSync(getPath("game.json"))

//     if (!isExists) {
//       throw new Error("Game config not found")
//     }

//     try {
//       const config = fs.readFileSync(getPath("game.json"), "utf-8")

//       return JSON.parse(config)
//     } catch (error) {
//       console.error("Failed to read game config:", error)
//     }

//     return {}
//   }

//   static quizz() {
//     const isExists = fs.existsSync(getPath("quizz"))

//     if (!isExists) {
//       return []
//     }

//     try {
//       const files = fs
//         .readdirSync(getPath("quizz"))
//         .filter((file) => file.endsWith(".json"))

//       const quizz: QuizzWithId[] = files.map((file) => {
//         const data = fs.readFileSync(getPath(`quizz/${file}`), "utf-8")
//         const config = JSON.parse(data)

//         const id = file.replace(".json", "")

//         return {
//           id,
//           ...config,
//         }
//       })

//       return quizz || []
//     } catch (error) {
//       console.error("Failed to read quizz config:", error)

//       return []
//     }
//   }
// }

// export default Config
