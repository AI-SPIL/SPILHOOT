import type { Player } from "@rahoot/common/types/game"
import type { StatusDataMap } from "@rahoot/common/types/game/status"
import {
  createStatus,
  type Status,
} from "@rahoot/web/features/game/utils/createStatus"
import { create } from "zustand"

type ManagerStore<T> = {
  gameId: string | null
  status: Status<T> | null
  players: Player[]
  isAuthenticated: boolean

  setGameId: (_gameId: string | null) => void
  setStatus: <K extends keyof T>(_name: K, _data: T[K]) => void
  resetStatus: () => void
  setPlayers: (_players: Player[]) => void
  setIsAuthenticated: (_isAuthenticated: boolean) => void

  reset: () => void
  resetGame: () => void
}

const MANAGER_AUTH_KEY = "manager_auth"

const getInitialState = () => {
  const isAuthenticated =
    typeof window !== "undefined"
      ? sessionStorage.getItem(MANAGER_AUTH_KEY) === "true"
      : false

  return {
    gameId: null,
    status: null,
    players: [],
    isAuthenticated,
  }
}

export const useManagerStore = create<ManagerStore<StatusDataMap>>((set) => ({
  ...getInitialState(),

  setGameId: (gameId) => set({ gameId }),

  setStatus: (name, data) => set({ status: createStatus(name, data) }),
  resetStatus: () => set({ status: null }),

  setPlayers: (players) => set({ players }),
  setIsAuthenticated: (isAuthenticated) => {
    sessionStorage.setItem(MANAGER_AUTH_KEY, String(isAuthenticated))
    if (!isAuthenticated) {
      sessionStorage.removeItem("manager_password")
    }
    set({ isAuthenticated })
  },

  reset: () => {
    sessionStorage.setItem(MANAGER_AUTH_KEY, "false")
    sessionStorage.removeItem("manager_password")
    set({ gameId: null, status: null, players: [], isAuthenticated: false })
  },
  resetGame: () => set({ gameId: null, status: null, players: [] }),
}))
