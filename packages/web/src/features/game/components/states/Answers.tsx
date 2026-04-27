import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import AnswerButton from "@rahoot/web/features/game/components/AnswerButton"
import Input from "@rahoot/web/features/game/components/Input"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import {
  ANSWERS_COLORS,
  ANSWERS_ICONS,
  SFX_ANSWERS_MUSIC,
  SFX_ANSWERS_SOUND,
} from "@rahoot/web/features/game/utils/constants"
import clsx from "clsx"
import { useEffect, useState } from "react"
import { useParams } from "react-router"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

const Answers = ({
  data: {
    question,
    questionType,
    answers,
    image,
    time,
    totalPlayer,
  },
}: Props) => {
  const { gameId }: { gameId?: string } = useParams()
  const { socket } = useSocket()
  const { player } = usePlayerStore()

  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const [textAnswer, setTextAnswer] = useState("")

  const [sfxPop] = useSound(SFX_ANSWERS_SOUND, {
    volume: 0.1,
  })

  const [playMusic, { stop: stopMusic }] = useSound(SFX_ANSWERS_MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  const handleAnswer = (answerKey: number) => () => {
    if (!player) {
      return
    }

    socket?.emit("player:selectedAnswer", {
      gameId,
      data: {
        answerKey,
      },
    })
    sfxPop()
  }
  useEffect(() => {
    playMusic()

     
    return () => {
      stopMusic()
    }
  }, [playMusic])

  const handleSubmitTextAnswer = () => {
    if (!player) {
      return
    }

    const trimmed = textAnswer.trim()

    if (!trimmed) {
      return
    }

    socket?.emit("player:selectedAnswer", {
      gameId,
      data: {
        answerKey: trimmed,
      },
    })
    sfxPop()
  }


  useEffect(() => {
    setTextAnswer("")
  }, [question])

  useEvent("game:cooldown", (sec) => {
    setCooldown(sec)
  })

  useEvent("game:playerAnswer", (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      <div className="mx-auto inline-flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5">
        <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
          {question}
        </h2>

        {Boolean(image) && (
          <img
            alt={question}
            src={image}
            className="mb-2 max-h-60 w-auto rounded-md px-4 sm:max-h-100"
          />
        )}
      </div>

      <div>
        <div className="mx-auto mb-4 flex w-full max-w-7xl justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
          <div className="flex flex-col items-center rounded-full bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">Time</span>
            <span>{cooldown}</span>
          </div>
          <div className="flex flex-col items-center rounded-full bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">Answers</span>
            <span>
              {totalAnswer}/{totalPlayer}
            </span>
          </div>
        </div>

        {questionType === "free_text" ? (
          <div className="mx-auto mb-4 w-full max-w-3xl px-2">
            <div className="free-text-answer-panel">
              <p className="free-text-answer-title">Type Your Answer</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={textAnswer}
                  onChange={(event) => setTextAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSubmitTextAnswer()
                    }
                  }}
                  className="free-text-answer-input"
                  placeholder="Write your answer here"
                />
                <button
                  type="button"
                  className="free-text-answer-submit"
                  onClick={handleSubmitTextAnswer}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto mb-4 grid w-full max-w-7xl grid-cols-2 gap-1 rounded-full px-2 text-lg font-bold text-white md:text-xl">
            {answers.map((answer, key) => (
              <AnswerButton
                key={key}
                className={clsx(ANSWERS_COLORS[key])}
                icon={ANSWERS_ICONS[key]}
                onClick={handleAnswer(key)}
              >
                {answer}
              </AnswerButton>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Answers
