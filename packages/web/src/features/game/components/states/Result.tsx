import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import CricleCheck from "@rahoot/web/features/game/components/icons/CricleCheck"
import CricleXmark from "@rahoot/web/features/game/components/icons/CricleXmark"
import { useSocket } from "@rahoot/web/features/game/contexts/socketProvider"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { SFX_RESULTS_SOUND } from "@rahoot/web/features/game/utils/constants"
import { useEffect } from "react"
import { useParams } from "react-router"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["SHOW_RESULT"]
}

const Result = ({
  data: { correct, message, points, myPoints, rank, aheadOfMe, hideRank },
}: Props) => {
  const { socket } = useSocket()
  const { gameId }: { gameId?: string } = useParams()
  const { questionStates } = useQuestionStore()
  const { player, updatePoints } = usePlayerStore()

  const [sfxResults] = useSound(SFX_RESULTS_SOUND, {
    volume: 0.2,
  })

  useEffect(() => {
    updatePoints(myPoints)

    sfxResults()
  }, [sfxResults, updatePoints, myPoints])

  const handleNavigate = (direction: "prev" | "next") => () => {
    if (!player || !hideRank) {
      return
    }

    socket?.emit("player:navigateReverseQuestion", {
      gameId,
      data: { direction },
    })
  }

  return (
    <section className="anim-show relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center">
      {correct ? (
        <CricleCheck className="aspect-square max-h-60 w-full" />
      ) : (
        <CricleXmark className="aspect-square max-h-60 w-full" />
      )}
      <h2 className="mt-1 text-4xl font-bold text-white drop-shadow-lg">
        {message}
      </h2>
      {!hideRank && (
        <p className="mt-1 text-xl font-bold text-white drop-shadow-lg">
          {`You are top ${rank}${aheadOfMe ? `, behind ${aheadOfMe}` : ""}`}
        </p>
      )}
      {correct && points > 0 && (
        <span className="mt-2 rounded bg-black/40 px-4 py-2 text-2xl font-bold text-white drop-shadow-lg">
          +{points}
        </span>
      )}
      {player && hideRank && (
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-4">
          <button
            onClick={handleNavigate("prev")}
            disabled={!questionStates || questionStates.current <= 1}
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-widest text-white transition-all disabled:pointer-events-none disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={handleNavigate("next")}
            disabled={!questionStates || questionStates.current >= questionStates.total}
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-widest text-white transition-all disabled:pointer-events-none disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </section>
  )
}

export default Result
