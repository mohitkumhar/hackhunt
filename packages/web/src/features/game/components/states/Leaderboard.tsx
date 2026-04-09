import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import clsx from "clsx"
import { AnimatePresence, motion, useSpring, useTransform } from "motion/react"
import { useEvent } from "@rahoot/web/features/game/contexts/socketProvider"
import { useEffect, useState } from "react"
import ReactConfetti from "react-confetti"
import useScreenSize from "@rahoot/web/hooks/useScreenSize"

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
  
  const { width, height } = useScreenSize()

  useEvent("game:cooldown", (sec) => {
    setCooldown(sec)
  })

  // Format seconds into mm:ss or hh:mm:ss
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
    <>
      <div className="pointer-events-none absolute min-h-dvh w-full overflow-hidden z-0">
        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
      </div>
      <div className="absolute inset-0 pointer-events-none z-50">
        <ReactConfetti
          width={width}
          height={height}
          recycle={true}
          numberOfPieces={150}
          gravity={0.08}
          colors={['#ff9900', '#fde047', '#3b82f6', '#ec4899', '#22c55e', '#ef4444', '#a855f7']}
          initialVelocityY={20}
        />
      </div>

      <section className="anim-show relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center py-10 px-4 z-40">
        {isQuizz && cooldown !== null && (
          <div className="absolute top-0 right-4 sm:top-4 sm:right-8 flex items-center gap-2 bg-[#2a2a35] px-4 py-2 rounded-full border border-gray-700 shadow-xl">
            <span className="text-base sm:text-lg">⏱️</span>
            <span className="text-sm sm:text-base font-mono font-bold text-gray-200 tracking-widest">
              {formatTimeStr(cooldown)}
            </span>
          </div>
        )}

        {/* Title updated to be closer to what the mock requested and stand out */}
        <h2 className="mb-8 text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl mt-8 sm:mt-0 font-sans tracking-wide shrink-0">
          {isQuizz ? "Quiz Round Leaderboard" : "Leaderboard"}
        </h2>

        <div className="w-full max-w-6xl overflow-hidden rounded-xl bg-[#110d07] border border-[#ff9900]/20 shadow-2xl shrink-0 z-40">
          {/* Header Row */}
          <div className="flex items-center px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff9900] bg-black sm:text-xs">
            <div className="w-24 pl-5">Rank</div>
            <div className="flex-1 px-4">Player Name</div>
            <div className="w-36 text-right pr-4">Total Points</div>
          </div>
          
          <div className="max-h-[62vh] overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {top.length === 0 && (
                <div className="flex justify-center py-12">
                   <p className="text-white/40 italic">No players available yet.</p>
                </div>
              )}
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
                        "flex items-center px-6 py-5 border-b border-white/5 transition-colors group relative",
                        isFirst ? "bg-white/5" : (index % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"),
                        !isFirst && "hover:bg-[#ff9900]/10"
                      )}
                    >
                      {/* Left border highlight for top 3 */}
                      {isFirst && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#fde047] to-[#eab308]" />}
                      {isSecond && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-zinc-300 to-zinc-400" />}
                      {isThird && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-600 to-amber-700" />}

                      {/* Rank Medal */}
                      <div className="w-24 pl-3 flex items-center">
                         {isFirst || isSecond || isThird ? (
                            <span className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-lg shadow-lg ${
                              isFirst ? "bg-gradient-to-br from-[#fde047] to-[#eab308] text-amber-950" :
                              isSecond ? "bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-900" :
                              "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100"
                            }`}>
                              {rank.toString()}
                            </span>
                         ) : (
                            <span className="text-xl font-bold text-white/40 group-hover:text-white/70 transition-colors ml-3 tracking-wider">
                              {rank.toString().padStart(2, "0")}
                            </span>
                         )}
                      </div>
                      
                      {/* Player Info */}
                      <div className="flex-1 px-4 flex flex-col justify-center relative">
                        <div className="flex items-center gap-4">
                            <span className={clsx(
                                "truncate text-lg md:text-xl font-semibold",
                                isFirst ? "text-[#fde047]" : "text-white/90"
                            )}>
                              {item.username}
                            </span>
                            {isFirst && (
                                <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-widest rounded-full bg-[#fde047]/20 text-[#fde047] border border-[#fde047]">
                                    WINNER
                                </span>
                            )}
                        </div>
                        {item.teamName && (
                          <span className="mt-0.5 truncate text-xs md:text-sm text-white/40 font-medium tracking-wide">
                            {item.teamName}
                          </span>
                        )}
                      </div>

                      {/* Points */}
                      <div className="w-36 text-right pr-4">
                        <span className={clsx("font-bold tracking-tight text-xl sm:text-2xl", 
                           isFirst ? "text-[#fde047] drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]" : "text-white/90"
                        )}>
                          {isAnimating ? (
                            <AnimatedPoints
                              from={oldLeaderboard.find((u) => u.id === item.id)?.points || 0}
                              to={leaderboard.find((u) => u.id === item.id)?.points || 0}
                            />
                          ) : (
                            <span>{item.points}</span>
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
    </>
  )
}

export default Leaderboard
