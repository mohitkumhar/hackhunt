import type { QuizzWithId, ReverseQuizzWithId, BlindCodingQuizzWithId, GameMode } from "@rahoot/common/types/game"
import { STATUS } from "@rahoot/common/types/game/status"
import ManagerPassword from "@rahoot/web/features/game/components/create/ManagerPassword"
import SelectMode from "@rahoot/web/features/game/components/create/SelectMode"
import SelectQuizz from "@rahoot/web/features/game/components/create/SelectQuizz"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { useState } from "react"
import { useNavigate } from "react-router"

const ManagerAuthPage = () => {
  const { setGameId, setStatus } = useManagerStore()
  const navigate = useNavigate()
  const { socket } = useSocket()

  const [isAuth, setIsAuth] = useState(false)
  const [mode, setMode] = useState<GameMode | null>(null)
  const [quizzList, setQuizzList] = useState<QuizzWithId[]>([])
  const [reverseQuizzList, setReverseQuizzList] = useState<ReverseQuizzWithId[]>([])
  const [blindCodingQuizzList, setBlindCodingQuizzList] = useState<BlindCodingQuizzWithId[]>([])

  useEvent("manager:quizzList", (quizzList) => {
    setIsAuth(true)
    setQuizzList(quizzList)
  })

  useEvent("manager:reverseQuizzList", (reverseList) => {
    setReverseQuizzList(reverseList)
  })

  useEvent("manager:blindCodingQuizzList", (blindList) => {
    setBlindCodingQuizzList(blindList)
  })

  useEvent("manager:gameCreated", ({ gameId, inviteCode }) => {
    setGameId(gameId)
    setStatus(STATUS.SHOW_ROOM, { text: "Waiting for the players", inviteCode })
    navigate(`/party/manager/${gameId}`)
  })

  const handleAuth = (password: string) => {
    socket?.emit("manager:auth", password)
  }

  const handleModeSelect = (selectedMode: GameMode) => {
    setMode(selectedMode)
  }

  const handleCreate = (quizzId: string) => {
    if (mode === "reverse_programming") {
      socket?.emit("game:createReverse", quizzId)
    } else if (mode === "blind_coding") {
      socket?.emit("game:createBlindCoding", quizzId)
    } else {
      socket?.emit("game:create", quizzId)
    }
  }

  // Step 1: Password
  if (!isAuth) {
    return <ManagerPassword onSubmit={handleAuth} />
  }

  // Step 2: Mode selection
  if (!mode) {
    return <SelectMode onSelect={handleModeSelect} />
  }

  // Step 3: Quiz selection (for all modes)
  if (mode === "quiz") {
    return <SelectQuizz quizzList={quizzList} onSelect={handleCreate} />
  }

  if (mode === "blind_coding") {
    const blindAsQuizz: QuizzWithId[] = blindCodingQuizzList.map((bq) => ({
      id: bq.id,
      subject: bq.subject,
      questions: [],
    }))

    return <SelectQuizz quizzList={blindAsQuizz} onSelect={handleCreate} />
  }

  // Reverse Programming mode - show reverse quizz list
  const reverseAsQuizz: QuizzWithId[] = reverseQuizzList.map((rq) => ({
    id: rq.id,
    subject: rq.subject,
    questions: [],
  }))

  return <SelectQuizz quizzList={reverseAsQuizz} onSelect={handleCreate} />
}

export default ManagerAuthPage

