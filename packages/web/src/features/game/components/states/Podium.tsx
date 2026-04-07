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
                  {
                    "anim-balanced": apparition >= 4,
                  },
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
              {
                "translate-y-0! opacity-100": apparition >= 3,
              },
              {
                "md:min-w-64": top.length < 2,
              },
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
                {
                  "translate-y-0! opacity-100": apparition >= 1,
                },
              )}
            >
              <p
                className={clsx(
                  "overflow-visible text-center text-2xl font-bold whitespace-nowrap text-white drop-shadow-lg md:text-4xl",
                  {
                    "anim-balanced": apparition >= 4,
                  },
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
                    <div key={sidx} className={`p-4 rounded-lg shadow ${sub.submitted ? 'bg-gray-800' : 'bg-red-900/30'}`}>
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
