import type { GameHistoryItem, QuizzWithId } from "@rahoot/common/types/game"
import type { CreateQuizzPayload } from "@rahoot/common/types/game/socket"
import { STATUS } from "@rahoot/common/types/game/status"
import CreateQuizz from "@rahoot/web/features/game/components/create/CreateQuizz"
import ManagerPassword from "@rahoot/web/features/game/components/create/ManagerPassword"
import SelectQuizz from "@rahoot/web/features/game/components/create/SelectQuizz"
import GameHistory from "@rahoot/web/features/game/components/history/GameHistory"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import clsx from "clsx"
import { useState } from "react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router"

const ManagerAuthPage = () => {
  const { setGameId, setStatus } = useManagerStore()
  const navigate = useNavigate()
  const { socket } = useSocket()

  const [isAuth, setIsAuth] = useState(false)
  const [quizzList, setQuizzList] = useState<QuizzWithId[]>([])
  const [historyList, setHistoryList] = useState<GameHistoryItem[]>([])
  const [mode, setMode] = useState<"select" | "create" | "history">("select")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [selectedQuizzId, setSelectedQuizzId] = useState<string | null>(null)
  const [editingQuizz, setEditingQuizz] = useState<QuizzWithId | null>(null)
  const [managerPassword, setManagerPassword] = useState("")

  useEvent("manager:quizzList", (quizzList) => {
    setIsAuth(true)
    setQuizzList(quizzList)
  })

  useEvent("manager:historyList", (historyList) => {
    setIsAuth(true)
    setHistoryList(historyList)
  })

  useEvent("manager:gameCreated", ({ gameId, inviteCode }) => {
    setGameId(gameId)
    setStatus(STATUS.SHOW_ROOM, { text: "Waiting for the players", inviteCode })
    navigate(`/party/manager/${gameId}`)
  })

  useEvent("manager:quizzCreated", ({ subject }) => {
    toast.success(`Quizz "${subject}" created`)
    setMode("select")
  })

  useEvent("manager:quizzUpdated", ({ subject }) => {
    toast.success(`Quizz "${subject}" updated`)
    setMode("select")
    setEditingQuizz(null)
  })

  useEvent("manager:quizzDeleted", () => {
    toast.success("Quiz archived successfully")
    setSelectedQuizzId(null)
  })

  useEvent("manager:errorMessage", (message) => {
    toast.error(message)
  })

  const handleAuth = (password: string) => {
    setManagerPassword(password)
    socket?.emit("manager:auth", password)
  }

  const handleRefreshHistory = () => {
    socket?.emit("manager:history")
  }

  const handleCreate = (quizzId: string) => {
    socket?.emit("game:create", quizzId)
  }

  const handleStartQuiz = () => {
    if (!selectedQuizzId) {
      toast.error("Please select a quizz")

      
return
    }

    handleCreate(selectedQuizzId)
  }

  const handleCreateQuizz = (payload: CreateQuizzPayload) => {
    socket?.emit("manager:createQuizz", payload)
  }

  const handleEditQuizz = (quizz: QuizzWithId) => {
    setEditingQuizz(quizz)
    setMode("create")
  }

  const handleDeleteQuizz = (quizzId: string) => {
    socket?.emit("manager:deleteQuizz", { quizzId })
  }

  const handleCreateQuizzFromEdit = (payload: CreateQuizzPayload) => {
    if (editingQuizz) {
      socket?.emit("manager:updateQuizz", {
        quizzId: editingQuizz.id,
        payload,
      })

      
return
    }

    handleCreateQuizz(payload)
  }

  if (!isAuth) {
    return <ManagerPassword onSubmit={handleAuth} />
  }

  let content = (
    <div className="flex w-full flex-col gap-4">
      <div className="manager-create-header flex items-center justify-between pb-4">
        <button
          onClick={() => {
            setMode("select")
            setEditingQuizz(null)
          }}
          aria-label="Back"
          className="flex items-center text-slate-300 transition hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path
              fillRule="evenodd"
              d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"
            />
          </svg>
        </button>
        <span className="text-sm font-semibold text-slate-300">
          {editingQuizz ? "Edit Quiz" : "Create New Quiz"}
        </span>
        <div className="w-6" />
      </div>

      <div className="w-full">
        <CreateQuizz
          onSubmit={handleCreateQuizzFromEdit}
          initialData={editingQuizz || undefined}
          managerPassword={managerPassword}
        />
      </div>
    </div>
  )

  if (mode === "select") {
    content = (
      <div className="manager-select-wrap w-full">
        <SelectQuizz
          quizzList={quizzList}
          selectedId={selectedQuizzId}
          onSelect={setSelectedQuizzId}
          viewMode={viewMode}
          onEdit={handleEditQuizz}
          onDelete={handleDeleteQuizz}
        />
      </div>
    )
  } else if (mode === "history") {
    content = <GameHistory historyList={historyList} _onRefresh={handleRefreshHistory} />
  }

  return (
    <div className="manager-auth-page z-10 flex w-full flex-col gap-5 px-4 py-6 md:px-12 lg:px-24">

      {/* ── Toolbar ── */}
      {mode !== "create" && <div className="manager-toolbar">

        {/* Left: pill tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-900/60 p-1">
          <button
            type="button"
            onClick={() => setMode("select")}
            className={clsx("manager-pill-tab","font-bold", mode === "select" && "manager-pill-tab--active")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
            Quizzes
          </button>

          <button
            type="button"
            onClick={() => setMode("history")}
            className={clsx("manager-pill-tab", "font-bold", mode === "history" && "manager-pill-tab--active")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
            History
          </button>
        </div>

        {/* Right: view toggle + action buttons (quiz tab only) */}
        {mode === "select" && (
          <div className="manager-toolbar-right">
            {/* View mode toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-900/60 p-1">
              <button
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={clsx(
                  "rounded-md p-1.5 transition-colors",
                  viewMode === "grid"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-300 hover:bg-slate-700/70 hover:text-slate-100",
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M3 3.75A.75.75 0 013.75 3h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-4.5A.75.75 0 013 8.25v-4.5ZM11 3.75A.75.75 0 0111.75 3h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5ZM3 11.75a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5ZM11 11.75a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-4.5a.75.75 0 01-.75-.75v-4.5Z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={clsx(
                  "rounded-md p-1.5 transition-colors",
                  viewMode === "list"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-300 hover:bg-slate-700/70 hover:text-slate-100",
                )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75Zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75Zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Start Quiz */}
            <button
              onClick={handleStartQuiz}
              disabled={!selectedQuizzId}
              className="manager-action-btn manager-start-btn whitespace-nowrap rounded-md px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>Start Quiz</span>
            </button>

            {/* Create New */}
            <button
              onClick={() => {
                setEditingQuizz(null)
                setMode("create")
              }}
              className="manager-action-btn manager-create-btn whitespace-nowrap rounded-md px-5 py-2 text-sm font-bold text-white"
            >
              <span>+ Create New</span>
            </button>
          </div>
        )}
      </div>}

      {/* ── Content ── */}
      {content}
    </div>
  )
}

export default ManagerAuthPage