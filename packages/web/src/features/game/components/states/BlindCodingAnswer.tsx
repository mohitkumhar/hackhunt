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
  data: CommonStatusDataMap["BLIND_CODING_WRITE"]
}

const BlindCodingAnswer = ({
  data: { title, description, examples, constraints, language, time, totalPlayer },
}: Props) => {
  const { gameId }: { gameId?: string } = useParams()
  const { socket } = useSocket()
  const { player } = usePlayerStore()

  const [code, setCode] = useState("")
  const [codeLanguage, setCodeLanguage] = useState(language)
  const [cooldown, setCooldown] = useState(time)
  const [totalAnswer, setTotalAnswer] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [charCount, setCharCount] = useState(0)
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

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value)
    setCharCount(e.target.value.length)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newCode = code.substring(0, start) + "    " + code.substring(end)
      setCode(newCode)
      setCharCount(newCode.length)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 4
          textareaRef.current.selectionEnd = start + 4
        }
      }, 0)
    }
  }

  const handleSubmit = () => {
    if (!player || !code.trim() || submitted) {
      return
    }

    setSubmitted(true)
    sfxPop()

    socket?.emit("player:submitBlindCode", {
      gameId,
      data: {
        code,
        language: codeLanguage,
      },
    })
  }

  if (submitted) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4">
        <div className="anim-show text-6xl">✅</div>
        <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-3xl">
          Code Submitted!
        </h2>
        <p className="text-lg text-white/80">Waiting for other players...</p>
        <div className="mt-4 rounded-xl bg-white/10 p-4 backdrop-blur">
          <p className="text-sm text-white/60">Characters typed: <span className="font-bold text-white">{charCount}</span></p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 gap-0 md:gap-4">
      {/* Left: Problem Statement */}
      <div className="hidden md:flex flex-col flex-1 max-w-md overflow-y-auto px-4 py-2">
        <div className="rounded-xl bg-white/10 p-5 backdrop-blur shadow-xl">
          <h2 className="mb-3 text-xl font-bold text-white drop-shadow-lg">
            📋 {title}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-white/90">
            {description}
          </p>

          {examples.map((example, idx) => (
            <div key={idx} className="mb-4 rounded-lg bg-black/30 p-3">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-yellow-400">
                Example {idx + 1}
              </h4>
              <div className="mb-1">
                <span className="text-xs font-medium text-gray-400">Input:</span>
                <pre className="mt-0.5 whitespace-pre-wrap font-mono text-xs text-green-400">
                  {example.input}
                </pre>
              </div>
              <div className="mb-1">
                <span className="text-xs font-medium text-gray-400">Output:</span>
                <pre className="mt-0.5 whitespace-pre-wrap font-mono text-xs text-green-400">
                  {example.output}
                </pre>
              </div>
              {example.explanation && (
                <p className="mt-1 text-xs text-white/60 italic">
                  💡 {example.explanation}
                </p>
              )}
            </div>
          ))}

          {constraints.length > 0 && (
            <div className="mt-2">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-orange-400">
                Constraints
              </h4>
              {constraints.map((c, idx) => (
                <p key={idx} className="font-mono text-xs text-white/70">
                  • {c}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Blind Code Editor */}
      <div className="flex flex-1 flex-col justify-between px-4 py-2">
        {/* Mobile Problem Title */}
        <div className="mb-2 md:hidden">
          <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-xs text-white/70">{description}</p>
          </div>
        </div>

        {/* Editor */}
        <div className="flex flex-1 flex-col">
          <div className="rounded-xl bg-gray-900/90 shadow-2xl overflow-hidden flex flex-col flex-1 backdrop-blur">
            {/* Editor Header */}
            <div className="flex items-center justify-between bg-gray-800 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
                <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                <span className="ml-3 text-sm font-medium text-gray-300">
                  Blind Editor — 
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    className="ml-2 rounded border border-gray-600 bg-gray-700 px-2 py-0.5 text-xs font-semibold text-white outline-none focus:border-primary"
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                  </select>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-red-500/20 px-3 py-0.5 text-xs font-bold text-red-400 animate-pulse">
                  👁️ BLIND MODE
                </span>
                <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold text-white">
                  ⏱ {String(Math.floor(cooldown / 3600)).padStart(2, "0")}:{String(Math.floor((cooldown % 3600) / 60)).padStart(2, "0")}:{String(cooldown % 60).padStart(2, "0")}
                </span>
                <span className="text-xs text-gray-500">
                  {charCount} chars
                </span>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-1.5 border-b border-amber-500/30">
              <p className="text-xs text-amber-300 text-center font-medium">
                ⚠️ You cannot see what you type! Write carefully and trust your instincts.
              </p>
            </div>

            {/* Blind Textarea */}
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                className="h-full w-full resize-none bg-gray-950 p-4 font-mono text-sm text-transparent caret-transparent placeholder-gray-700 focus:outline-none selection:bg-transparent"
                style={{
                  color: "transparent",
                  caretColor: "transparent",
                  WebkitTextFillColor: "transparent",
                }}
                rows={12}
                placeholder={`Start typing your ${codeLanguage} code here... (you won't see it!)`}
                value={code}
                onChange={handleCodeChange}
                onKeyDown={handleKeyDown}
                onCopy={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
              {/* Overlay showing only cursor indicator */}
              {code.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-2 animate-bounce">⌨️</div>
                    <p className="text-gray-600 text-sm">Start typing...</p>
                  </div>
                </div>
              )}
              {code.length > 0 && (
                <div className="pointer-events-none absolute bottom-3 right-3">
                  <div className="flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-400 font-mono">{charCount} chars typed</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!code.trim()}
            className="btn-shadow mt-3 w-full rounded-lg bg-primary px-6 py-3 text-lg font-bold text-white transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <span>
              {code.trim() ? "🚀 Submit Code" : "Type something first..."}
            </span>
          </button>
        </div>

        {/* Bottom Bar */}
        <div className="mt-3 flex justify-end gap-2 text-lg font-bold text-white">
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

export default BlindCodingAnswer
