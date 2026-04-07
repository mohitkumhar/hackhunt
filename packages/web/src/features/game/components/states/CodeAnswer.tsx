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
import { useEffect, useRef, useState, KeyboardEvent } from "react"
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
    boilerplate: `public class Main {\n    public static void main(String[] args) {\n        // Write your code here\n        \n    }\n}`,
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

    try {
      const response = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: selectedLang,
          version: LANGUAGES[selectedLang].version,
          files: [
            {
              content: code,
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to reach execution API")
      }

      const result = await response.json()

      if (result.compile && result.compile.code !== 0) {
        setRunError(`Compilation Error:\\n${  result.compile.output}`)
        setIsSubmitting(false)

        
return
      }

      if (result.run && result.run.signal) {
        setRunError(`Runtime Error (${  result.run.signal  }):\\n${  result.run.output}`)
        setIsSubmitting(false)

        
return
      }

      playerOutput = result.run.stdout || ""
      
      // Clean up newline at the end if it exists
      if (playerOutput.endsWith("\\n")) {
        playerOutput = playerOutput.slice(0, -1)
      }
    } catch (err: any) {
      setRunError(err.message || "Execution failed")
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
      const newCode = `${code.substring(0, start)  }    ${  code.substring(end)}`
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
        <p className="text-lg text-white/80">Waiting for other players...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      <div className="mx-auto inline-flex h-full w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 overflow-y-auto pt-6 pb-20">
        {/* Output Display */}
        <div className="w-full shrink-0">
          <h2 className="mb-2 text-center text-xl font-bold text-white drop-shadow-lg md:text-2xl">
            Write code that produces this output:
          </h2>
          <div className="rounded-lg bg-gray-900 p-4 font-mono text-sm shadow-lg md:text-base">
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span className="ml-2">Expected Output</span>
            </div>
            <pre className="whitespace-pre-wrap text-green-400">{output}</pre>
          </div>

          {hint && (
            <div className="mt-2 rounded-md bg-yellow-500/20 px-3 py-2 text-sm text-yellow-200">
              💡 Hint: {hint}
            </div>
          )}
        </div>

        {/* Code Editor */}
        <div className="w-full flex-1 flex flex-col min-h-[300px]">
          <div className="rounded-lg bg-gray-800 shadow-lg flex flex-col h-full overflow-hidden">
            <div className="flex flex-col bg-gray-700 px-3 py-3 border-b border-gray-600 gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                Programming Language
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(LANGUAGES).map(([key, lang]) => (
                  <button
                    key={key}
                    onClick={() => handleLangSelect(key as SupportedLanguage)}
                    disabled={isSubmitting}
                    className={`px-4 py-1.5 text-sm font-bold rounded-full transition-all ${
                      selectedLang === key
                        ? "bg-primary text-white shadow-[0_0_10px_rgba(var(--color-primary),0.5)]"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-600 hover:text-white border border-gray-700"
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className="w-full flex-1 resize-none bg-gray-900 p-4 font-mono text-sm text-white placeholder-gray-500 focus:outline-none md:text-base"
              placeholder={`Write your ${LANGUAGES[selectedLang].name} code here...`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {runError && (
            <div className="mt-2 shrink-0 rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-300 overflow-x-auto whitespace-pre-wrap font-mono">
              ❌ {runError}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!code.trim() || isSubmitting}
          className="btn-shadow shrink-0 w-full rounded-lg bg-primary px-6 py-3 text-lg font-bold text-white transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <span>
            {isSubmitting ? "Running code..." : "Run & Submit"}
          </span>
        </button>
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
