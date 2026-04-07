import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import { SFX_RESULTS_SOUND } from "@rahoot/web/features/game/utils/constants"
import { useEffect, useState } from "react"
import useSound from "use-sound"

type Props = {
  data: ManagerStatusDataMap["BLIND_CODING_SHOW_RESPONSES"]
}

const BlindCodingResponses = ({
  data: { title, description, language, submissions, totalSubmitted, totalPlayers },
}: Props) => {
  const [sfxResults] = useSound(SFX_RESULTS_SOUND, { volume: 0.3 })
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [revealAll, setRevealAll] = useState(false)

  useEffect(() => {
    sfxResults()
  }, [sfxResults])

  const submittedPercent =
    totalPlayers > 0 ? Math.round((totalSubmitted / totalPlayers) * 100) : 0

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col items-center justify-start gap-4 overflow-y-auto px-4 py-2">
      {/* Title */}
      <h2 className="anim-show text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">
        🔮 Blind Coding — Reveal
      </h2>

      {/* Problem Info */}
      <div className="anim-show w-full rounded-xl bg-gray-900/80 p-4 shadow-xl backdrop-blur">
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-white/70">{description}</p>
        <span className="mt-2 inline-block rounded-full bg-blue-500/20 px-3 py-0.5 text-xs font-medium text-blue-400">
          {language}
        </span>
      </div>

      {/* Stats */}
      <div className="anim-show flex w-full gap-4">
        <div className="flex flex-1 flex-col items-center rounded-xl bg-green-500/20 p-3 backdrop-blur">
          <span className="text-3xl font-bold text-green-400">
            {totalSubmitted}
          </span>
          <span className="text-xs font-medium text-green-300">Submitted</span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-xl bg-red-500/20 p-3 backdrop-blur">
          <span className="text-3xl font-bold text-red-400">
            {totalPlayers - totalSubmitted}
          </span>
          <span className="text-xs font-medium text-red-300">Missed</span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-xl bg-blue-500/20 p-3 backdrop-blur">
          <span className="text-3xl font-bold text-blue-300">
            {submittedPercent}%
          </span>
          <span className="text-xs font-medium text-blue-300">
            Submission Rate
          </span>
        </div>
      </div>

      {/* Reveal All Toggle */}
      <div className="w-full flex justify-end">
        <button
          onClick={() => setRevealAll(!revealAll)}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/20"
        >
          {revealAll ? "🙈 Hide All Code" : "👁️ Reveal All Code"}
        </button>
      </div>

      {/* Submissions */}
      <div className="w-full space-y-3">
        {submissions.map((submission, idx) => {
          const isExpanded =
            revealAll || expandedPlayer === submission.username

          return (
            <div
              key={idx}
              className={`anim-show rounded-xl overflow-hidden shadow-lg transition-all ${
                submission.submitted
                  ? "bg-gray-800/80 backdrop-blur"
                  : "bg-gray-800/40 backdrop-blur opacity-60"
              }`}
            >
              {/* Player Header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                onClick={() =>
                  setExpandedPlayer(
                    expandedPlayer === submission.username
                      ? null
                      : submission.username,
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      submission.submitted
                        ? "bg-green-500/30 text-green-400"
                        : "bg-red-500/30 text-red-400"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span className="font-bold text-white">
                    {submission.username}
                  </span>
                  {submission.submitted ? (
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                      ✓ Submitted
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                      ✗ No submission
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {submission.submitted && (
                    <span className="text-xs text-gray-400">
                      {submission.code.length} chars
                    </span>
                  )}
                  <span className="text-gray-400 text-lg">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* Code Reveal */}
              {isExpanded && submission.submitted && (
                <div className="border-t border-white/10 bg-gray-950/80 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                    <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    <span className="ml-2">
                      {submission.username}'s blind code ({submission.language || language})
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-sm text-green-400 leading-relaxed max-h-60 overflow-y-auto">
                    {submission.code}
                  </pre>
                </div>
              )}

              {isExpanded && !submission.submitted && (
                <div className="border-t border-white/10 bg-gray-950/50 p-4">
                  <p className="text-center text-sm text-gray-500 italic">
                    No code was submitted
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default BlindCodingResponses
