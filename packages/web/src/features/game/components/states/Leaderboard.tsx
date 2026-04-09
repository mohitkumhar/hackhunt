import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import clsx from "clsx"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { useEvent } from "@rahoot/web/features/game/contexts/socketProvider"
import { useEffect, useState } from "react"

type Props = {
  data: ManagerStatusDataMap["SHOW_LEADERBOARD"]
}

const AnimatedPoints = ({ from, to }: { from: number; to: number }) => {
  const spring = useSpring(from, { stiffness: 1000, damping: 30 })
  const display = useTransform(spring, (value) => Math.round(value))
  const [displayValue, setDisplayValue] = useState(from)

  useEffect(() => {
    spring.set(to)
    const unsubscribe = display.on("change", (latest) => {
      setDisplayValue(latest)
    })
    return unsubscribe
  }, [to, spring, display])

  return <span className="font-mono">{displayValue}</span>
}

const Leaderboard = ({ data: { oldLeaderboard, leaderboard, isQuizz } }: Props) => {
  const [displayedLeaderboard, setDisplayedLeaderboard] = useState(oldLeaderboard)
  const [isAnimating, setIsAnimating] = useState(false)
  const [cooldown, setCooldown] = useState<number | null>(null)

  useEvent("game:cooldown", (sec) => {
    setCooldown(sec)
  })

  const formatTimeStr = (totalSeconds: number | null) => {
    if (totalSeconds === null) return "00:00"
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return h > 0 
      ? `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  useEffect(() => {
    setDisplayedLeaderboard(oldLeaderboard)
    setIsAnimating(false)

    const timer = setTimeout(() => {
      setIsAnimating(true)
      setDisplayedLeaderboard(leaderboard)
    }, 1600)

    return () => clearTimeout(timer)
  }, [oldLeaderboard, leaderboard])

  const top = displayedLeaderboard

  return (
    <section className="anim-show relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center py-10 px-4">
      {isQuizz && (
        <div className="absolute top-0 right-4 sm:top-4 sm:right-8 flex items-center gap-2 bg-[#2a2a35] px-4 py-2 rounded-full border border-gray-700 shadow-xl z-50">
          <span className="text-base sm:text-lg">⏱️</span>
          <span className="text-sm sm:text-base font-mono font-bold text-gray-200 tracking-widest">
            {cooldown !== null ? formatTimeStr(cooldown) : "--:--"}
          </span>
        </div>
      )}

      <h2 className="mb-6 text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl mt-8 sm:mt-0">
        {isQuizz ? "Quiz Round Leaderboard" : "Leaderboard"}
      </h2>

      <div className="w-full max-w-6xl overflow-hidden rounded-xl border border-[#ff9900]/20 bg-[#1a140b]/90 shadow-2xl">
        <div className="flex items-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#ff9900] bg-black/60 border-b border-[#ff9900]/20 sm:text-xs md:text-sm">
          <div className="w-24 text-center">Rank</div>
          <div className="flex-1 px-3">Player Name</div>
          <div className="w-36 text-center">{isQuizz ? 'Min Correct Time' : 'Connected'}</div>
          <div className="w-28 text-right">Total Points</div>
        </div>
        
        <div className="max-h-[62vh] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {top.map((item, index) => {
                const rank = index + 1
                const isFirst = rank === 1
                const isSecond = rank === 2
                const isThird = rank === 3
                
                return (
                  <motion.div
                    layout
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={clsx(
                      "flex items-center px-4 py-3 md:py-4 border-b border-white/5 hover:bg-[#ff9900]/20 transition-colors group",
                      isFirst && "bg-[#ff9900]/10 border-l-4 border-l-[#fde047]",
                      isSecond && "bg-white/5 border-l-4 border-l-[#cbd5e1]",
                      isThird && "bg-[#d97706]/10 border-l-4 border-l-[#d97706]"
                    )}
                  >
                    <div className="w-24 text-center">
                      <span className="text-xl sm:text-2xl">
                        {isFirst && "🥇"}
                        {isSecond && "🥈"}
                        {isThird && "🥉"}
                      </span>
                      {(!isFirst && !isSecond && !isThird) && (
                        <span className="text-lg font-bold text-white/50 group-hover:text-[#ff9900] transition-colors">
                          {rank.toString().padStart(2, "0")}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 px-3 flex flex-col justify-center">
                      <span className="truncate text-base sm:text-lg md:text-xl font-semibold text-white/90">
                        {item.username}
                      </span>
                      {item.teamName && (
                        <span className="mt-0.5 truncate text-xs md:text-sm text-white/40">
                          {item.teamName}
                        </span>
                      )}
                    </div>

                    <div className="w-36 text-center">
                      <span className={clsx(
                        "font-mono text-sm sm:text-base font-bold",
                        isQuizz ? "text-white/40" : (item.connected ? "text-emerald-300" : "text-white/40"),
                      )}>
                        {isQuizz ? "--:--" : (item.connected ? "Yes" : "No")}
                      </span>
                    </div>

                    <div className="w-28 text-right">
                      <span className="font-mono text-lg sm:text-xl font-bold text-[#ff9900]">
                        {isAnimating ? (
                          <AnimatedPoints
                            from={oldLeaderboard.find((u) => u.id === item.id)?.points || 0}
                            to={leaderboard.find((u) => u.id === item.id)?.points || 0}
                          />
                        ) : (
                          <span className="font-mono">{item.points}</span>
                        )}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
    </section>
  )
}

export default Leaderboard
