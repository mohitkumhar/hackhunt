/* eslint-disable no-nested-ternary */
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import {
  useSocket,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import {
  SFX_ANSWERS_MUSIC,
  SFX_ANSWERS_SOUND,
} from "@rahoot/web/features/game/utils/constants"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useParams } from "react-router"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["BUG_HUNTING_WRITE"]
}

type SupportedLanguage = "python" | "javascript" | "c++" | "c" | "java" | "go"

const LANGUAGES: Record<
  SupportedLanguage,
  { name: string; version: string; boilerplate: string }
> = {
  python: {
    name: "Python",
    version: "3.10.0",
    boilerplate: "",
  },
  javascript: {
    name: "JavaScript",
    version: "18.15.0",
    boilerplate: "",
  },
  "c++": {
    name: "C++",
    version: "10.2.0",
    boilerplate: `#include <iostream>\n\nint main() {\n    // Write your code here\n    \n    return 0;\n}`,
  },
  c: {
    name: "C",
    version: "10.2.0",
    boilerplate: `#include <stdio.h>\n\nint main() {\n    // Write your code here\n    \n    return 0;\n}`,
  },
  java: {
    name: "Java",
    version: "15.0.2",
    boilerplate: `class Main {\n    public static void main(String[] args) {\n        // Write your code here\n        \n    }\n}`,
  },
  go: {
    name: "Go",
    version: "1.16.2",
    boilerplate: `package main\n\nimport "fmt"\n\nfunc main() {\n    // Write your code here\n    \n}`,
  },
}

const BugHuntingAnswer = ({
  data: { title, description, buggyCode, language: expectedLanguage },
}: Props) => {
  const { gameId }: { gameId?: string } = useParams()
  const { socket } = useSocket()
  const { player } = usePlayerStore()
  const { gameId: managerGameId } = useManagerStore()
  const { questionStates } = useQuestionStore()
  
  const isManager = Boolean(managerGameId)

  // Persist code per question: { [1-indexed question number]: { code, language } }
  const [savedCodes, setSavedCodes] = useState<Record<number, { code: string; language: string }>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [sfxPop] = useSound(SFX_ANSWERS_SOUND, { volume: 0.1 })
  const [playMusic, { stop: stopMusic }] = useSound(SFX_ANSWERS_MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  // Global competition timer
  const [timeLeft, setTimeLeft] = useState(3600)

  useEffect(() => {
    if (!gameId) {return undefined}

    const storageKey = `competitionStartTime_${gameId}`
    const storedStartTime = localStorage.getItem(storageKey)
    let startTimeValue = 0

    if (!storedStartTime) {
      startTimeValue = Date.now()
      localStorage.setItem(storageKey, startTimeValue.toString())
    } else {
      startTimeValue = parseInt(storedStartTime, 10)
    }

    const initialElapsed = Math.floor((Date.now() - startTimeValue) / 1000)
    setTimeLeft(Math.max(0, 3600 - initialElapsed))

    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTimeValue) / 1000)
      const remainingSeconds = Math.max(0, 3600 - elapsedSeconds)
      setTimeLeft(remainingSeconds)
    }, 1000)

    return () => clearInterval(interval)
  }, [gameId])

  useEffect(() => {
    playMusic()
    return () => { stopMusic() }
  }, [playMusic])

  // Derive current language and code from saved state or buggyCode
  const currentQ = questionStates?.current ?? 1
  const totalQ = questionStates?.total ?? 1

  const currentLang: SupportedLanguage =
    savedCodes[currentQ]?.language as SupportedLanguage
    || (expectedLanguage && expectedLanguage.toLowerCase() in LANGUAGES
      ? (expectedLanguage.toLowerCase() as SupportedLanguage)
      : "c")

  const currentCode = savedCodes[currentQ]?.code ?? buggyCode ?? ""

  // Auto-save buggyCode as initial value when navigating to a new question
  useEffect(() => {
    if (!savedCodes[currentQ] && buggyCode) {
      setSavedCodes(prev => ({
        ...prev,
        [currentQ]: { code: buggyCode, language: currentLang },
      }))
    }
  }, [currentQ, buggyCode])

  const setCode = (newCode: string) => {
    setSavedCodes(prev => ({
      ...prev,
      [currentQ]: { code: newCode, language: currentLang },
    }))
  }

  const handleLangSelect = (lang: SupportedLanguage) => {
    // When switching language, replace code with the boilerplate for that language
    setSavedCodes(prev => ({
      ...prev,
      [currentQ]: { code: LANGUAGES[lang].boilerplate, language: lang },
    }))
  }

  const formatTimeStr = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `00:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newCode = `${currentCode.substring(0, start)}    ${currentCode.substring(end)}`
      setCode(newCode)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 4
          textareaRef.current.selectionEnd = start + 4
        }
      }, 0)
    }
  }

  const handleNavigate = (direction: "prev" | "next") => () => {
    if (!player || isManager) {
      return
    }

    socket?.emit("player:navigateBugHuntingQuestion", {
      gameId,
      data: { direction },
    })
  }

  const handleSubmitAll = () => {
    if (!player || timeLeft <= 0) {
      return
    }

    sfxPop()

    socket?.emit("player:submitAllBugHuntingCodes", {
      gameId,
      data: {
        submissions: savedCodes,
      },
    })

    setShowConfirm(false)
  }

  const isLastQuestion = currentQ >= totalQ

  if (timeLeft === 0) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4">
        <div className="anim-show text-6xl">⏰</div>
        <h2 className="text-center text-3xl font-bold text-red-500 drop-shadow-lg md:text-4xl">
          Time's Up!
        </h2>
        <p className="text-lg text-white/80">The competition has concluded. No more submissions accepted.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl bg-[#1e1e24] border border-white/20 p-8 shadow-2xl max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-3">🐛 Submit All Answers?</h3>
            <p className="text-white/70 text-sm mb-6">
              You are about to submit all {totalQ} answers. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAll}
                className="flex-1 rounded-lg bg-green-600 hover:bg-green-500 px-4 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-lg transition-all border border-green-400/50"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex h-full w-full max-w-7xl flex-1 flex-col lg:flex-row gap-6 px-6 overflow-y-auto pt-6 pb-24">
        
        {/* Left Column: Bug Description & Expected Output Panel */}
        <div className="w-full lg:w-[32%] shrink-0 flex flex-col gap-4">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 shadow-2xl flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>🐛</span> Bug Hunting
            </h2>
            <h3 className="text-lg font-semibold text-orange-300">{title}</h3>
            <p className="text-sm text-white/80 leading-relaxed">
              {description}
            </p>

            <div className="mt-2 rounded-lg bg-[#2a2a2e]/80 border border-white/10 p-4 shadow-inner">
              <div className="mb-2 text-xs font-bold text-[#b4b4b4] uppercase tracking-wider">
                🐞 Original Buggy Code
              </div>
              <pre className="whitespace-pre-wrap font-mono text-sm text-red-400 overflow-x-auto max-h-60 overflow-y-auto">
                {buggyCode}
              </pre>
            </div>
          </div>
        </div>

        {/* Right Column: Code Editor Panel */}
        <div className="w-full lg:w-[68%] flex-1 flex flex-col min-h-[450px]">
          <div className="rounded-xl bg-[#0d0d12] shadow-2xl flex flex-col h-full overflow-hidden border border-gray-800">
            
            {/* MacOS styled header */}
            <div className="flex items-center justify-between bg-[#1e1e24] px-4 py-3 border-b border-gray-700 select-none">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 mr-4">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-500"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-yellow-500"></div>
                  <div className="w-3.5 h-3.5 rounded-full bg-green-500"></div>
                </div>
                <div className="flex items-center text-gray-300 gap-2">
                  <span className="font-semibold tracking-wide text-sm hidden sm:inline-block">Bug Fixer —</span>
                  <div className="relative">
                    <select
                      className="appearance-none bg-transparent text-white font-bold outline-none cursor-pointer hover:bg-white/5 rounded px-2 py-1 pr-6 text-sm"
                      value={currentLang}
                      onChange={(e) => handleLangSelect(e.target.value as SupportedLanguage)}
                    >
                      {Object.entries(LANGUAGES).map(([key, lang]) => (
                        <option key={key} value={key} className="bg-[#2a2a35] text-white">
                          {lang.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center px-1 text-gray-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isManager && (
                  <button
                    onClick={() => window.location.reload()}
                    className="flex shadow-inner items-center bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/50 hover:bg-blue-500/40 transition-colors"
                  >
                    <span className="text-xs font-bold text-blue-400 tracking-wider">
                      🔄 REFRESH
                    </span>
                  </button>
                )}
                <div className="flex items-center bg-[#2a2a35] px-3 py-1 rounded-full">
                  <span className="text-xs font-mono font-bold text-gray-200 tracking-widest">
                    ⏱️ {formatTimeStr(timeLeft)}
                  </span>
                </div>
                <span className="text-xs text-gray-500 hidden sm:inline-block">
                  Q {currentQ}/{totalQ}
                </span>
              </div>
            </div>

            {/* Text Area */}
            <div className="relative flex-1 flex flex-col group bg-[#0d0d12]">
              <textarea
                ref={textareaRef}
                className="absolute inset-0 w-full h-full resize-none bg-transparent p-5 font-mono text-sm text-white caret-white selection:bg-blue-500/30 focus:outline-none md:text-base z-10"
                placeholder=""
                value={currentCode}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
                spellCheck={false}
                autoComplete="off"
              />
              
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {!currentCode.trim() && (
                  <div className="flex flex-col items-center opacity-30">
                    <span className="text-4xl mb-2">🐛</span>
                    <span className="text-white font-mono text-sm">Fix the buggy code...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Navigation Bar */}
            <div className="bg-gradient-to-t from-orange-500/20 to-transparent p-4 border-t border-gray-800 mt-auto shrink-0">
              <div className="flex items-center justify-between gap-2">
                {!isManager ? (
                  <button
                    onClick={handleNavigate("prev")}
                    disabled={!questionStates || questionStates.current <= 1}
                    className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition-all disabled:pointer-events-none disabled:opacity-40"
                  >
                    Previous
                  </button>
                ) : (
                  <div />
                )}

                {/* Show Submit All only on last question */}
                {!isManager && isLastQuestion ? (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="rounded-lg bg-green-600/80 hover:bg-green-500 px-6 py-3 text-sm font-bold tracking-widest uppercase text-white shadow-lg transition-all border border-green-400/50"
                  >
                    Submit All
                  </button>
                ) : null}

                {!isManager ? (
                  <button
                    onClick={handleNavigate("next")}
                    disabled={!questionStates || questionStates.current >= questionStates.total}
                    className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition-all disabled:pointer-events-none disabled:opacity-40"
                  >
                    Next
                  </button>
                ) : (
                  <div />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default BugHuntingAnswer
