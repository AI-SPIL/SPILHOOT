import type { GameHistoryItem } from "@rahoot/common/types/game"
import { useState } from "react"

type Props = {
  historyList: GameHistoryItem[]
  _onRefresh?: () => void
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const getMedal = (index: number) => {
  if (index === 0) {
    return "🥇"
  }

  if (index === 1) {
    return "🥈"
  }

  return "🥉"
}

const GameHistory = ({ historyList }: Props) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredHistory = historyList.filter((session) =>
    session.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleExpand = (id: string) => {
    setExpandedId((prevId) => (prevId === id ? null : id))
  }

  return (
    <div className="game-history">
      <div className="game-history-header">
        <h2 className="game-history-title">Game History</h2>
        <div className="game-history-controls">
          <input
            type="text"
            placeholder="Search quiz subject..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="game-history-search-input"
          />
        </div>
      </div>

      <div className="game-history-accordion-wrapper">
        {filteredHistory.map((session) => {
          const isExpanded = expandedId === session.id

          const topPlayers = session.topPlayers
            ? [...session.topPlayers]
                .sort((a, b) => b.points - a.points)
                .slice(0, 3)
            : []

          return (
            <div key={session.id} className="game-history-accordion-item">
              <button
                className="game-history-accordion-trigger"
                onClick={() => toggleExpand(session.id)}
                aria-expanded={isExpanded}
              >
                <div className="game-history-subject">
                  <span className="game-history-subject-title">
                    <strong>{session.subject}</strong>
                  </span>
                </div>
                <div className="game-history-meta">
                  <span>{formatDateTime(session.startedAt)}</span>
                  <span>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="game-history-accordion-content">
                  <h4>Top 3 Players</h4>

                  {topPlayers.length > 0 ? (
                    <ul className="game-history-top-players-list">
                      {topPlayers.map((player, index) => (
                        <li
                          key={`${session.id}-${player.username}`}
                          className="game-history-top-player-row"
                        >
                          <div className="game-history-top-player-info">
                            <span className="game-history-top-player-medal">
                              {getMedal(index)}
                            </span>
                            <span className="game-history-top-player-name">
                              {player.username}
                            </span>
                          </div>
                          <span className="game-history-top-player-points">
                            {player.points.toLocaleString()} pts
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No players recorded for this session.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredHistory.length === 0 && (
        <div className="game-history-empty">
          {historyList.length === 0
            ? "No game history recorded yet."
            : "No quiz found matching your search."}
        </div>
      )}
    </div>
  )
}

export default GameHistory