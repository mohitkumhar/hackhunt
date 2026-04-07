import type { Player } from "@rahoot/common/types/game"
import type { ManagerStatusDataMap } from "@rahoot/common/types/game/status"
import {
  useEvent,
  useSocket,
} from "@rahoot/web/features/game/contexts/socketProvider"
import { useManagerStore } from "@rahoot/web/features/game/stores/manager"
import { useMemo, useState } from "react"


type Props = {
  data: ManagerStatusDataMap["SHOW_ROOM"]
}

const TEAM_COLORS = [
  "from-violet-600 to-purple-700",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-indigo-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-green-600",
  "from-red-500 to-rose-600",
  "from-sky-500 to-blue-600",
]

const TEAM_BORDER_COLORS = [
  "border-violet-400",
  "border-cyan-400",
  "border-teal-400",
  "border-pink-400",
  "border-orange-400",
  "border-indigo-400",
  "border-fuchsia-400",
  "border-lime-400",
  "border-red-400",
  "border-sky-400",
]

const Room = ({ data: { text, inviteCode } }: Props) => {
  const { gameId } = useManagerStore()
  const { socket } = useSocket()
  const webUrl = window.location.origin
  const { players } = useManagerStore()
  const [playerList, setPlayerList] = useState<Player[]>(players)
  const [totalPlayers, setTotalPlayers] = useState(0)

  useEvent("manager:newPlayer", (player) => {
    setPlayerList([...playerList, player])
  })

  useEvent("manager:removePlayer", (playerId) => {
    setPlayerList(playerList.filter((p) => p.id !== playerId))
  })

  useEvent("manager:playerKicked", (playerId) => {
    setPlayerList(playerList.filter((p) => p.id !== playerId))
  })

  useEvent("game:totalPlayers", (total) => {
    setTotalPlayers(total)
  })

  const handleKick = (playerId: string) => () => {
    if (!gameId) {
      return
    }

    socket?.emit("manager:kickPlayer", {
      gameId,
      playerId,
    })
  }

  // Group players by team name
  const teamGroups = useMemo(() => {
    const groups: Record<string, Player[]> = {}
    playerList.forEach((player) => {
      const team = player.teamName || "No Team"
      if (!groups[team]) {
        groups[team] = []
      }
      groups[team].push(player)
    })
    // Sort teams alphabetically
    const sortedTeams = Object.keys(groups).sort()
    return sortedTeams.map((teamName) => ({
      teamName,
      players: groups[teamName],
    }))
  }, [playerList])

  // Get a consistent color index for a team
  const getTeamColorIndex = (teamName: string) => {
    let hash = 0
    for (let i = 0; i < teamName.length; i++) {
      hash = teamName.charCodeAt(i) + ((hash << 5) - hash)
    }
    return Math.abs(hash) % TEAM_COLORS.length
  }

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-2">
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="game-pin-in flex flex-col justify-center rounded-md bg-white px-8 py-4 text-center shadow-lg">
          <p className="text-2xl font-bold text-gray-800">Game PIN:</p>
          <p className="text-6xl font-extrabold tracking-widest text-black">{inviteCode}</p>
        </div>
      </div>

      <h2 className="mb-4 text-4xl font-bold text-white drop-shadow-lg">
        {text}
      </h2>

      <div className="mb-6 flex items-center justify-center rounded-full bg-black/40 px-6 py-3">
        <span className="text-2xl font-bold text-white drop-shadow-md">
          Players Joined: {totalPlayers}
        </span>
      </div>

      {/* Team-grouped player grid */}
      <div className="flex w-full flex-col gap-5">
        {teamGroups.map(({ teamName, players: teamPlayers }) => {
          const colorIdx = getTeamColorIndex(teamName)
          return (
            <div
              key={teamName}
              className={`rounded-xl border-2 ${TEAM_BORDER_COLORS[colorIdx]} bg-black/30 backdrop-blur-sm overflow-hidden`}
            >
              {/* Team header */}
              <div
                className={`bg-gradient-to-r ${TEAM_COLORS[colorIdx]} flex items-center justify-between px-5 py-3`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
                    {teamPlayers.length}
                  </span>
                  <h3 className="text-2xl font-bold text-white drop-shadow-md">
                    {teamName}
                  </h3>
                </div>
                <span className="text-sm font-medium text-white/80">
                  {teamPlayers.length}{" "}
                  {teamPlayers.length === 1 ? "member" : "members"}
                </span>
              </div>

              {/* Team players */}
              <div className="flex flex-wrap gap-3 p-4">
                {teamPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="shadow-inset bg-primary rounded-md px-4 py-3 font-bold text-white transition-transform hover:scale-105"
                    onClick={handleKick(player.id)}
                  >
                    <span className="cursor-pointer text-xl drop-shadow-md hover:line-through md:text-2xl">
                      {player.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default Room
