import { createContext } from 'react'
import type { PracticeState, PracticeAction } from '../score/ScoreTypes'

export const PracticeStateContext = createContext<PracticeState | null>(null)

export const PracticeDispatchContext = createContext<React.Dispatch<PracticeAction> | null>(null)
