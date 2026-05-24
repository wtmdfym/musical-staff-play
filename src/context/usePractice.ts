import { useContext } from 'react'
import { PracticeStateContext, PracticeDispatchContext } from './practiceContext'
import type { PracticeAction } from '../score/ScoreTypes'

export function usePractice() {
  const state = useContext(PracticeStateContext)
  const dispatch = useContext(PracticeDispatchContext)
  if (!state || !dispatch) throw new Error('usePractice must be used within PracticeProvider')
  return { state, dispatch }
}

export function usePracticeDispatch(): React.Dispatch<PracticeAction> {
  const dispatch = useContext(PracticeDispatchContext)
  if (!dispatch) throw new Error('usePracticeDispatch must be used within PracticeProvider')
  return dispatch
}
