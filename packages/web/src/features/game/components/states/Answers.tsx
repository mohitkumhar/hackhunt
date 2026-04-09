import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import AnswerButton from "@rahoot/web/features/game/components/AnswerButton"
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
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import clsx from "clsx"
import { useEffect, useState } from "react"
import { useParams } from "react-router"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

// Module-level storage for local quiz answers (persists across re-renders/navigation)
const localQuizzAnswers = new Map<number, number>()

const Answers = ({
  data: { question, answers, image, audio, video, time, totalPlayer, selectedAnswer: initialSelectedAnswer },
}: Props) => {
  const { gameId }: { gameId?: string } = useParams()
  const { socket } = useSocket()
  const { player } = usePlayerStore()
  const { questionStates } = useQuestionStore()

  // Current question index (0-based)
  const currentQIndex = questionStates ? questionStates.current - 1 : 0

  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(
    localQuizzAnswers.get(currentQIndex) ?? initialSelectedAnswer ?? null
  )
  const [showFinalSubmit, setShowFinalSubmit] = useState(false)

  useEffect(() => {
    // When question changes, check local store first, then server value
    const localAnswer = localQuizzAnswers.get(currentQIndex)
    setSelectedAnswer(localAnswer ?? initialSelectedAnswer ?? null)
  }, [initialSelectedAnswer, question, currentQIndex])

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

    setSelectedAnswer(answerKey)
    sfxPop()
  }

  const handleSubmit = () => {
    if (!player || selectedAnswer === null) { return }

    // Store answer locally only — don't send to server yet
    localQuizzAnswers.set(currentQIndex, selectedAnswer)

    // Navigate to next question, or show final submit popup on last question
    if (questionStates && questionStates.current < questionStates.total) {
      socket?.emit("player:navigateQuizzQuestion", {
        gameId,
        data: { direction: "next" },
      })
    } else {
      setShowFinalSubmit(true)
    }
  }

  const handleFinalSubmit = () => {
    // Store current answer locally before sending
    if (selectedAnswer !== null) {
      localQuizzAnswers.set(currentQIndex, selectedAnswer)
    }

    // Build answers object from local store
    const allAnswers: Record<string, number> = {}
    localQuizzAnswers.forEach((value, key) => {
      allAnswers[key.toString()] = value
    })

    // Send ALL answers to server at once
    socket?.emit("player:finishQuizz", { gameId, data: { answers: allAnswers } })

    // Clear local store
    localQuizzAnswers.clear()
    setShowFinalSubmit(false)
  }

  const handleNavigate = (direction: "prev" | "next") => () => {
    if (!player) { return }
    socket?.emit("player:navigateQuizzQuestion", {
      gameId,
      data: { direction },
    })
  }

  const formatTimeStr = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return h > 0 
      ? `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  useEffect(() => {
    if (video || audio) {
      return
    }

    playMusic()

    // eslint-disable-next-line consistent-return
    return () => {
      stopMusic()
    }
  }, [playMusic])

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

        {Boolean(audio) && !player && (
          <audio
            className="m-4 mb-2 w-auto rounded-md"
            src={audio}
            autoPlay
            controls
          />
        )}

        {Boolean(video) && !player && (
          <video
            className="m-4 mb-2 aspect-video max-h-60 w-auto rounded-md px-4 sm:max-h-100"
            src={video}
            autoPlay
            controls
          />
        )}

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
            <span>{formatTimeStr(cooldown)}</span>
          </div>
          <div className="flex flex-col items-center rounded-full bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">Answers</span>
            <span>
              {totalAnswer}/{totalPlayer}
            </span>
          </div>
        </div>

        <div className="mx-auto mb-4 grid w-full max-w-7xl grid-cols-2 gap-1 rounded-full px-2 text-lg font-bold text-white md:text-xl">
          {answers.map((answer, key) => (
            <AnswerButton
              key={key}
              className={clsx(ANSWERS_COLORS[key], selectedAnswer === key ? "ring-4 ring-white scale-[1.02] shadow-2xl z-10" : selectedAnswer !== null ? "opacity-50" : "")}
              icon={ANSWERS_ICONS[key]}
              onClick={handleAnswer(key)}
            >
              {answer}
            </AnswerButton>
          ))}
        </div>

        {/* Navigation Buttons for Async Quizz */}
        <div className="mx-auto mb-4 flex w-full max-w-7xl justify-between gap-4 px-2">
          {player ? (
            <button
              onClick={handleNavigate("prev")}
              disabled={!questionStates || questionStates.current <= 1}
              className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-white/20 disabled:pointer-events-none disabled:opacity-40"
            >
              Previous
            </button>
          ) : <div />}
          
          <div className="flex-1" />

          {player ? (
            <button
              onClick={handleNavigate("next")}
              disabled={!questionStates || questionStates.current >= questionStates.total}
              className="rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-white/20 disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          ) : <div />}
        </div>
        
        {/* Submit Button for Manual Submission */}
        {player && (
          <div className="mx-auto mb-6 flex w-full max-w-7xl justify-center px-2">
            <button
              onClick={handleSubmit}
              disabled={selectedAnswer === null}
              className="w-full max-w-xs rounded-lg border border-white/20 bg-orange-500/90 hover:bg-orange-600/90 px-6 py-4 text-lg font-bold uppercase tracking-widest text-white shadow-md transition-all disabled:pointer-events-none disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showFinalSubmit && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex w-11/12 max-w-md flex-col items-center rounded-2xl bg-orange-600 p-8 text-center shadow-2xl">
            <h2 className="mb-4 text-3xl font-bold text-white drop-shadow-md">Submit Quiz?</h2>
            <p className="mb-8 text-lg text-white/90">Are you sure you want to finalize your answers and submit the entire quiz?</p>
            <div className="flex w-full gap-4">
              <button
                onClick={() => setShowFinalSubmit(false)}
                className="flex-1 rounded-xl bg-black/20 px-6 py-4 font-bold text-white transition-colors hover:bg-black/40 shadow-lg"
              >
                No, Go Back
              </button>
              <button
                onClick={handleFinalSubmit}
                className="flex-1 rounded-xl bg-white px-6 py-4 font-bold text-orange-600 transition-colors hover:bg-gray-100 shadow-lg"
              >
                Yes, Submit!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Answers
