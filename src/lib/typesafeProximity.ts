// Tiebreaker for the ①/② near-heart ordering when ModelCanvas's own walk
// can't decide (widths and steps-completed both come back too close to
// call). Sends the two sides' measured walk data — not any prose — through
// the resolveProximityTiebreak Appwrite Function, which forwards it to
// TypeSafe's Jev model as a Choice question and gets back which side is
// more likely proximal, with a confidence score.
//
// This goes through an Appwrite Function rather than calling TypeSafe
// directly so the TypeSafe API key stays server-side — it's a function
// environment variable, never a client-side env var, so it can't end up in
// the browser bundle.

import { ExecutionMethod } from 'appwrite'

import { functions } from '@/services/appwrite/client'

interface ReachData {
  maxWidth: number
  stepsCompleted: number
}

export interface ProximityTiebreakResult {
  decision: 'first' | 'second'
  confidence: number
}

export async function resolveProximalTiebreak(
  reach1: ReachData,
  reach2: ReachData,
): Promise<ProximityTiebreakResult | null> {
  try {
    const execution = await functions.createExecution({
      functionId: 'resolveProximityTiebreak',
      body: JSON.stringify({ reach1, reach2 }),
      method: ExecutionMethod.POST,
    })
    if (execution.responseStatusCode !== 200) return null
    const data = JSON.parse(execution.responseBody)
    if (data.decision !== 'first' && data.decision !== 'second') return null
    return { decision: data.decision, confidence: data.confidence ?? 0 }
  } catch (error) {
    console.error(error)
    return null
  }
}
