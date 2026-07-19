// Delivery analytics — pure functions, no DOM, no state.
//
// The AI judge scores WHAT you said; this module scores HOW you said it, computed
// locally from the transcript in a few microseconds. Kept pure on purpose so it is
// trivially unit-testable (tests/delivery.test.ts) and can never break the run.

/** One detected filler with how many times it appeared. */
export interface FillerCount {
  phrase: string
  count: number
}

export interface DeliveryStats {
  /** Total words spoken (whitespace-delimited tokens). */
  words: number
  /** Seconds actually spent on air (clamped to >= 0). */
  durationSeconds: number
  /** Words per minute, 0 when duration is 0. */
  wpm: number
  /** Fillers that appeared at least once, most frequent first. */
  fillers: FillerCount[]
  /** Sum of all filler occurrences. */
  fillerTotal: number
}

// Single-word fillers are matched as whole tokens; multi-word fillers as phrases.
// "like" and "actually" are common enough in legitimate speech that we only count
// the unambiguous verbal tics here — precision over recall, so the number shown
// to the student is defensible.
const SINGLE_FILLERS = ['um', 'uh', 'uhh', 'umm', 'er', 'erm', 'hmm'] as const
const PHRASE_FILLERS = ['you know', 'i mean', 'kind of', 'sort of', 'basically'] as const

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Count non-overlapping occurrences of `phrase` as whole words inside `haystack`. */
const countPhrase = (haystack: string, phrase: string): number => {
  if (!haystack) return 0
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = haystack.match(new RegExp(`\\b${escaped}\\b`, 'g'))
  return matches ? matches.length : 0
}

/**
 * Compute delivery stats for a finished take.
 *
 * @param transcript raw transcript (speech-to-text or typed)
 * @param durationSeconds seconds spent on air; non-finite or negative treated as 0
 */
export const computeDelivery = (
  transcript: string,
  durationSeconds: number
): DeliveryStats => {
  const clean = normalize(transcript)
  const words = clean ? clean.split(' ').length : 0
  const duration = Number.isFinite(durationSeconds)
    ? Math.max(0, Math.round(durationSeconds))
    : 0
  const wpm = duration > 0 ? Math.round((words / duration) * 60) : 0

  const fillers: FillerCount[] = []
  for (const phrase of [...SINGLE_FILLERS, ...PHRASE_FILLERS]) {
    const count = countPhrase(clean, phrase)
    if (count > 0) fillers.push({ phrase, count })
  }
  fillers.sort((a, b) => b.count - a.count)
  const fillerTotal = fillers.reduce((sum, f) => sum + f.count, 0)

  return { words, durationSeconds: duration, wpm, fillers, fillerTotal }
}

/**
 * One-line human read on pace. Conversational presenting sits roughly 120–160
 * wpm; DECA rewards controlled, deliberate delivery, so we nudge toward that band.
 */
export const paceLabel = (wpm: number): string => {
  if (wpm === 0) return 'No pace data'
  if (wpm < 100) return 'Slow — add energy'
  if (wpm <= 165) return 'On pace'
  if (wpm <= 190) return 'Quick — breathe'
  return 'Rushed — slow down'
}

// ---- Transcript segmentation (filler highlighting) ---------------------------

/** A slice of the raw transcript, flagged when it is a detected filler. */
export interface TranscriptSegment {
  text: string
  filler: boolean
}

// One alternation over every filler, longest phrase first so "you know" wins over
// a hypothetical shorter overlap. Spaces inside phrases match any whitespace so
// raw (un-normalized) transcripts still hit.
const FILLER_PATTERN = [...PHRASE_FILLERS, ...SINGLE_FILLERS]
  .slice()
  .sort((a, b) => b.length - a.length)
  .map((phrase) => phrase.replace(/ /g, '\\s+'))
  .join('|')

/**
 * Split a RAW transcript into segments so the UI can highlight fillers in place.
 * Pure and case-insensitive; punctuation between the words of a phrase filler is
 * not matched (precision over recall, same stance as the counters above).
 */
export const segmentFillers = (transcript: string): TranscriptSegment[] => {
  if (!transcript) return []
  const regex = new RegExp(`\\b(?:${FILLER_PATTERN})\\b`, 'gi')
  const segments: TranscriptSegment[] = []
  let cursor = 0
  for (const match of transcript.matchAll(regex)) {
    const start = match.index
    if (start > cursor) {
      segments.push({ text: transcript.slice(cursor, start), filler: false })
    }
    segments.push({ text: match[0], filler: true })
    cursor = start + match[0].length
  }
  if (cursor < transcript.length) {
    segments.push({ text: transcript.slice(cursor), filler: false })
  }
  return segments
}
