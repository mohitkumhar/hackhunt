import Button from "@rahoot/web/features/game/components/Button"
import { useState } from "react"
import clsx from "clsx"

type Props = {
  onSelect: (_mode: "quiz" | "reverse_programming") => void
}

const SelectMode = ({ onSelect }: Props) => {
  const [selected, setSelected] = useState<"quiz" | "reverse_programming" | null>(null)

  const handleSubmit = () => {
    if (!selected) {
      return
    }

    onSelect(selected)
  }

  return (
    <div className="z-10 flex w-full max-w-lg flex-col gap-6 rounded-xl bg-white p-6 shadow-lg">
      <div className="flex flex-col items-center justify-center">
        <h1 className="mb-1 text-2xl font-bold text-gray-800">Select Game Mode</h1>
        <p className="mb-4 text-sm text-gray-500">Choose how you want to play</p>

        <div className="w-full space-y-3">
          {/* Quiz Mode Card */}
          <button
            className={clsx(
              "flex w-full items-center gap-4 rounded-lg p-4 text-left transition-all duration-200 outline outline-2",
              selected === "quiz"
                ? "outline-primary bg-primary/5 shadow-md"
                : "outline-gray-200 hover:outline-gray-300 hover:bg-gray-50",
            )}
            onClick={() => setSelected("quiz")}
          >
            <div
              className={clsx(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl",
                selected === "quiz"
                  ? "bg-primary/20"
                  : "bg-gray-100",
              )}
            >
              🧩
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-800">Quiz</h3>
              <p className="text-sm text-gray-500">
                Classic quiz with multiple-choice answers
              </p>
            </div>
            <div
              className={clsx(
                "h-5 w-5 rounded-full outline outline-2 outline-offset-2 transition-all",
                selected === "quiz"
                  ? "bg-primary outline-primary"
                  : "outline-gray-300",
              )}
            />
          </button>

          {/* Reverse Programming Mode Card */}
          <button
            className={clsx(
              "flex w-full items-center gap-4 rounded-lg p-4 text-left transition-all duration-200 outline outline-2",
              selected === "reverse_programming"
                ? "outline-primary bg-primary/5 shadow-md"
                : "outline-gray-200 hover:outline-gray-300 hover:bg-gray-50",
            )}
            onClick={() => setSelected("reverse_programming")}
          >
            <div
              className={clsx(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl",
                selected === "reverse_programming"
                  ? "bg-primary/20"
                  : "bg-gray-100",
              )}
            >
              💻
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-800">Reverse Programming</h3>
              <p className="text-sm text-gray-500">
                See the output, write the code — powered by Pyodide
              </p>
            </div>
            <div
              className={clsx(
                "h-5 w-5 rounded-full outline outline-2 outline-offset-2 transition-all",
                selected === "reverse_programming"
                  ? "bg-primary outline-primary"
                  : "outline-gray-300",
              )}
            />
          </button>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        className={clsx(!selected && "opacity-50 pointer-events-none")}
      >
        Continue
      </Button>
    </div>
  )
}

export default SelectMode
