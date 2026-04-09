import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import {
  SFX_PODIUM_FIRST,
  SFX_PODIUM_SECOND,
  SFX_PODIUM_THREE,
  SFX_SNEAR_ROOL,
} from "@rahoot/web/features/game/utils/constants"
import useScreenSize from "@rahoot/web/hooks/useScreenSize"
import clsx from "clsx"
import { motion, AnimatePresence } from "motion/react"
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

const Podium = ({ data: { subject, top, blindPlayerResults, blindSubmissionsHistory } }: Props) => {
  const apparition = usePodiumAnimation(top.length)
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set())
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())

  const togglePlayer = (username: string) => {
    setExpandedPlayers((prev) => {
      const next = new Set(prev)
      if (next.has(username)) {
        next.delete(username)
      } else {
        next.add(username)
      }
      return next
    })
  }

  const toggleQuestion = (playerUsername: string, questionIdx: number) => {
    const key = `${playerUsername}-${questionIdx}`
    setExpandedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const { width, height } = useScreenSize()

  // Format seconds into mm:ss or hh:mm:ss
  const formatTime = (seconds: number) => {
    if (!seconds) {return "Did not finish"}

    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60

    if (h > 0) {return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`}
    
return `${m}m ${s.toString().padStart(2, "0")}s`
  }

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

        {blindPlayerResults && blindPlayerResults.length > 0 ? (
          <div className="w-full mt-8 mb-12 shrink-0">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Leaderboard & Submissions</h3>
            {blindPlayerResults.map((player, idx) => {
              const rank = idx + 1
              const medalColors = ["from-yellow-400 to-amber-500", "from-zinc-300 to-zinc-400", "from-amber-600 to-amber-700"]
              const medalBg = rank <= 3 ? medalColors[rank - 1] : "from-gray-600 to-gray-700"
              const isExpanded = expandedPlayers.has(player.username)

              return (
                <div key={idx} className="mb-6 bg-gray-900/90 rounded-xl border border-white/20 backdrop-blur overflow-hidden transition-all duration-300">
                  {/* Player header */}
                  <button 
                    onClick={() => togglePlayer(player.username)}
                    className="w-full flex items-center gap-4 p-4 border-b border-white/10 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${medalBg} text-white font-bold text-lg shadow-lg shrink-0`}>
                      {rank}
                    </div>
                    <div className="flex-1">
                      <span className="text-xl font-bold text-white">{player.username}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${player.completionTime ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                        {player.completionTime ? `⏱ ${formatTime(player.completionTime)}` : "⏱ Did not finish"}
                      </div>
                      <div className="hidden sm:block px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-300">
                        {player.answers.filter(a => a.submitted).length} / {player.answers.length} answered
                      </div>
                      <motion.span 
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        className="text-white/60 ml-2"
                      >
                        ▼
                      </motion.span>
                    </div>
                  </button>

                  {/* Player's answers */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 grid grid-cols-1 gap-3">
                          {player.answers.map((answer, aidx) => {
                            const isQuestionExpanded = !expandedQuestions.has(`${player.username}-${aidx}`) // Default to expanded
                            return (
                              <div key={aidx} className={`rounded-lg overflow-hidden border border-white/5 ${answer.submitted ? "bg-gray-800" : "bg-red-900/30"}`}>
                                <button 
                                  onClick={() => toggleQuestion(player.username, aidx)}
                                  className="w-full flex items-center justify-between px-4 py-2 bg-white/5 hover:bg-white/10 transition-colors text-left"
                                >
                                  <span className="text-yellow-400 font-semibold text-sm">Q{aidx + 1}: {answer.question}</span>
                                  <div className="flex items-center gap-2">
                                    {answer.submitted && (
                                      <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded uppercase font-bold tracking-wider">
                                        {answer.language}
                                      </span>
                                    )}
                                    <span className="text-white/40 text-xs">
                                      {isQuestionExpanded ? "—" : "+"}
                                    </span>
                                  </div>
                                </button>
                                <AnimatePresence>
                                  {isQuestionExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-4 py-3 bg-gray-950/50 max-h-60 overflow-y-auto overflow-x-auto custom-scrollbar">
                                        {answer.submitted ? (
                                          <pre className="text-sm text-green-400 font-mono leading-relaxed">{answer.code}</pre>
                                        ) : (
                                          <p className="text-sm text-red-400 italic">No code was submitted</p>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        ) : blindSubmissionsHistory && blindSubmissionsHistory.length > 0 ? (
          <div className="w-full mt-12 bg-gray-900/90 p-6 rounded-xl border border-white/20 backdrop-blur shrink-0 mb-12">
            <h3 className="text-2xl font-bold text-white mb-6">Review Submissions</h3>
            {blindSubmissionsHistory.map((history: any, idx: number) => {
              const submittedCount = history.submissions.filter((s: any) => s.submitted).length
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
                    {history.submissions.map((sub: any, sidx: number) => (
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
        ) : (
          /* Fallback: standard podium for non-blind-coding modes */
          <div
            style={{ gridTemplateColumns: `repeat(${top.length}, 1fr)` }}
            className={`grid w-full max-w-200 flex-1 items-end justify-center justify-self-end overflow-x-visible overflow-y-hidden`}
          >
            {top[1] && (
              <div
                className={clsx(
                  "z-20 flex h-[50%] w-full translate-y-full flex-col items-center justify-center gap-3 opacity-0 transition-all",
                  { "translate-y-0! opacity-100": apparition >= 2 },
                )}
              >
                <p
                  className={clsx(
                    "overflow-visible text-center text-2xl font-bold whitespace-nowrap text-white drop-shadow-lg md:text-4xl",
                    { "anim-balanced": apparition >= 4 },
                  )}
                >
                  {top[1].username}
                </p>
                {top[1].teamName && (
                  <p className="text-center text-sm font-medium text-white/70 drop-shadow-sm">
                    {top[1].teamName}
                  </p>
                )}
                <div className="bg-primary flex h-full w-full flex-col items-center gap-4 rounded-t-md pt-6 text-center shadow-2xl">
                  <p className="flex aspect-square h-14 items-center justify-center rounded-full border-4 border-zinc-400 bg-zinc-500 text-3xl font-bold text-white drop-shadow-lg">
                    <span className="drop-shadow-md">2</span>
                  </p>
                  <p className="text-2xl font-bold text-white drop-shadow-lg">
                    {top[1].points}
                  </p>
                </div>
              </div>
            )}

            <div
              className={clsx(
                "z-30 flex h-[60%] w-full translate-y-full flex-col items-center gap-3 opacity-0 transition-all",
                { "translate-y-0! opacity-100": apparition >= 3 },
                { "md:min-w-64": top.length < 2 },
              )}
            >
              <p
                className={clsx(
                  "overflow-visible text-center text-2xl font-bold whitespace-nowrap text-white opacity-0 drop-shadow-lg md:text-4xl",
                  { "anim-balanced opacity-100": apparition >= 4 },
                )}
              >
                {top[0].username}
              </p>
              {top[0].teamName && (
                <p className="text-center text-sm font-medium text-white/70 drop-shadow-sm">
                  {top[0].teamName}
                </p>
              )}
              <div className="bg-primary flex h-full w-full flex-col items-center gap-4 rounded-t-md pt-6 text-center shadow-2xl">
                <p className="flex aspect-square h-14 items-center justify-center rounded-full border-4 border-amber-400 bg-amber-300 text-3xl font-bold text-white drop-shadow-lg">
                  <span className="drop-shadow-md">1</span>
                </p>
                <p className="text-2xl font-bold text-white drop-shadow-lg">
                  {top[0].points}
                </p>
              </div>
            </div>

            {top[2] && (
              <div
                className={clsx(
                  "z-10 flex h-[40%] w-full translate-y-full flex-col items-center gap-3 opacity-0 transition-all",
                  { "translate-y-0! opacity-100": apparition >= 1 },
                )}
              >
                <p
                  className={clsx(
                    "overflow-visible text-center text-2xl font-bold whitespace-nowrap text-white drop-shadow-lg md:text-4xl",
                    { "anim-balanced": apparition >= 4 },
                  )}
                >
                  {top[2].username}
                </p>
                {top[2].teamName && (
                  <p className="text-center text-sm font-medium text-white/70 drop-shadow-sm">
                    {top[2].teamName}
                  </p>
                )}
                <div className="bg-primary flex h-full w-full flex-col items-center gap-4 rounded-t-md pt-6 text-center shadow-2xl">
                  <p className="flex aspect-square h-14 items-center justify-center rounded-full border-4 border-amber-800 bg-amber-700 text-3xl font-bold text-white drop-shadow-lg">
                    <span className="drop-shadow-md">3</span>
                  </p>
                  <p className="text-2xl font-bold text-white drop-shadow-lg">
                    {top[2].points}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  )
}

export default Podium
