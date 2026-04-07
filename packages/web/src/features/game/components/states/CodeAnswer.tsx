/* eslint-disable max-depth, no-nested-ternary */
import type { CommonStatusDataMap } from "@rahoot/common/types/game/status"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import {
  SFX_ANSWERS_MUSIC,
  SFX_ANSWERS_SOUND,
} from "@rahoot/web/features/game/utils/constants"
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
  data: { output, language: expectedLanguage, hint, time, totalPlayer },
}: Props) => {
  const { gameId }: { gameId?: string } = useParams()
  const { socket } = useSocket()
  const { player } = usePlayerStore()

  // Default to python or the expected language if supported
  const initialLang =
    expectedLanguage && expectedLanguage.toLowerCase() in LANGUAGES
      ? (expectedLanguage.toLowerCase() as SupportedLanguage)
      : "python"

  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(initialLang)
  const [code, setCode] = useState(LANGUAGES[initialLang].boilerplate)
  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [sfxPop] = useSound(SFX_ANSWERS_SOUND, { volume: 0.1 })
  const [playMusic, { stop: stopMusic }] = useSound(SFX_ANSWERS_MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  useEffect(() => {
    playMusic()

    return () => {
      stopMusic()
    }
  }, [playMusic])

  useEvent("game:cooldown", (sec) => {
    setCooldown(sec)
  })

  useEvent("game:playerAnswer", (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  const handleLangSelect = (lang: SupportedLanguage) => {
    setSelectedLang(lang)
    
    // Only replace code if it's completely empty or matches a different language's boilerplate
    const isBoilerplate = Object.values(LANGUAGES).some((l) => l.boilerplate === code.trim())

    if (!code.trim() || isBoilerplate) {
      setCode(LANGUAGES[lang].boilerplate)
    }
  }

  const handleSubmit = async () => {
    if (!player || !code.trim() || submitted) {
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

    setSubmitted(true)
    sfxPop()

    socket?.emit("player:submitCode", {
      gameId,
      data: {
        code,
        output: playerOutput,
      },
    })

    setIsSubmitting(false)
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

  if (submitted) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4">
        <div className="anim-show text-6xl">✅</div>
        <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">
          Code Submitted!
        </h2>
        <p className="text-lg text-white/80">Your result is on the way...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-1 flex-col lg:flex-row gap-6 px-6 overflow-y-auto pt-6 pb-24">
        
        {/* Left Column: Glassmorphic Question/Output Panel */}
        <div className="w-full lg:w-[32%] shrink-0 flex flex-col gap-4">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 shadow-2xl flex flex-col gap-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📝</span> Expected Output Challenge
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              Write a program that precisely produces the exact output provided below.
            </p>

            <div className="mt-2 rounded-lg bg-[#2a2a2e]/80 border border-white/10 p-4 shadow-inner">
              <div className="mb-2 text-xs font-bold text-[#b4b4b4] uppercase tracking-wider">
                Target Output
              </div>
              <pre className="whitespace-pre-wrap font-mono text-sm text-green-400">
                {output}
              </pre>
            </div>

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
              <div className="flex items-center bg-green-500/20 px-3 py-1 rounded-full border border-green-500/50">
                <span className="text-xs font-bold text-green-400 tracking-wider">
                  ● Engine Ready <span className="text-white/50 ml-1 font-normal lowercase">{code.length} chars</span>
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
               <button
                  onClick={handleSubmit}
                  disabled={!code.trim() || isSubmitting}
                  className="w-full rounded-lg bg-orange-600/80 hover:bg-orange-500 px-6 py-3 text-sm font-bold tracking-widest uppercase text-white shadow-lg transition-all disabled:opacity-40 disabled:pointer-events-none border border-orange-400/50"
                >
                  {isSubmitting ? "Running..." : code.trim() ? "Run & Submit" : "Type something first..."}
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-secondary pb-4 pt-2">
        <div className="mx-auto flex w-full max-w-4xl justify-between gap-1 px-4 text-lg font-bold text-white md:text-xl">
          <div className="flex flex-col items-center rounded-full bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">Time</span>
            <span>{cooldown}</span>
          </div>
          <div className="flex flex-col items-center rounded-full bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">Submitted</span>
            <span>
              {totalAnswer}/{totalPlayer}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CodeAnswer
