import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import clsx from "clsx"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
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

const Leaderboard = ({ data: { oldLeaderboard, leaderboard } }: Props) => {
  const [displayedLeaderboard, setDisplayedLeaderboard] = useState(oldLeaderboard)
  const [isAnimating, setIsAnimating] = useState(false)

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
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-start overflow-y-auto pt-8 px-4">
      <h2 className="anim-show text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl shrink-0 mb-6">
        Leaderboard
      </h2>

      {top.length > 0 && (
        <div className="anim-show flex w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1a140b]/90 shadow-2xl backdrop-blur-xl mb-6">
          <div className="flex items-center px-4 md:px-8 py-3 sm:py-4 bg-black/60 border-b border-[#ff9900]/20 text-[10px] sm:text-xs md:text-sm font-bold text-[#ff9900] uppercase tracking-widest shrink-0">
            <div className="w-20 sm:w-24 md:w-32 text-center text-xs md:text-sm">Rank</div>
            <div className="flex-1 px-2 sm:px-4">Player Name</div>
            <div className="w-20 sm:w-24 md:w-32 text-right">Total Points</div>
          </div>
          
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">
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
                          {rank.toString().padStart(2, "0")}
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

                    <div className="w-20 sm:w-24 md:w-32 text-right">
                      <span className={clsx(
                        "text-lg sm:text-xl md:text-2xl font-bold",
                        (isFirst || isSecond || isThird) ? "text-[#ff9900]" : "text-[#ff9900]/70 group-hover:text-[#ff9900] transition-colors"
                      )}>
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
      )}
    </section>
  )
}

export default Leaderboard
