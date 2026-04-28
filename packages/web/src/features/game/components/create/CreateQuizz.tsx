import type { QuizzWithId } from "@rahoot/common/types/game"
import type { CreateQuizzPayload } from "@rahoot/common/types/game/socket"
import Button from "@rahoot/web/features/game/components/Button"
import Input from "@rahoot/web/features/game/components/Input"
import clsx from "clsx"
import { type ChangeEvent, type MouseEvent, useEffect, useState } from "react"
import toast from "react-hot-toast"

type Props = {
  onSubmit: (_payload: CreateQuizzPayload) => void | Promise<void>
  initialData?: QuizzWithId
  managerPassword: string
}

type QuestionForm = {
  questionType: "multiple_choice" | "free_text"
  question: string
  answers: string[]
  solution: number
  cooldown: number
  time: number
  image?: string
  imageFile?: File | null
}

const createEmptyQuestion = (): QuestionForm => ({
  questionType: "multiple_choice",
  question: "",
  answers: ["", "", "", ""],
  solution: 0,
  cooldown: 5,
  time: 20,
  imageFile: null,
})

const revokePreviewUrl = (image?: string) => {
  if (image?.startsWith("blob:")) {
    URL.revokeObjectURL(image)
  }
}

const CreateQuizz = ({ onSubmit, initialData, managerPassword }: Props) => {
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [questions, setQuestions] = useState<QuestionForm[]>([createEmptyQuestion()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const uploadImage = async (file: File): Promise<string> => {
    if (!managerPassword.trim()) {
      throw new Error("Manager authentication is required to upload images")
    }

    const formData = new FormData()
    formData.append("image", file)
    formData.append("maxWidth", "1280")
    formData.append("maxHeight", "720")
    formData.append("quality", "75")

    const response = await fetch("/api/upload-image", {
      method: "POST",
      headers: {
        "x-manager-password": managerPassword,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Upload failed" }))
      throw new Error(errorBody.message || "Upload failed")
    }

    const result = await response.json() as { dataUrl?: string }

    if (!result.dataUrl) {
      throw new Error("Invalid upload response")
    }

    return result.dataUrl
  }

  useEffect(() => {
    questions.forEach((question) => {
      revokePreviewUrl(question.image)
    })

    if (initialData) {
      setSubject(initialData.subject)
      setDescription(initialData.description || "")
      setQuestions(
        initialData.questions.map((q) => ({
          questionType: q.question_type || "multiple_choice",
          question: q.question,
          answers: [...q.answers],
          solution: q.solution,
          cooldown: q.cooldown,
          time: q.time,
          image: q.image,
          imageFile: null,
        }))
      )

      return
    }

    setSubject("")
    setDescription("")
    setQuestions([createEmptyQuestion()])
  }, [initialData])

  const handleAddQuestion = () => {
    setQuestions([...questions, createEmptyQuestion()])
  }

  const handleRemoveQuestion = (indexToRemove: number) => {
    if (questions.length === 1) {
      toast.error("Quiz must have at least 1 question")

      return
    }

    revokePreviewUrl(questions[indexToRemove]?.image)
    setQuestions((currentQuestions) => currentQuestions.filter((_, idx) => idx !== indexToRemove))
  }

  const handleQuestionChange = <K extends keyof QuestionForm>(
    index: number,
    field: K,
    value: QuestionForm[K],
  ) => {
    setQuestions((currentQuestions) => {
      const updatedQuestions = [...currentQuestions]
      updatedQuestions[index] = { ...updatedQuestions[index], [field]: value }

      return updatedQuestions
    })
  }

  const handleAnswerChange = (qIndex: number, aIndex: number, value: string) => {
    setQuestions((currentQuestions) => {
      const updatedQuestions = [...currentQuestions]
      updatedQuestions[qIndex].answers[aIndex] = value

      return updatedQuestions
    })
  }

  const handleQuestionImageChange = (qIndex: number, file: File | null) => {
    if (!file) {
      return
    }

    const previewUrl = URL.createObjectURL(file)

    setQuestions((currentQuestions) => {
      const updatedQuestions = [...currentQuestions]
      const currentImage = updatedQuestions[qIndex]?.image

      revokePreviewUrl(currentImage)
      updatedQuestions[qIndex] = {
        ...updatedQuestions[qIndex],
        imageFile: file,
        image: previewUrl,
      }

      return updatedQuestions
    })
  }

  const handleQuestionImageRemove = (qIndex: number) => {
    setQuestions((currentQuestions) => {
      const updatedQuestions = [...currentQuestions]
      const currentImage = updatedQuestions[qIndex]?.image

      revokePreviewUrl(currentImage)
      updatedQuestions[qIndex] = {
        ...updatedQuestions[qIndex],
        image: undefined,
        imageFile: null,
      }

      return updatedQuestions
    })
  }

  // Khusus untuk Free Text, simpan jawabannya di index 0
  const handleFreeTextAnswerChange = (qIndex: number, value: string) => {
    setQuestions((currentQuestions) => {
      const updatedQuestions = [...currentQuestions]
      updatedQuestions[qIndex].answers[0] = value
      updatedQuestions[qIndex].solution = 0

      return updatedQuestions
    })
  }

  const handleSubmit = async () => {
    if (isSubmitting) {
      return
    }

    const trimmedSubject = subject.trim()

    if (!trimmedSubject) {
      toast.error("Quiz subject is required")

      return
    }

    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i]

      if (!q.question.trim()) {
        toast.error(`Question ${i + 1} is missing text`)

        return
      }

      if (q.questionType === "multiple_choice") {
        const validAnswers = q.answers.map((a) => a.trim()).filter(Boolean)

        if (validAnswers.length < 2) {
          toast.error(`Question ${i + 1} needs at least 2 answers`)

          return
        }

        if (!q.answers[q.solution].trim()) {
          toast.error(`Question ${i + 1} has an empty correct answer selected`)

          return
        }
      } else if (q.questionType === "free_text") {
        if (!q.answers[0].trim()) {
          toast.error(`Question ${i + 1} (Free Text) needs a correct answer key`)

          return
        }
      }
    }

    setIsSubmitting(true)

    try {
      const cleanedQuestions = await Promise.all(questions.map(async (q) => {
        const finalAnswers = q.questionType === "free_text"
          ? [q.answers[0].trim()]
          : q.answers.map((a) => a.trim()).filter(Boolean)

        let finalImage = q.image

        if (q.imageFile) {
          finalImage = await uploadImage(q.imageFile)
        }

        return {
          "question_type": q.questionType,
          question: q.question.trim(),
          answers: finalAnswers,
          solution: q.solution,
          cooldown: q.cooldown,
          time: q.time,
          image: finalImage,
        }
      }))

      await onSubmit({
        subject: trimmedSubject,
        description: description.trim() || undefined,
        questions: cleanedQuestions,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit quiz"
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="create-quizz mx-auto w-full max-w-5xl">
      {/* Input for quiz subject and description */}
      <div className="create-quizz-card create-quizz-card--hero">
        <input
          type="text"
          value={subject}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSubject(event.target.value)}
          placeholder="Quiz Subject"
          className="create-quizz-title-input"
        />
        <input
          type="text"
          value={description}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDescription(event.target.value)}
          placeholder="Description (optional)"
          className="create-quizz-description-input"
        />
      </div>

      <div className="create-quizz-list">
        {questions.map((q, qIndex) => (
          // Question card
          <div key={qIndex} className="create-quizz-question-card">
            <div className="create-quizz-question-head">
              <div>
                <span className="create-quizz-eyebrow">Question {qIndex + 1}</span>
              </div>
            </div>

            {/* For question input and question type selection */}
            <div className="create-quizz-question-row">
              <Input
                value={q.question}
                onChange={(event: ChangeEvent<HTMLInputElement>) => handleQuestionChange(qIndex, "question", event.target.value)}
                placeholder="e.g., Who is the founder of PT SPIL?"
                className="create-quizz-question-input rounded-none"
              />

              <div className="create-quizz-question-tools">
                <input
                  id={`question-image-${qIndex}`}
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null
                    handleQuestionImageChange(qIndex, file)
                    event.target.value = ""
                  }}
                  className="create-quizz-image-input"
                />

                <label
                  htmlFor={`question-image-${qIndex}`}
                  className={clsx(
                    "create-quizz-image-trigger",
                    q.image && "create-quizz-image-trigger-active",
                  )}
                  title={q.image ? "Change question image" : "Add question image"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="create-quizz-image-trigger-icon"
                  >
                    <path d="M5 7h2l1.4-2h7.2L17 7h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                  <span>{q.image ? "Change image" : "Add image"}</span>
                </label>

                <div className="create-quizz-select-wrap">
                  <select
                    value={q.questionType}
                    onChange={(event) =>
                      handleQuestionChange(
                        qIndex,
                        "questionType",
                        event.target.value as QuestionForm["questionType"],
                      )
                    }
                    className="create-quizz-select"
                  >
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="free_text">Free Text</option>
                  </select>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="create-quizz-select-chevron"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {q.image && (
              <div className="create-quizz-image-panel">
                <div className="create-quizz-image-panel-header">
                  <label className="create-quizz-label">Question Image</label>
                  <button
                    type="button"
                    onClick={() => handleQuestionImageRemove(qIndex)}
                    className="create-quizz-image-clear"
                  >
                    Remove image
                  </button>
                </div>

                <div className="create-quizz-image-preview">
                  <img
                    src={q.image}
                    alt={`Question ${qIndex + 1}`}
                    className="create-quizz-image-preview-media"
                  />
                </div>
              </div>
            )}

            {q.questionType === "multiple_choice" ? (
              <div className="create-quizz-answers">
                <label className="create-quizz-label">
                  Select the correct answer 
                  {/* <span className="create-quizz-label-hint">Select the correct answer</span> */}
                </label>
                <div className="create-quizz-answer-grid">
                  {q.answers.map((answer, aIndex) => {
                    const isCorrect = q.solution === aIndex
                    const letter = String.fromCharCode(65 + aIndex)

                    return (
                      <label
                        key={aIndex}
                        onClick={() => handleQuestionChange(qIndex, "solution", aIndex)}
                        className={clsx(
                          "create-quizz-answer-item",
                          isCorrect
                            ? "create-quizz-answer-item-active"
                            : "create-quizz-answer-item-idle",
                        )}
                      >
                        <span className={clsx("create-quizz-answer-letter", isCorrect && "create-quizz-answer-letter-active")}>{letter}</span>
                        <Input
                          type="text"
                          value={answer}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => handleAnswerChange(qIndex, aIndex, event.target.value)}
                          onClick={(event: MouseEvent<HTMLInputElement>) => event.stopPropagation()}
                          placeholder="Answer option"
                          className="create-quizz-answer-input"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : (
              // For Free Text question, only show one input for the correct answer key
              <div className="create-quizz-free-text">
                <label className="create-quizz-label">Input the correct answer</label>
                <Input
                  value={q.answers[0]}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => handleFreeTextAnswerChange(qIndex, event.target.value)}
                  placeholder="Type the expected answer"
                  className="create-quizz-question-input"
                />
              </div>
            )}

            <div className="create-quizz-settings-row">
              <div className="create-quizz-setting-group">
                <label className="create-quizz-setting-label">Cooldown</label>
                <div className="create-quizz-setting-inline">
                  <input
                    type="number"
                    value={String(q.cooldown)}
                    onChange={(event) => handleQuestionChange(qIndex, "cooldown", Number(event.target.value))}
                    min="0"
                    className="create-quizz-setting-input"
                  />
                  <span className="create-quizz-setting-unit">sec</span>
                </div>
              </div>

              <div className="create-quizz-setting-group">
                <label className="create-quizz-setting-label">Time Limit</label>
                <div className="create-quizz-setting-inline">
                  <input
                    type="number"
                    value={String(q.time)}
                    onChange={(event) => handleQuestionChange(qIndex, "time", Number(event.target.value))}
                    min="1"
                    className="create-quizz-setting-input"
                  />
                  <span className="create-quizz-setting-unit">sec</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveQuestion(qIndex)}
                className="create-quizz-remove-btn"
                title="Remove Question"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="create-quizz-actions">
        <Button onClick={handleAddQuestion} disabled={isSubmitting} className="create-quizz-action-btn create-quizz-action-btn-secondary">
          <svg className="create-quizz-action-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Question
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="create-quizz-action-btn create-quizz-action-btn-primary">
          <svg className="create-quizz-action-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {isSubmitting ? "Uploading..." : "Save Quiz"}
        </Button>
      </div>
    </div>
  )
}

export default CreateQuizz
