import { STATUS } from "@rahoot/common/types/game/status"
import Button from "@rahoot/web/features/game/components/Button"
import Form from "@rahoot/web/features/game/components/Form"
import Input from "@rahoot/web/features/game/components/Input"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { usePlayerStore } from "@rahoot/web/features/game/stores/player"

import { type KeyboardEvent, useState } from "react"
import { useNavigate } from "react-router"

const Username = () => {
  const { socket } = useSocket()
  const { gameId, login, setStatus } = usePlayerStore()
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

  useEvent("game:successJoin", (gameId) => {
    setStatus(STATUS.WAIT, { text: "Waiting for the players" })
    login(username)

    navigate(`/party/${gameId}`)
  })

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
    </Form>
  )
}

export default Username
