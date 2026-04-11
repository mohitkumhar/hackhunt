import { STATUS } from "@rahoot/common/types/game/status"
import Button from "@rahoot/web/features/game/components/Button"
import Form from "@rahoot/web/features/game/components/Form"
import Input from "@rahoot/web/features/game/components/Input"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"
import { useQuestionStore } from "@rahoot/web/features/game/stores/question"

import { type KeyboardEvent, useState } from "react"
import { useNavigate } from "react-router"

const Username = () => {
  const { socket } = useSocket()
  const { gameId, login, setStatus, reset } = usePlayerStore()
  const { setQuestionStates } = useQuestionStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [year, setYear] = useState<number>(1)

  const handleLogin = () => {
    if (!gameId) {
      return
    }

    socket?.emit("player:login", { gameId, data: { username, teamName: "", year } })
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleLogin()
    }
  }

  useEvent("game:successJoin", (payload: any) => {
    const gameId = typeof payload === "string" ? payload : payload.gameId;
    if (typeof payload === "object" && payload.status) {
      setStatus(payload.status.name, payload.status.data)
      if (payload.currentQuestion) {
        setQuestionStates(payload.currentQuestion)
      }
    } else {
      setStatus(STATUS.WAIT, { text: "Waiting for the players" })
    }
    login(username)

    navigate(`/party/${gameId}`)
  })

  const handleReEnterPin = (e: React.MouseEvent) => {
    e.preventDefault()
    reset()
  }

  return (
    <Form>
      <Input
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Your username"
      />
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        style={{
          width: "100%",
          padding: "1rem",
          borderRadius: "0.5rem",
          border: "2px solid rgba(255,255,255,0.2)",
          fontSize: "1rem",
          marginBottom: "1rem",
          backgroundColor: "#1e1e24",
          color: "white",
          cursor: "pointer",
          outline: "none"
        }}
      >
        <option value={1}>1st Year</option>
        <option value={2}>2nd Year</option>
        <option value={3}>3rd Year</option>
        <option value={4}>4th Year</option>
      </select>
      <Button onClick={handleLogin}>Join Game</Button>
      <button
        onClick={handleReEnterPin}
        className="w-full mt-2 p-3 text-gray-600 font-semibold hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
      >
        Enter New Pin
      </button>
    </Form>
  )
}

export default Username
