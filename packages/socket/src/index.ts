import { Server, Socket, type CreateQuizzPayload } from "@rahoot/common/types/game/socket"
import { inviteCodeValidator } from "@rahoot/common/validators/auth"
import Config from "@rahoot/socket/services/config"
import Game from "@rahoot/socket/services/game"
import Registry from "@rahoot/socket/services/registry"
import { withGame } from "@rahoot/socket/utils/game"
import express from "express"
import multer from "multer"
import { createServer } from "node:http"
// import { Socket } from "node:dgram"
import sharp from "sharp"
import { Server as ServerIO } from "socket.io"


const WS_PORT = 3001
const app = express()
app.set("trust proxy", true)

const MAX_UPLOAD_WIDTH = 1920
const MAX_UPLOAD_HEIGHT = 1080
const MAX_UPLOAD_RATE_WINDOW_MS = 60_000 // rate limit 1 menit
const MAX_UPLOAD_REQUESTS_PER_WINDOW = 20 // max 20 upload gambar per IP per menit
const uploadRateLimitByIp = new Map<string, { count: number; resetAt: number }>()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,  // batas max file 8MB
  },
})
const httpServer = createServer(app)

const io: Server = new ServerIO(httpServer, {
  path: "/ws",
})

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, max)
}

const parseQuality = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10)

  if (!Number.isInteger(parsed)) {
    return fallback
  }

  return Math.min(100, Math.max(10, parsed))
}

const getClientIp = (req: express.Request) => {
  const forwardedFor = req.headers["x-forwarded-for"]

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    const firstIp = forwardedFor.split(",")[0]?.trim()

    if (firstIp) {
      return firstIp
    }
  }

  return req.ip || "unknown"
}

const isRateLimited = (ip: string) => {
  const now = Date.now()
  const currentWindow = uploadRateLimitByIp.get(ip)

  if (!currentWindow || currentWindow.resetAt <= now) {
    uploadRateLimitByIp.set(ip, {
      count: 1,
      resetAt: now + MAX_UPLOAD_RATE_WINDOW_MS,
    })
    return false
  }

  if (currentWindow.count >= MAX_UPLOAD_REQUESTS_PER_WINDOW) {
    return true
  }

  currentWindow.count += 1
  return false
}

// Middleware
// Cek apakah pengunggah memiliki password manager yang benar
const requireManagerUploadAuth: express.RequestHandler = async (req, res, next) => {
  const passwordHeader = req.header("x-manager-password")

  if (!passwordHeader) {
    res.status(401).json({ message: "Manager authentication required" })
    return
  }

  try {
    const config = await Config.game()

    if (config.managerPassword === "PASSWORD") {
      res.status(503).json({ message: "Manager password is not configured" })
      return
    }

    if (passwordHeader !== config.managerPassword) {
      res.status(403).json({ message: "Invalid manager credentials" })
      return
    }

    next()
  } catch (error) {
    console.error("Failed to verify upload auth:", error)
    res.status(500).json({ message: "Failed to verify manager credentials" })
  }
}

// Middleware untuk membatasi jumlah request upload
const applyUploadRateLimit: express.RequestHandler = (req, res, next) => {
  const clientIp = getClientIp(req)

  if (isRateLimited(clientIp)) {
    res.status(429).json({ message: "Too many upload requests, try again later" })
    return
  }

  next()
}

app.post("/api/upload-image", requireManagerUploadAuth, applyUploadRateLimit, upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "Image file is required" })
    return
  }

  const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

  if (!allowedMimeTypes.has(req.file.mimetype)) {
    res.status(400).json({ message: "Only image files are allowed" })
    return
  }

  const maxWidth = parsePositiveInt(req.body.maxWidth, 1280, MAX_UPLOAD_WIDTH)
  const maxHeight = parsePositiveInt(req.body.maxHeight, 720, MAX_UPLOAD_HEIGHT)
  const quality = parseQuality(req.body.quality, 75)

  try {
    const resizedBuffer = await sharp(req.file.buffer)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer()

    if (resizedBuffer.length > 2 * 1024 * 1024) {
      res.status(413).json({ message: "Processed image is too large" })
      return
    }

    const metadata = await sharp(resizedBuffer).metadata()
    const dataUrl = `data:image/webp;base64,${resizedBuffer.toString("base64")}`

    res.json({
      dataUrl,
      mimeType: "image/webp",
      size: resizedBuffer.length,
      width: metadata.width,
      height: metadata.height,
    })
  } catch (error) {
    console.error("Failed to process uploaded image:", error)
    res.status(500).json({ message: "Failed to process image" })
  }
})

// Memastikan database siap sebelum server menerima koneksi
Config.init().catch(err => console.error("Database failed to initialize:", err))

const registry = Registry.getInstance()
const managerAuthedSockets = new Set<string>()

const ensureManagerAuth = (socket: Socket): boolean => {
  if (managerAuthedSockets.has(socket.id)) {
    return true
  }

  socket.emit("manager:errorMessage", "Manager authentication required")
  return false
}

console.log(`Socket server running on port ${WS_PORT}`)
httpServer.listen(WS_PORT)

io.on("connection", (socket : Socket) => {
  console.log(
    `A user connected: socketId: ${socket.id}, clientId: ${socket.handshake.auth.clientId}`,
  )

  socket.on("player:reconnect", ({ gameId } : { gameId: string }) => {
    const game = registry.getPlayerGame(gameId, socket.handshake.auth.clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit("game:reset", "Game not found")
  })

  socket.on("manager:reconnect", ({ gameId } : { gameId: string }) => {
    const game = registry.getManagerGame(gameId, socket.handshake.auth.clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit("game:reset", "Game expired")
  })

  // add async pass and await to make sure config is loaded before sending quizz list
  socket.on("manager:auth", async(password : string) => {
    try {
      const config = await Config.game()

      if (config.managerPassword === "PASSWORD") {
        managerAuthedSockets.delete(socket.id)
        socket.emit("manager:errorMessage", "Manager password is not configured")

        return
      }

      if (password !== config.managerPassword) {
        managerAuthedSockets.delete(socket.id)
        socket.emit("manager:errorMessage", "Invalid password")

        return
      }

      managerAuthedSockets.add(socket.id)
      socket.emit("manager:quizzList", await Config.quizz())
      socket.emit("manager:historyList", await Config.history())
    } catch (error) {
      console.error("Failed to read game config:", error)
      socket.emit("manager:errorMessage", "Failed to read game config")
    }
  })

  socket.on("manager:history", async () => {
    if (!ensureManagerAuth(socket)) {
      return
    }

    socket.emit("manager:historyList", await Config.history())
  })

  socket.on("game:create", async (quizzId : string) => {
    if (!ensureManagerAuth(socket)) {
      return
    }

    const quizzList = await Config.quizz()
    const quizz = quizzList.find((q) => q.id === quizzId)

    if (!quizz) {
      socket.emit("game:errorMessage", "Quizz not found")

      return
    }

    const game = new Game(io, socket, quizz)
    registry.addGame(game)
  })

  socket.on("manager:createQuizz", async (payload: CreateQuizzPayload) => {
    if (!ensureManagerAuth(socket)) {
      return
    }

    try {
      const created = await Config.createQuizz(payload)

      socket.emit("manager:quizzCreated", created)
      socket.emit("manager:quizzList", await Config.quizz())
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to create quizz"

      socket.emit("manager:errorMessage", message)
    }
  })

  socket.on("manager:updateQuizz", async ({ quizzId, payload }: { quizzId: string; payload: CreateQuizzPayload }) => {
    if (!ensureManagerAuth(socket)) {
      return
    }

    try {
      const updated = await Config.updateQuizz(quizzId, payload)

      socket.emit("manager:quizzUpdated", updated)
      socket.emit("manager:quizzList", await Config.quizz())
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to update quizz"

      socket.emit("manager:errorMessage", message)
    }
  })

  socket.on("manager:deleteQuizz", async ({ quizzId }: { quizzId: string }) => {
    if (!ensureManagerAuth(socket)) {
      return
    }

    try {
      const result = await Config.deleteQuizz(quizzId)

      socket.emit("manager:quizzDeleted", result)
      socket.emit("manager:quizzList", await Config.quizz())
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to delete quizz"

      socket.emit("manager:errorMessage", message)
    }
  })

  socket.on("player:join", (inviteCode : string) => {
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

  socket.on("player:login", ({ gameId, data } ) =>
    withGame(gameId, socket, (game) => game.join(socket, data.username)),
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
    managerAuthedSockets.delete(socket.id)

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
