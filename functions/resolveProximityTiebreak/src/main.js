// Server-side proxy for TypeSafe's Jev model, used as a tiebreaker for the
// ①/② near-heart point ordering in LesionAnalysisPage when ModelCanvas's own
// geometric walk can't decide. This exists purely so the TYPESAFE_API_KEY
// never has to reach the browser — the client only ever talks to this
// function via its own authenticated Appwrite session.

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'

function isReach(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.maxWidth === 'number' &&
    typeof value.stepsCompleted === 'number'
  )
}

export default async ({ req, res, error }) => {
  if (req.method !== 'POST') {
    return res.json({ error: 'POST only' }, 405)
  }

  let body
  try {
    body = JSON.parse(req.bodyRaw || '{}')
  } catch {
    return res.json({ error: 'Invalid JSON body' }, 400)
  }

  const { reach1, reach2 } = body
  if (!isReach(reach1) || !isReach(reach2)) {
    return res.json(
      { error: 'reach1 and reach2 must each have numeric maxWidth and stepsCompleted' },
      422,
    )
  }

  const apiKey = process.env.TYPESAFE_API_KEY
  if (!apiKey) {
    error('TYPESAFE_API_KEY is not set on this function')
    return res.json({ error: 'Server not configured' }, 500)
  }

  let response
  try {
    response = await fetch(TYPESAFE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: {
          pointA: {
            widestVesselCrossSectionFoundWalkingAway: reach1.maxWidth,
            stepsWalkedBeforeRunningOffTheModel: reach1.stepsCompleted,
          },
          pointB: {
            widestVesselCrossSectionFoundWalkingAway: reach2.maxWidth,
            stepsWalkedBeforeRunningOffTheModel: reach2.stepsCompleted,
          },
        },
        model: 'jev-latest',
        questions: {
          proximal: {
            type: 'choice',
            instructions:
              'Two points were clicked on a blood vessel to bracket a lesion. From each point, the app walked away from the other point and recorded the widest vessel cross-section it found and how many steps it could walk before running off the vessel. A vessel widens toward the heart (the trunk) and narrows or dead-ends toward a branch tip. Which point is more likely the proximal (near-heart) side?',
            criteria: {
              pointA: 'Point A is the proximal, near-heart side',
              pointB: 'Point B is the proximal, near-heart side',
            },
          },
        },
      }),
    })
  } catch (err) {
    error(String(err))
    return res.json({ error: 'Request to TypeSafe failed' }, 502)
  }

  if (!response.ok) {
    error(`TypeSafe API error ${response.status}: ${await response.text()}`)
    return res.json({ error: 'TypeSafe API error' }, 502)
  }

  const data = await response.json()
  const answer = data?.answers?.proximal
  if (!answer || (answer.choice !== 'pointA' && answer.choice !== 'pointB')) {
    error(`Unexpected TypeSafe response shape: ${JSON.stringify(data)}`)
    return res.json({ error: 'Unexpected TypeSafe response shape' }, 502)
  }

  return res.json({
    decision: answer.choice === 'pointA' ? 'first' : 'second',
    confidence: answer.confidence ?? 0,
  })
}
