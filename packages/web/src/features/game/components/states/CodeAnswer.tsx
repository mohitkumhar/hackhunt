/* eslint-disable no-nested-ternary */
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import {
  useSocket,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import {
  SFX_ANSWERS_MUSIC,
  SFX_ANSWERS_SOUND,
} from "@rahoot/web/features/game/utils/constants"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useParams } from "react-router"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["REVERSE_WRITE_CODE"]
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

const CodeAnswer = ({
  data: { title, description, explanation, example, output, language: expectedLanguage, hint },
}: Props) => {
  const { gameId }: { gameId?: string } = useParams()
  const { socket } = useSocket()
  const { player } = usePlayerStore()
  const { gameId: managerGameId } = useManagerStore()
  const { questionStates } = useQuestionStore()
  
  const isManager = Boolean(managerGameId)

  const handleManagerRefresh = () => {
    if (gameId) {
      localStorage.removeItem(`competitionStartTime_${gameId}`)
    }

    window.location.reload()
  }

  // Default to python or the expected language if supported
  const initialLang =
    expectedLanguage && expectedLanguage.toLowerCase() in LANGUAGES
      ? (expectedLanguage.toLowerCase() as SupportedLanguage)
      : "python"

  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(initialLang)
  const [code, setCode] = useState(LANGUAGES[initialLang].boilerplate)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(
    () => new Set<number>(),
  )
  const [showFinalSubmit, setShowFinalSubmit] = useState(false)
  const [pendingSubmitData, setPendingSubmitData] = useState<{code: string; output: string} | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [sfxPop] = useSound(SFX_ANSWERS_SOUND, { volume: 0.1 })
  const [playMusic, { stop: stopMusic }] = useSound(SFX_ANSWERS_MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  // Global competition timer state (60 mins = 3600 seconds)
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

    // Run once immediately so it doesn't wait 1s to hide the "Time's Up" initially
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

    return () => {
      stopMusic()
    }
  }, [playMusic])

  useEffect(() => {
    const nextLang =
      expectedLanguage && expectedLanguage.toLowerCase() in LANGUAGES
        ? (expectedLanguage.toLowerCase() as SupportedLanguage)
        : "python"

    setSelectedLang(nextLang)
    setCode(LANGUAGES[nextLang].boilerplate)
    setSubmitted(false)
    setIsSubmitting(false)
    setRunError(null)
  }, [output, expectedLanguage, hint])

  const formatTimeStr = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60

    
return `00:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  }

  const handleLangSelect = (lang: SupportedLanguage) => {
    setSelectedLang(lang)
    
    // Only replace code if it's completely empty or matches a different language's boilerplate
    const isBoilerplate = Object.values(LANGUAGES).some((l) => l.boilerplate === code.trim())

    if (!code.trim() || isBoilerplate) {
      setCode(LANGUAGES[lang].boilerplate)
    }
  }

  const handleSubmit = async () => {
    if (!player || !code.trim() || submitted || timeLeft <= 0) {
      return
    }

    const currentQuestionIndex = (questionStates?.current ?? 1) - 1
    if (submittedQuestions.has(currentQuestionIndex)) {
      return
    }

    setIsSubmitting(true)
    setRunError(null)

    let playerOutput = ""

    const requestBody = JSON.stringify({
      language: selectedLang,
      version: LANGUAGES[selectedLang].version,
      files: [
        {
          name: selectedLang === "java" ? "Main.java" : undefined,
          content: code,
        },
      ],
    })

    try {
      const controller = new AbortController()
      // Increased to 30s for Java
      const timeout = setTimeout(() => controller.abort(), 30000) 

      const response = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`Execution engine error: ${response.status}`)
      }

      const result = await response.json()

      if (result.compile && result.compile.code !== 0) {
        setRunError(`Compilation Error:\n${result.compile.output}`)
        setIsSubmitting(false)
        return
      }

      if (result.run && result.run.signal) {
        setRunError(`Runtime Error (${result.run.signal}):\n${result.run.stderr || ""}`)
        setIsSubmitting(false)

        
return
      }

      // Check for runtime errors (e.g. Python SyntaxError, Java exceptions)
      if (result.run && result.run.code !== 0 && !result.run.stdout) {
        setRunError(`Error:\n${result.run.stderr || "Code exited with non-zero status"}`)
        setIsSubmitting(false)

        
return
      }

      // Check for runtime errors (e.g. Python SyntaxError, Java exceptions)
      if (result.run && result.run.code !== 0 && !result.run.stdout) {
        setRunError(`Error:\n${result.run.stderr || "Code exited with non-zero status"}`)
        setIsSubmitting(false)
        return
      }

      // Check for runtime errors (e.g. Python SyntaxError, Java exceptions)
      if (result.run && result.run.code !== 0 && !result.run.stdout) {
        setRunError(`Error:\n${result.run.stderr || "Code exited with non-zero status"}`)
        setIsSubmitting(false)
        return
      }

      playerOutput = result.run.stdout || ""

      // Clean up newline at the end if it exists
      if (playerOutput.endsWith("\n")) {
        playerOutput = playerOutput.slice(0, -1)
      }
    } catch (err: unknown) {
      setRunError(err instanceof Error ? err.message : "Execution failed")
      setIsSubmitting(false)
      return
    }

    sfxPop()

    if (questionStates && questionStates.current === questionStates.total) {
      setPendingSubmitData({ code, output: playerOutput })
      setShowFinalSubmit(true)
    } else {
      setSubmitted(true)
      socket?.emit("player:submitCode", {
        gameId,
        data: {
          code,
          output: playerOutput,
        },
      })

      setSubmittedQuestions((prev) => {
        const next = new Set(prev)
        next.add(currentQuestionIndex)
        return next
      })
    }

    setIsSubmitting(false)
  }

  const handleFinalSubmit = () => {
    if (!pendingSubmitData) return

    setSubmitted(true)
    socket?.emit("player:submitCode", {
      gameId,
      data: pendingSubmitData,
    })

    setSubmittedQuestions((prev) => {
      const next = new Set(prev)
      next.add(currentQuestionIndex)
      return next
    })

    setShowFinalSubmit(false)
    setPendingSubmitData(null)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Tab key for indentation
    if (e.key === "Tab") {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newCode = `${code.substring(0, start)}    ${code.substring(end)}`
      setCode(newCode)
      // Set cursor position after indent
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

    socket?.emit("player:navigateReverseQuestion", {
      gameId,
      data: { direction },
    })
  }

  const currentQuestionIndex = (questionStates?.current ?? 1) - 1
  const alreadySubmittedCurrent = submittedQuestions.has(currentQuestionIndex)


  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-1 flex-col lg:flex-row gap-6 px-6 overflow-y-auto pt-6 pb-24">
        
        {/* Left Column: Glassmorphic Question/Output Panel */}
        <div className="w-full lg:w-[32%] shrink-0 flex flex-col gap-4">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 shadow-2xl flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📝</span> {title || "Expected Output Challenge"}
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              {description || explanation || "Write a program that precisely produces the exact output provided below."}
            </p>

            <div className="mt-2 rounded-lg bg-[#2a2a2e]/80 border border-white/10 p-4 shadow-inner">
              <div className="mb-2 text-xs font-bold text-[#b4b4b4] uppercase tracking-wider">
                Target Output
              </div>
              <pre className="whitespace-pre-wrap font-mono text-sm text-green-400">
                {output}
              </pre>
            </div>

            {example && example.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="text-xs font-bold text-[#b4b4b4] uppercase tracking-wider">
                   Examples
                </div>
                <div className="flex flex-col gap-2">
                  {example.map((ex, idx) => (
                    <div key={idx} className="rounded-lg bg-black/20 border border-white/5 p-3">
                      <pre className="text-xs font-mono text-white/70 whitespace-pre-wrap break-all">
                        {ex}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hint && (
              <div className="mt-2 rounded-lg bg-yellow-500/20 px-4 py-3 border border-yellow-500/30">
                <div className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-1">
                  💡 Hint
                </div>
                <div className="text-sm text-yellow-200">
                  {hint}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Blind Editor Panel */}
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
                  <span className="font-semibold tracking-wide text-sm hidden sm:inline-block">Blind Editor —</span>
                  <div className="relative">
                    <select
                      className="appearance-none bg-transparent text-white font-bold outline-none cursor-pointer hover:bg-white/5 rounded px-2 py-1 disabled:opacity-50 pr-6 text-sm"
                      value={selectedLang}
                      onChange={(e) => handleLangSelect(e.target.value as SupportedLanguage)}
                      disabled={isSubmitting}
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
                    onClick={handleManagerRefresh}
                    className="flex shadow-inner items-center bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/50 hover:bg-blue-500/40 transition-colors"
                  >
                    <span className="text-xs font-bold text-blue-400 tracking-wider">
                      🔄 REFRESH
                    </span>
                  </button>
                )}
                <div className="flex items-center bg-green-500/20 px-3 py-1 rounded-full border border-green-500/50 hidden sm:flex">
                  <span className="text-xs font-bold text-green-400 tracking-wider">
                    ● Engine Ready
                  </span>
                </div>
                <div className="flex items-center bg-[#2a2a35] px-3 py-1 rounded-full">
                  <span className="text-xs font-mono font-bold text-gray-200 tracking-widest">
                    ⏱️ {formatTimeStr(timeLeft)}
                  </span>
                </div>
                <span className="text-xs text-gray-500 hidden sm:inline-block">
                  {code.length} chars
                </span>
              </div>
            </div>



            {/* Text Area */}
            <div className="relative flex-1 flex flex-col group bg-[#0d0d12]">
              <textarea
                ref={textareaRef}
                className="absolute inset-0 w-full h-full resize-none bg-transparent p-5 font-mono text-sm text-white caret-white selection:bg-blue-500/30 focus:outline-none md:text-base z-10"
                placeholder={""}
                value={code}
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
              
              {/* Background visual elements when empty */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {!code.trim() && (
                  <div className="flex flex-col items-center opacity-30">
                    <span className="text-4xl mb-2">⌨️</span>
                    <span className="text-white font-mono text-sm">Start typing...</span>
                  </div>
                )}
              </div>
            </div>
            
            {runError && (
              <div className="shrink-0 bg-red-900/50 px-4 py-3 border-t border-red-500/30 overflow-x-auto">
                <pre className="text-xs text-red-200 font-mono whitespace-pre-wrap">❌ {runError}</pre>
              </div>
            )}

            {/* Bottom Submit Bar inside editor container */}
            <div className="bg-gradient-to-t from-orange-500/20 to-transparent p-4 border-t border-gray-800 mt-auto shrink-0">
              <div className="flex items-center justify-between gap-2">
                {!isManager ? (
                  <button
                    onClick={handleNavigate("prev")}
                    disabled={!questionStates || questionStates.current <= 1 || isSubmitting}
                    className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition-all disabled:pointer-events-none disabled:opacity-40"
                  >
                    Previous
                  </button>
                ) : (
                  <div />
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!code.trim() || isSubmitting || alreadySubmittedCurrent || timeLeft <= 0}
                  className="rounded-lg bg-orange-600/80 hover:bg-orange-500 px-6 py-3 text-sm font-bold tracking-widest uppercase text-white shadow-lg transition-all disabled:opacity-40 disabled:pointer-events-none border border-orange-400/50"
                >
                  {timeLeft <= 0
                    ? "Time's Up!"
                    : alreadySubmittedCurrent
                    ? "Submitted"
                    : isSubmitting
                      ? "Running..."
                      : code.trim()
                        ? "Submit"
                        : "Type something first..."}
                </button>
                {!isManager ? (
                  <button
                    onClick={handleNavigate("next")}
                    disabled={!questionStates || questionStates.current >= questionStates.total || isSubmitting}
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

      {/* Confirmation Modal */}
      {showFinalSubmit && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex w-11/12 max-w-md flex-col items-center rounded-2xl bg-orange-600 p-8 text-center shadow-2xl">
            <h2 className="mb-4 text-3xl font-bold text-white drop-shadow-md">Finish Round?</h2>
            <p className="mb-8 text-lg text-white/90">Are you sure you want to finalize your answer and finish this round?</p>
            <div className="flex w-full gap-4">
              <button
                onClick={() => setShowFinalSubmit(false)}
                className="flex-1 rounded-xl bg-black/20 px-6 py-4 font-bold text-white transition-colors hover:bg-black/40 shadow-lg"
              >
                No, Go Back
              </button>
              <button
                onClick={handleFinalSubmit}
                className="flex-1 rounded-xl bg-white px-6 py-4 font-bold text-orange-600 transition-colors hover:bg-gray-100 shadow-lg"
              >
                Yes, Submit!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CodeAnswer
