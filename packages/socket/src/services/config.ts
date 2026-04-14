// Configuration to read/write game settings and quizz data from/to database

import { QuizzWithId } from "@rahoot/common/types/game"
// import fs from "fs"
// import { resolve } from "path"
import { prisma } from "../db/db"

class Config {

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
        questions: quiz.questions.map((question) => {
          const answersArray = question.answers.map((answer) => answer.answer_text)
          const solutionIndex = question.answers.findIndex((answer) => answer.is_correct)

          return {
            question: question.question_text,
            answers: answersArray,
            solution: solutionIndex,
            image: question.image_url ?? undefined,
            video: question.video_url ?? undefined,
            audio: question.audio_url ?? undefined,
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
