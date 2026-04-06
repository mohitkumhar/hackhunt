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
import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router"
import useSound from "use-sound"

type Props = {
  data: CommonStatusDataMap["REVERSE_WRITE_CODE"]
}

const CodeAnswer = ({
  data: { output, language, hint, time, totalPlayer },
}: Props) => {
  const { gameId }: { gameId?: string } = useParams()
  const { socket } = useSocket()
  const { player } = usePlayerStore()

  const [code, setCode] = useState("")
  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pyodideReady, setPyodideReady] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const pyodideRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [sfxPop] = useSound(SFX_ANSWERS_SOUND, { volume: 0.1 })
  const [playMusic, { stop: stopMusic }] = useSound(SFX_ANSWERS_MUSIC, {
    volume: 0.2,
    interrupt: true,
    loop: true,
  })

  // Load Pyodide
  useEffect(() => {
    const loadPyodide = async () => {
      try {
        // Check if already loaded
        if ((window as any).loadPyodide) {
          const pyodide = await (window as any).loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/",
          })
          pyodideRef.current = pyodide
          setPyodideReady(true)
          return
        }

        // Load the script
        const script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js"
        script.async = true
        script.onload = async () => {
          const pyodide = await (window as any).loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/",
          })
          pyodideRef.current = pyodide
          setPyodideReady(true)
        }
        document.head.appendChild(script)
      } catch (err) {
        console.error("Failed to load Pyodide:", err)
      }
    }

    loadPyodide()
  }, [])

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

  const handleSubmit = async () => {
    if (!player || !code.trim() || submitted) {
      return
    }

    setIsSubmitting(true)
    setRunError(null)

    let playerOutput = ""

    try {
      if (pyodideRef.current) {
        // Capture stdout
        pyodideRef.current.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
`)
        try {
          pyodideRef.current.runPython(code)
          playerOutput = pyodideRef.current.runPython("sys.stdout.getvalue()")
          // Remove trailing newline for clean comparison
          if (playerOutput.endsWith("\n")) {
            playerOutput = playerOutput.slice(0, -1)
          }
        } catch (pyErr: any) {
          playerOutput = ""
          setRunError(pyErr.message || "Code execution error")
        } finally {
          // Reset stdout
          pyodideRef.current.runPython("sys.stdout = sys.__stdout__")
        }
      } else {
        setRunError("Python engine not loaded yet")
        setIsSubmitting(false)
        return
      }
    } catch (err: any) {
      playerOutput = ""
      setRunError(err.message || "Execution failed")
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Tab key for indentation
    if (e.key === "Tab") {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newCode = code.substring(0, start) + "    " + code.substring(end)
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
      <div className="mx-auto inline-flex h-full w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4">
        {/* Output Display */}
        <div className="w-full">
          <h2 className="mb-2 text-center text-xl font-bold text-white drop-shadow-lg md:text-2xl">
            Write {language} code that produces this output:
          </h2>
          <div className="rounded-lg bg-gray-900 p-4 font-mono text-sm shadow-lg md:text-base">
            <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
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
        <div className="w-full">
          <div className="rounded-lg bg-gray-800 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between bg-gray-700 px-3 py-1.5">
              <span className="text-xs font-medium text-gray-300">
                Your Code ({language})
              </span>
              <span className={`text-xs ${pyodideReady ? "text-green-400" : "text-yellow-400"}`}>
                {pyodideReady ? "● Engine Ready" : "○ Loading Engine..."}
              </span>
            </div>
            <textarea
              ref={textareaRef}
              className="w-full resize-none bg-gray-900 p-4 font-mono text-sm text-white placeholder-gray-500 focus:outline-none md:text-base"
              rows={6}
              placeholder={`Write your ${language} code here...`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {runError && (
            <div className="mt-2 rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-300">
              ❌ {runError}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!code.trim() || isSubmitting || !pyodideReady}
          className="btn-shadow w-full rounded-lg bg-primary px-6 py-3 text-lg font-bold text-white transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          <span>
            {isSubmitting ? "Running code..." : pyodideReady ? "Run & Submit" : "Loading Engine..."}
          </span>
        </button>
      </div>

      {/* Bottom Bar */}
      <div className="mx-auto mb-4 flex w-full max-w-4xl justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
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
  )
}

export default CodeAnswer
