import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { useEffect, useState } from "react"
import clsx from "clsx"

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

    return () => {
      clearTimeout(timer)
    }
  }, [oldLeaderboard, leaderboard])

  const top3 = displayedLeaderboard.slice(0, 3)
  const rest = displayedLeaderboard.slice(3)

  const podiumPositions = [
    { rank: 2, item: top3[1], height: "h-32", medal: "🥈", color: "from-slate-400 to-slate-600", borderColor: "#cbd5e1" },
    { rank: 1, item: top3[0], height: "h-44", medal: "🥇", color: "from-yellow-400 to-yellow-600", borderColor: "#fde047" },
    { rank: 3, item: top3[2], height: "h-24", medal: "🥉", color: "from-amber-600 to-amber-800", borderColor: "#d97706" },
  ]

  return (
    <section className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center py-10 px-2 sm:px-4 h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-16">
        <span className="text-4xl drop-shadow-md">🏆</span>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-widest text-[#ff9900] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          Leaderboard
        </h2>
        <span className="text-4xl drop-shadow-md">🏆</span>
      </div>
      
      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-2 sm:gap-4 md:gap-6 w-full mb-16">
          {podiumPositions.map(({ rank, item, height, medal, color, borderColor }) => {
            if (!item) return <div key={rank} className="w-24 sm:w-32 md:w-48" />
            
            const isFirst = rank === 1;
            
            return (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className={clsx(
                  "flex flex-col items-center w-24 sm:w-32 md:w-56 transition-all duration-500",
                  isFirst ? "z-10 -translate-y-6 sm:-translate-y-8 scale-105 sm:scale-110" : "z-0 scale-95"
                )}
              >
                <div className="relative flex flex-col items-center w-full">
                  <div className="absolute -top-10 sm:-top-12 z-20 text-4xl sm:text-5xl filter drop-shadow-lg">
                    {medal}
                  </div>
                  
                  <div className="flex flex-col items-center justify-center w-full px-1 sm:px-2 py-3 sm:py-4 bg-[#1a140b] shadow-xl"
                    style={{ 
                      clipPath: "polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%)",
                      borderTop: `4px solid ${borderColor}`
                    }}>
                    <span className="text-xs sm:text-sm md:text-lg font-bold text-white uppercase text-center truncate w-full px-3 sm:px-4 leading-tight mb-1">
                      {item.username}
                    </span>
                    <div className="text-[#ff9900] font-black text-base sm:text-lg md:text-2xl drop-shadow-md">
                      {isAnimating ? (
                        <AnimatedPoints
                          from={oldLeaderboard.find((u) => u.id === item.id)?.points || 0}
                          to={leaderboard.find((u) => u.id === item.id)?.points || 0}
                        />
                      ) : (
                        <span className="font-mono">{item.points}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className={clsx(
                    "w-[80%] sm:w-[85%] mt-2 rounded-t-lg shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] flex items-end justify-center pb-2 bg-gradient-to-b",
                    color, height
                  )}>
                    <span className="text-white/40 text-3xl sm:text-4xl font-black">{rank}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className="w-full max-w-4xl bg-[#1a140b]/90 shadow-2xl rounded-xl border border-[#ff9900]/20 overflow-hidden">
          <div className="flex items-center px-4 md:px-8 py-3 sm:py-4 bg-black/60 border-b border-[#ff9900]/20 text-[10px] sm:text-xs md:text-sm font-bold text-[#ff9900] uppercase tracking-widest">
            <div className="w-12 sm:w-16 md:w-24 text-center">Rank</div>
            <div className="flex-1 px-2 sm:px-4">Player Name</div>
            <div className="w-20 sm:w-24 md:w-32 text-right">Total Points</div>
          </div>
          
          <div className="flex flex-col max-h-[40vh] overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {rest.map((item) => {
                const actualRank = displayedLeaderboard.findIndex(u => u.id === item.id) + 1;
                
                return (
                  <motion.div
                    layout
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center px-4 md:px-8 py-3 sm:py-4 border-b border-white/5 hover:bg-[#ff9900]/10 transition-colors group"
                  >
                    <div className="w-12 sm:w-16 md:w-24 text-center text-base sm:text-lg md:text-xl font-bold text-white/50 group-hover:text-[#ff9900] transition-colors">
                      {actualRank.toString().padStart(2, '0')}
                    </div>
                    <div className="flex-1 px-2 sm:px-4 flex flex-col">
                      <span className="text-base sm:text-lg md:text-xl font-semibold text-white/90 group-hover:text-white transition-colors truncate">
                        {item.username}
                      </span>
                      {item.teamName && (
                        <span className="text-[10px] sm:text-xs md:text-sm font-medium text-white/40 mt-0.5 sm:mt-1 truncate">
                          {item.teamName}
                        </span>
                      )}
                    </div>
                    <div className="w-20 sm:w-24 md:w-32 text-right text-lg sm:text-xl md:text-2xl font-bold text-[#ff9900] group-hover:text-[#ff9900]/80 transition-colors">
                      {isAnimating ? (
                        <AnimatedPoints
                          from={oldLeaderboard.find((u) => u.id === item.id)?.points || 0}
                          to={leaderboard.find((u) => u.id === item.id)?.points || 0}
                        />
                      ) : (
                        <span className="font-mono">{item.points}</span>
                      )}
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
