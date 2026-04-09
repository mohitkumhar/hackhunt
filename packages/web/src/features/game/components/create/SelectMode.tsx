import Button from "@rahoot/web/features/game/components/Button"
import { useState } from "react"
import clsx from "clsx"

type Props = {
  onSelect: (_mode: "quiz" | "reverse_programming" | "blind_coding" | "bug_hunting") => void
}

const SelectMode = ({ onSelect }: Props) => {
  const [selected, setSelected] = useState<"quiz" | "reverse_programming" | "blind_coding" | "bug_hunting" | null>(null)

  const handleSubmit = () => {
    if (!selected) {
      return
    }

    onSelect(selected)
  }

  const modes = [
    {
      id: "quiz" as const,
      icon: "🧩",
      title: "Quiz",
      description: "Classic quiz with multiple-choice answers",
    },
    {
      id: "reverse_programming" as const,
      icon: "💻",
      title: "Reverse Programming",
      description: "See the output, write the code — powered by Pyodide",
    },
    {
      id: "blind_coding" as const,
      icon: "🙈",
      title: "Blind Coding",
      description: "Type code without seeing it — the ultimate coding challenge!",
    },
    {
      id: "bug_hunting" as const,
      icon: "🐛",
      title: "Bug Hunting",
      description: "Find and fix the bugs in the given code to match the expected output",
    },
  ]

  return (
    <div className="z-10 flex w-full max-w-lg flex-col gap-6 rounded-xl bg-white p-6 shadow-lg">
      <div className="flex flex-col items-center justify-center">
        <h1 className="mb-1 text-2xl font-bold text-gray-800">Select Game Mode</h1>
        <p className="mb-4 text-sm text-gray-500">Choose how you want to play</p>

        <div className="w-full space-y-3">
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={clsx(
                "flex w-full items-center gap-4 rounded-lg p-4 text-left transition-all duration-200 outline outline-2",
                selected === mode.id
                  ? "outline-primary bg-primary/5 shadow-md"
                  : "outline-gray-200 hover:outline-gray-300 hover:bg-gray-50",
              )}
              onClick={() => setSelected(mode.id)}
            >
              <div
                className={clsx(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl",
                  selected === mode.id
                    ? "bg-primary/20"
                    : "bg-gray-100",
                )}
              >
                {mode.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-800">{mode.title}</h3>
                <p className="text-sm text-gray-500">
                  {mode.description}
                </p>
              </div>
              <div
                className={clsx(
                  "h-5 w-5 rounded-full outline outline-2 outline-offset-2 transition-all",
                  selected === mode.id
                    ? "bg-primary outline-primary"
                    : "outline-gray-300",
                )}
              />
            </button>
          ))}
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

