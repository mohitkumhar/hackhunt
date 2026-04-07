import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import { SFX_RESULTS_SOUND } from "@rahoot/web/features/game/utils/constants"
import { useEffect } from "react"
import useSound from "use-sound"

type Props = {
  data: ManagerStatusDataMap["REVERSE_SHOW_RESPONSES"]
}

const CodeResponses = ({
  data: { output, expectedCode, language, totalCorrect, totalWrong, totalPlayers },
}: Props) => {
  const [sfxResults] = useSound(SFX_RESULTS_SOUND, { volume: 0.3 })

  useEffect(() => {
    sfxResults()
  }, [sfxResults])

  const correctPercent = totalPlayers > 0 ? Math.round((totalCorrect / totalPlayers) * 100) : 0

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6 px-4">
      {/* Title */}
      <h2 className="anim-show text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">
        Reverse Programming Results
      </h2>

      {/* Expected Output */}
      <div className="anim-show w-full rounded-xl bg-gray-900/80 p-5 shadow-xl backdrop-blur">
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-400">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <span className="ml-2">Expected Output</span>
        </div>
        <pre className="whitespace-pre-wrap font-mono text-lg text-green-400">{output}</pre>
      </div>

      {/* Reference Solution */}
      <div className="anim-show w-full rounded-xl bg-gray-800/80 p-5 shadow-xl backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-400">
            📝 Reference Solution ({language})
          </span>
          <span className="text-xs text-gray-500 italic">
            Any language producing correct output is accepted
          </span>
        </div>
        <pre className="whitespace-pre-wrap font-mono text-base text-blue-300">{expectedCode}</pre>
      </div>

      {/* Stats */}
      <div className="anim-show flex w-full gap-4">
        <div className="flex flex-1 flex-col items-center rounded-xl bg-green-500/20 p-4 backdrop-blur">
          <span className="text-4xl font-bold text-green-400">{totalCorrect}</span>
          <span className="text-sm font-medium text-green-300">Correct</span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-xl bg-red-500/20 p-4 backdrop-blur">
          <span className="text-4xl font-bold text-red-400">{totalWrong}</span>
          <span className="text-sm font-medium text-red-300">Wrong</span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-xl bg-gray-500/20 p-4 backdrop-blur">
          <span className="text-4xl font-bold text-gray-300">
            {totalPlayers - totalCorrect - totalWrong}
          </span>
          <span className="text-sm font-medium text-gray-400">No Answer</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full">
        <div className="mb-1 flex justify-between text-sm text-white/70">
          <span>Accuracy</span>
          <span>{correctPercent}%</span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-1000"
            style={{ width: `${correctPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default CodeResponses
