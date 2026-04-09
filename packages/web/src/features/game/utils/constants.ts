import Answers from "@rahoot/web/features/game/components/states/Answers"
import BlindCodingAnswer from "@rahoot/web/features/game/components/states/BlindCodingAnswer"
import BlindCodingResponses from "@rahoot/web/features/game/components/states/BlindCodingResponses"
import BugHuntingAnswer from "@rahoot/web/features/game/components/states/BugHuntingAnswer"
import CodeAnswer from "@rahoot/web/features/game/components/states/CodeAnswer"
import CodeResponses from "@rahoot/web/features/game/components/states/CodeResponses"
import Leaderboard from "@rahoot/web/features/game/components/states/Leaderboard"
import Podium from "@rahoot/web/features/game/components/states/Podium"
import Prepared from "@rahoot/web/features/game/components/states/Prepared"
import Question from "@rahoot/web/features/game/components/states/Question"
import Responses from "@rahoot/web/features/game/components/states/Responses"
import Result from "@rahoot/web/features/game/components/states/Result"
import Room from "@rahoot/web/features/game/components/states/Room"
import Start from "@rahoot/web/features/game/components/states/Start"
import Wait from "@rahoot/web/features/game/components/states/Wait"
import ReverseManagerActive from "@rahoot/web/features/game/components/states/ReverseManagerActive"

import { STATUS } from "@rahoot/common/types/game/status"
import Circle from "@rahoot/web/features/game/components/icons/Circle"
import Rhombus from "@rahoot/web/features/game/components/icons/Rhombus"
import Square from "@rahoot/web/features/game/components/icons/Square"
import Triangle from "@rahoot/web/features/game/components/icons/Triangle"

export const ANSWERS_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-yellow-500",
  "bg-green-500",
]

export const ANSWERS_ICONS = [Triangle, Rhombus, Circle, Square]

export const GAME_STATES = {
  status: {
    name: STATUS.WAIT,
    data: { text: "Waiting for the players" },
  },
  question: {
    current: 1,
    total: null,
  },
}

export const GAME_STATE_COMPONENTS = {
  [STATUS.SELECT_ANSWER]: Answers,
  [STATUS.SHOW_QUESTION]: Question,
  [STATUS.WAIT]: Wait,
  [STATUS.SHOW_START]: Start,
  [STATUS.SHOW_RESULT]: Result,
  [STATUS.SHOW_PREPARED]: Prepared,
  [STATUS.REVERSE_WRITE_CODE]: CodeAnswer,
  [STATUS.BLIND_CODING_WRITE]: BlindCodingAnswer,
  [STATUS.BUG_HUNTING_WRITE]: BugHuntingAnswer,
}

export const GAME_STATE_COMPONENTS_MANAGER = {
  ...GAME_STATE_COMPONENTS,
  [STATUS.SHOW_ROOM]: Room,
  [STATUS.SHOW_RESPONSES]: Responses,
  [STATUS.SHOW_LEADERBOARD]: Leaderboard,
  [STATUS.FINISHED]: Podium,
  [STATUS.REVERSE_WRITE_CODE]: ReverseManagerActive as any,
  [STATUS.REVERSE_SHOW_RESPONSES]: CodeResponses,
  [STATUS.BLIND_CODING_SHOW_RESPONSES]: BlindCodingResponses,
  [STATUS.BUG_HUNTING_WRITE]: ReverseManagerActive as any,
  [STATUS.BUG_HUNTING_SHOW_RESPONSES]: CodeResponses,
}

export const SFX_ANSWERS_MUSIC = "/sounds/answersMusic.mp3"
export const SFX_ANSWERS_SOUND = "/sounds/answersSound.mp3"
export const SFX_RESULTS_SOUND = "/sounds/results.mp3"
export const SFX_SHOW_SOUND = "/sounds/show.mp3"
export const SFX_BOUMP_SOUND = "/sounds/boump.mp3"
export const SFX_PODIUM_THREE = "/sounds/three.mp3"
export const SFX_PODIUM_SECOND = "/sounds/second.mp3"
export const SFX_PODIUM_FIRST = "/sounds/first.mp3"
export const SFX_SNEAR_ROOL = "/sounds/snearRoll.mp3"

export const MANAGER_SKIP_EVENTS = {
  [STATUS.SHOW_ROOM]: "manager:startGame",
  [STATUS.SELECT_ANSWER]: "manager:abortQuiz",
  [STATUS.SHOW_RESPONSES]: "manager:nextQuestion",
  [STATUS.SHOW_LEADERBOARD]: "manager:nextQuestion",
  [STATUS.REVERSE_WRITE_CODE]: "manager:abortQuiz",
  [STATUS.REVERSE_SHOW_RESPONSES]: "manager:showLeaderboard",
  [STATUS.BLIND_CODING_WRITE]: "manager:abortQuiz",
  [STATUS.BLIND_CODING_SHOW_RESPONSES]: "manager:showLeaderboard",
  [STATUS.BUG_HUNTING_WRITE]: "manager:abortQuiz",
  [STATUS.BUG_HUNTING_SHOW_RESPONSES]: "manager:showLeaderboard",
} as const satisfies Partial<
  Record<keyof typeof GAME_STATE_COMPONENTS_MANAGER, string>
>

export function isKeyOf<T extends object>(
  obj: T,
  key: string,
): key is keyof T & string {
  return key in obj
}

export const MANAGER_SKIP_BTN = {
  [STATUS.SHOW_ROOM]: "Start Game",
  [STATUS.SHOW_START]: null,
  [STATUS.SHOW_PREPARED]: null,
  [STATUS.SHOW_QUESTION]: null,
  [STATUS.SELECT_ANSWER]: "Skip",
  [STATUS.SHOW_RESULT]: null,
  [STATUS.SHOW_RESPONSES]: null,
  [STATUS.SHOW_LEADERBOARD]: null,
  [STATUS.FINISHED]: null,
  [STATUS.WAIT]: null,
  [STATUS.REVERSE_WRITE_CODE]: null,
  [STATUS.REVERSE_SHOW_RESPONSES]: null,
  [STATUS.BLIND_CODING_WRITE]: "Skip",
  [STATUS.BLIND_CODING_SHOW_RESPONSES]: null,
  [STATUS.BUG_HUNTING_WRITE]: null,
  [STATUS.BUG_HUNTING_SHOW_RESPONSES]: null,
}
