import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import {
  SFX_PODIUM_FIRST,
  SFX_PODIUM_SECOND,
  SFX_PODIUM_THREE,
  SFX_SNEAR_ROOL,
} from "@rahoot/web/features/game/utils/constants"
import useScreenSize from "@rahoot/web/hooks/useScreenSize"
import clsx from "clsx"
import { useEffect, useState } from "react"
import ReactConfetti from "react-confetti"
import useSound from "use-sound"

type Props = {
  data: ManagerStatusDataMap["FINISHED"]
}

const usePodiumAnimation = (topLength: number) => {
  const [apparition, setApparition] = useState(0)

  const [sfxtThree] = useSound(SFX_PODIUM_THREE, { volume: 0.2 })
  const [sfxSecond] = useSound(SFX_PODIUM_SECOND, { volume: 0.2 })
  const [sfxRool, { stop: sfxRoolStop }] = useSound(SFX_SNEAR_ROOL, {
    volume: 0.2,
  })
  const [sfxFirst] = useSound(SFX_PODIUM_FIRST, { volume: 0.2 })

  useEffect(() => {
    const actions: Partial<Record<number, () => void>> = {
      4: () => {
        sfxRoolStop()
        sfxFirst()
      },
      3: sfxRool,
      2: sfxSecond,
      1: sfxtThree,
    }

    actions[apparition]?.()
  }, [apparition, sfxFirst, sfxSecond, sfxtThree, sfxRool, sfxRoolStop])

  useEffect(() => {
    if (topLength < 3) {
      setApparition(4)

      return
    }

    if (apparition >= 4) {
      return
    }

    const interval = setInterval(() => {
      setApparition((value) => value + 1)
    }, 2000)

    // eslint-disable-next-line consistent-return
    return () => clearInterval(interval)
  }, [apparition, topLength])

  return apparition
}

const Podium = ({ data: { subject, top, blindSubmissionsHistory } }: Props) => {
  const apparition = usePodiumAnimation(top.length)

  const { width, height } = useScreenSize()

  return (
    <>
      {apparition >= 4 && (
        <ReactConfetti
          width={width}
          height={height}
          className="h-full w-full"
        />
      )}

      {apparition >= 3 && top.length >= 3 && (
        <div className="pointer-events-none absolute min-h-dvh w-full overflow-hidden">
          <div className="spotlight"></div>
        </div>
      )}
      <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-start overflow-y-auto pt-8">
        <h2 className="anim-show text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl shrink-0">
          {subject}
        </h2>

        <div
          className={clsx(
            "w-full max-w-5xl bg-[#1a140b]/90 shadow-2xl rounded-xl border border-[#ff9900]/20 overflow-hidden mb-12 flex-1 flex flex-col transition-all duration-1000",
            apparition >= 2 ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          )}
        >
          <div className="flex items-center px-4 md:px-8 py-3 sm:py-4 bg-black/60 border-b border-[#ff9900]/20 text-[10px] sm:text-xs md:text-sm font-bold text-[#ff9900] uppercase tracking-widest shrink-0">
            <div className="w-20 sm:w-24 md:w-32 text-center text-xs md:text-sm">Rank</div>
            <div className="flex-1 px-2 sm:px-4">Player Name</div>
            <div className="w-20 sm:w-24 md:w-32 text-right">Total Points</div>
          </div>
          
          <div className="flex flex-col flex-1 overflow-y-auto">
            {top.map((item, index) => {
              const rank = index + 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;
              
              return (
                <div
                  key={item.id}
                  className={clsx(
                    "flex items-center px-4 md:px-8 py-3 sm:py-4 border-b border-white/5 hover:bg-[#ff9900]/20 transition-colors group",
                    isFirst && "bg-[#ff9900]/10 border-l-4 border-l-[#fde047]",
                    isSecond && "bg-white/5 border-l-4 border-l-[#cbd5e1]",
                    isThird && "bg-[#d97706]/10 border-l-4 border-l-[#d97706]"
                  )}
                >
                  <div className="w-20 sm:w-24 md:w-32 flex flex-col items-center justify-center gap-1 group-hover:scale-110 transition-transform">
                    <span className="text-2xl sm:text-3xl">
                      {isFirst && "🥇"}
                      {isSecond && "🥈"}
                      {isThird && "🥉"}
                    </span>
                    {(!isFirst && !isSecond && !isThird) && (
                      <span className="text-lg sm:text-xl md:text-2xl font-bold text-white/50 group-hover:text-[#ff9900] transition-colors">
                        {rank.toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 px-2 sm:px-4 flex flex-col justify-center">
                    <span className={clsx(
                      "text-base sm:text-lg md:text-xl font-semibold transition-colors truncate",
                      (isFirst || isSecond || isThird) ? "text-[#ff9900] font-bold" : "text-white/90 group-hover:text-white"
                    )}>
                      {item.username}
                      {isFirst && <span className="ml-3 text-xs bg-[#fde047]/20 text-[#fde047] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Winner</span>}
                    </span>
                    {item.teamName && (
                      <span className="text-[10px] sm:text-xs md:text-sm font-medium text-white/40 mt-0.5 sm:mt-1 truncate">
                        {item.teamName}
                      </span>
                    )}
                  </div>
                  
                  <div className={clsx(
                    "w-20 sm:w-24 md:w-32 text-right text-lg sm:text-xl md:text-2xl font-bold transition-colors font-mono",
                    (isFirst || isSecond || isThird) ? "text-white" : "text-[#ff9900] group-hover:text-[#ff9900]/80"
                  )}>
                    {item.points}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {blindSubmissionsHistory && blindSubmissionsHistory.length > 0 && (
          <div className="w-full mt-12 bg-gray-900/90 p-6 rounded-xl border border-white/20 backdrop-blur shrink-0 mb-12">
            <h3 className="text-2xl font-bold text-white mb-6">Review Submissions</h3>
            {blindSubmissionsHistory.map((history, idx) => {
              const submittedCount = history.submissions.filter((s) => s.submitted).length
              const totalCount = history.submissions.length

              return (
                <div key={idx} className="mb-8 last:mb-0">
                  <h4 className="text-xl text-yellow-400 font-bold flex items-center gap-3 mb-4 border-b border-white/10 pb-2">
                    <span>Q{idx + 1}: {history.question}</span>
                    <span className="text-sm font-medium bg-white/10 text-white/80 px-2 py-0.5 rounded-full">
                      {submittedCount} / {totalCount} submitted
                    </span>
                  </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {history.submissions.map((sub, sidx) => (
                    <div key={sidx} className={`p-4 rounded-lg shadow ${sub.submitted ? "bg-gray-800" : "bg-red-900/30"}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-white">{sub.username}</span>
                        {sub.submitted && (
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                            {sub.language || history.language}
                          </span>
                        )}
                      </div>
                      <div className="bg-gray-950 p-3 rounded overflow-x-auto max-h-48 overflow-y-auto">
                        {sub.submitted ? (
                          <pre className="text-sm text-green-400">
                            {sub.code}
                          </pre>
                        ) : (
                          <p className="text-sm text-red-400 italic">No code was submitted</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

export default Podium
