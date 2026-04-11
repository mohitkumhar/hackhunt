import {
    useEvent,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import clsx from "clsx"
import { useMemo, useState } from "react"

type SubmissionState = {
  completionTime: number | null
  points: number
  isCorrect: boolean
}

const formatDuration = (seconds: number | null) => {
  if (!seconds || seconds <= 0) {
    return "--"
  }

  const m = Math.floor(seconds / 60)
  const s = seconds % 60

  return `${m}m ${s.toString().padStart(2, "0")}s`
}

const formatTimeStr = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `00:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

const ReverseManagerActive = () => {
  const { players } = useManagerStore()
  const [submissionMap, setSubmissionMap] = useState<Record<string, SubmissionState>>({})

  useEvent("manager:playerSubmitted", (data) => {
    setSubmissionMap((prev) => ({
      ...prev,
      [data.playerId]: {
        completionTime: data.completionTime,
        points: data.points,
        isCorrect: data.isCorrect,
      },
    }))
  })

  const [timeLeft, setTimeLeft] = useState(3600)

  useEvent("game:cooldown", (count) => {
    setTimeLeft(count)
  })

  const rows = useMemo(() => {
    return [...players].sort((a, b) => {
      const aTime = submissionMap[a.id]?.completionTime ?? Number.POSITIVE_INFINITY
      const bTime = submissionMap[b.id]?.completionTime ?? Number.POSITIVE_INFINITY

      if (aTime !== bTime) {
        return aTime - bTime
      }

      const aPoints = submissionMap[a.id]?.points ?? a.points ?? 0
      const bPoints = submissionMap[b.id]?.points ?? b.points ?? 0

      if (bPoints !== aPoints) {
        return bPoints - aPoints
      }

      return a.username.localeCompare(b.username)
    })
  }, [players, submissionMap])

  const correctCount = rows.filter((player) => submissionMap[player.id]?.isCorrect).length

  return (
    <section className="anim-show relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center py-10 px-4">
      <div className="absolute top-0 right-4 sm:top-4 sm:right-8 flex items-center gap-2 bg-[#2a2a35] px-4 py-2 rounded-full border border-gray-700 shadow-xl">
        <span className="text-base sm:text-lg">⏱️</span>
        <span className="text-sm sm:text-base font-mono font-bold text-gray-200 tracking-widest">
          {formatTimeStr(timeLeft)}
        </span>
      </div>

      <h2 className="mb-6 text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl mt-8 sm:mt-0">
        Output Based Coding Leaderboard
      </h2>

      <div className="w-full max-w-6xl overflow-hidden rounded-xl border border-[#ff9900]/20 bg-[#1a140b]/90 shadow-2xl">
        <div className="flex items-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#ff9900] bg-black/60 border-b border-[#ff9900]/20 sm:text-xs md:text-sm">
          <div className="w-24 text-center">Rank</div>
          <div className="flex-1 px-3">Player Name</div>
          <div className="w-36 text-center">Min Correct Time</div>
          <div className="w-28 text-right">Total Points</div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto custom-scrollbar">
          {rows.map((player, index) => {
            const rank = index + 1
            const isFirst = rank === 1
            const isSecond = rank === 2
            const isThird = rank === 3
            const data = submissionMap[player.id]
            const points = data?.points ?? player.points ?? 0

            return (
              <div
                key={player.id}
                className={clsx(
                  "flex items-center px-4 py-3 md:py-4 border-b border-white/5 hover:bg-[#ff9900]/20 transition-colors group",
                  isFirst && "bg-[#ff9900]/10 border-l-4 border-l-[#fde047]",
                  isSecond && "bg-white/5 border-l-4 border-l-[#cbd5e1]",
                  isThird && "bg-[#d97706]/10 border-l-4 border-l-[#d97706]",
                )}
              >
                <div className="w-24 text-center">
                  <span className="text-xl sm:text-2xl">
                    {isFirst && "🥇"}
                    {isSecond && "🥈"}
                    {isThird && "🥉"}
                  </span>
                  {!isFirst && !isSecond && !isThird && (
                    <span className="text-lg font-bold text-white/50 group-hover:text-[#ff9900] transition-colors">
                      {rank.toString().padStart(2, "0")}
                    </span>
                  )}
                </div>

                <div className="flex-1 px-3 flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-base sm:text-lg md:text-xl font-semibold text-white/90">
                      {player.username}
                    </span>
                    {data && (
                      <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-bold text-green-400 border border-green-500/30">
                        Submitted
                      </span>
                    )}
                  </div>
                  {player.teamName && (
                    <span className="mt-0.5 truncate text-xs md:text-sm text-white/40">
                      {player.teamName}
                    </span>
                  )}
                </div>

                <div className="w-36 text-center">
                  <span className={clsx(
                    "font-mono text-sm sm:text-base font-bold",
                    data?.isCorrect ? "text-emerald-300" : "text-white/40",
                  )}>
                    {formatDuration(data?.completionTime ?? null)}
                  </span>
                </div>

                <div className="w-28 text-right">
                  <span className="font-mono text-lg sm:text-xl font-bold text-[#ff9900]">
                    {points}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 text-sm text-white/60">
        <span className="font-mono text-[#ff9900] font-bold">
          {Object.keys(submissionMap).length}
        </span>
        <span>/</span>
        <span className="font-mono font-bold text-white/80">
          {players.length}
        </span>
        <span>submitted response</span>
      </div>
    </section>
  )
}

export default ReverseManagerActive
