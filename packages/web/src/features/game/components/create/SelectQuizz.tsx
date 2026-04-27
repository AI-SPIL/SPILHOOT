import type { QuizzWithId } from "@rahoot/common/types/game"
import clsx from "clsx"
import { type MouseEvent, useState } from "react"

const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const IconDelete = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

type Props = {
  quizzList: QuizzWithId[]
  selectedId: string | null
  onSelect: (_id: string | null) => void
  viewMode: "list" | "grid"
  onEdit?: (_quizz: QuizzWithId) => void
  onDelete?: (_quizzId: string) => void
}

const SelectQuizz = ({ quizzList, selectedId, onSelect, viewMode, onEdit, onDelete }: Props) => {
  const [pendingDelete, setPendingDelete] = useState<QuizzWithId | null>(null)

  const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))

  const handleSelect = (id: string) => () => {
    onSelect(selectedId === id ? null : id)
  }

  const handleEdit = (e: MouseEvent, quizz: QuizzWithId) => {
    e.stopPropagation()
    onEdit?.(quizz)
  }

  const handleDelete = (e: MouseEvent, quizz: QuizzWithId) => {
    e.stopPropagation()
    setPendingDelete(quizz)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) {
      return
    }

    onDelete?.(pendingDelete.id)
    setPendingDelete(null)
  }

  const hasActions = onEdit || onDelete

  return (
    <div className="select-quizz z-10 flex w-full flex-col gap-4">
      <div className={clsx(
        "select-quizz-list w-full",
        viewMode === "list" ? "flex flex-col space-y-2" : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      )}>
        {quizzList.map((quizz) => (
          <div key={quizz.id} className="select-quizz-card group relative">
            <button
              className={clsx(
                "select-quizz-item w-full rounded-md p-4 text-left transition-all",
                "flex flex-col justify-center",
                selectedId === quizz.id && "select-quizz-item-selected",
                viewMode === "list" ? "min-h-16 pr-32" : "min-h-32 pt-10"
              )}
              onClick={handleSelect(quizz.id)}
            >
              <div className="select-quizz-content">
                <span className={clsx("select-quizz-title", viewMode === "grid" && "line-clamp-2")}>
                  {quizz.subject}
                </span>
                <div className="select-quizz-meta">
                  <span className="select-quizz-meta-item">
                    Last modified {formatDateTime(quizz.updated_at)}
                  </span>
                </div>
              </div>
            </button>

            {hasActions && (
              <div className={clsx(
                "select-quizz-actions absolute",
                viewMode === "list" ? "right-4 top-1/2 -translate-y-1/2" : "right-2 top-2"
              )}>
                <button
                  onClick={(e) => handleEdit(e, quizz)}
                  className="select-quizz-action-btn select-quizz-edit-btn"
                  title="Edit quiz"
                  aria-label={`Edit ${quizz.subject}`}
                >
                  <IconEdit />
                </button>
                <button
                  onClick={(e) => handleDelete(e, quizz)}
                  className="select-quizz-action-btn select-quizz-delete-btn"
                  title="Delete quiz"
                  aria-label={`Delete ${quizz.subject}`}
                >
                  <IconDelete />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {pendingDelete && (
        <div className="select-quizz-delete-modal-overlay" role="dialog" aria-modal="true">
          <div className="select-quizz-delete-modal">
            <h3 className="select-quizz-delete-modal-title">Delete Quiz?</h3>
            <p className="select-quizz-delete-modal-text">
              Are you sure you want to delete <strong>{pendingDelete.subject}</strong>?
            </p>
            <div className="select-quizz-delete-modal-actions">
              <button
                type="button"
                className="select-quizz-delete-modal-btn select-quizz-delete-modal-btn-cancel"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="select-quizz-delete-modal-btn select-quizz-delete-modal-btn-confirm"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SelectQuizz