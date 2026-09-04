// Feeds Claude the same width-profile data the local heuristic already
// extracts from the 3D model (see autoLesionMeasurement.js) and asks it to
// find the lesion directly, so we can compare Claude's own read of the
// geometry against the hand-coded heuristic's answer.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const envText = readFileSync(path.join(__dirname, '.env'), 'utf8')
const apiKey = envText.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim()
if (!apiKey) throw new Error('ANTHROPIC_API_KEY not found in .env')

const data = JSON.parse(readFileSync(path.join(__dirname, 'vessel-profile.json'), 'utf8'))

const prompt = `You are analyzing a coronary vessel width profile extracted from a real 3D scan. Each entry is the vessel diameter (mm) measured at a distance (mm) along the vessel, proximal (heart side) to distal.

Profile:
${JSON.stringify(data.profile)}

Based only on this data:
1. Identify the narrowest point (distance and diameter).
2. Estimate the stenosis rate as a percentage: compare the narrowest diameter to a reasonable reference diameter (e.g. the average of the proximal and distal ends, or the healthy diameter nearby).
3. Classify the narrowest point's position along the segment as 近位 (proximal third), 中間 (middle third), or 遠位 (distal third).
4. Briefly note your confidence and any caveats about this being a rough estimate from a small sample.

Respond concisely in the same structure a clinician's report would use: narrowest diameter, stenosis rate, position, confidence/caveats.`

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  }),
})

if (!response.ok) {
  const text = await response.text()
  throw new Error(`API error ${response.status}: ${text}`)
}

const result = await response.json()
const claudeText = result.content?.find((block) => block.type === 'text')?.text ?? '(no text in response)'

console.log('=== Claude\'s analysis ===')
console.log(claudeText)
console.log('\n=== Heuristic\'s analysis (for comparison) ===')
console.log(JSON.stringify(data.heuristicResult, null, 2))
