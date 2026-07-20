// The event catalog: which DECA roleplay events the trainer can simulate.
//
// Pure data + lookups (no DOM, no network) so it is shared by the React UI and
// the serverless prompt builders, and unit-testable. Formats follow real DECA
// timing: individual series events run 10:00 prep + 10:00 on air; team
// decision-making events run 30:00 prep + 15:00 on air (the TIMINGS map in
// src/DryRun.tsx keys off `format`).

import type { Difficulty, RunMode } from '../types'

export interface DecaEvent {
  /** Official-style event code, e.g. "PBM", "HTDM". */
  code: string
  /** Full printed event name. */
  name: string
  /** Career cluster the event belongs to. */
  cluster: string
  /** Individual series (solo) or team decision-making (team). */
  format: RunMode
  /** One line of flavor for the picker card. */
  blurb: string
}

export const DECA_EVENTS: DecaEvent[] = [
  {
    code: 'PBM',
    name: 'Principles of Business Management and Administration',
    cluster: 'Business Management + Administration',
    format: 'solo',
    blurb: 'Operations, people and process problems in an entry-level management seat.'
  },
  {
    code: 'PMK',
    name: 'Principles of Marketing',
    cluster: 'Marketing',
    format: 'solo',
    blurb: 'Promotion, pricing and customer decisions for a product or brand.'
  },
  {
    code: 'PFN',
    name: 'Principles of Finance',
    cluster: 'Finance',
    format: 'solo',
    blurb: 'Budgets, credit and money decisions explained to a non-expert.'
  },
  {
    code: 'PHT',
    name: 'Principles of Hospitality and Tourism',
    cluster: 'Hospitality + Tourism',
    format: 'solo',
    blurb: 'Guest experience and service recovery in hotels, travel and events.'
  },
  {
    code: 'HRM',
    name: 'Human Resources Management Series',
    cluster: 'Business Management + Administration',
    format: 'solo',
    blurb: 'Hiring, training, morale and workplace-policy calls.'
  },
  {
    code: 'HTDM',
    name: 'Hospitality Services Team Decision Making',
    cluster: 'Hospitality + Tourism',
    format: 'team',
    blurb: 'You and a partner untangle a layered hospitality operations case.'
  },
  {
    code: 'MTDM',
    name: 'Marketing Management Team Decision Making',
    cluster: 'Marketing',
    format: 'team',
    blurb: 'Two-person strategy call on a marketing management case.'
  },
  {
    code: 'FTDM',
    name: 'Financial Services Team Decision Making',
    cluster: 'Finance',
    format: 'team',
    blurb: 'Partner case work on a financial services problem.'
  },
  {
    code: 'BLTDM',
    name: 'Business Law and Ethics Team Decision Making',
    cluster: 'Business Management + Administration',
    format: 'team',
    blurb: 'Ethics and legal-gray-area decisions argued as a team.'
  }
]

export const DEFAULT_EVENT_CODE = 'PBM'

/** Look up an event by code; unknown codes fall back to the default event. */
export const eventByCode = (code: string | undefined): DecaEvent => {
  const found = DECA_EVENTS.find((event) => event.code === code)
  return found ?? (DECA_EVENTS.find((e) => e.code === DEFAULT_EVENT_CODE) as DecaEvent)
}

export interface DifficultySpec {
  label: string
  /** How many performance indicators the scenario carries at this tier. */
  indicators: number
  /** Complexity instruction handed to the scenario author prompt. */
  complexity: string
  /** One line of flavor for the picker. */
  blurb: string
}

export const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  regional: {
    label: 'Regional',
    indicators: 4,
    complexity:
      'Pose ONE clear, self-contained problem with a single obvious tension. A well-prepared first-year competitor should be able to structure an answer.',
    blurb: 'One clean problem. Where everyone starts.'
  },
  provincial: {
    label: 'Provincial',
    indicators: 5,
    complexity:
      'Pose a layered problem with a real tradeoff between two defensible options, plus one complicating constraint (budget, deadline, or stakeholder).',
    blurb: 'A real tradeoff with a complication.'
  },
  icdc: {
    label: 'ICDC',
    indicators: 7,
    complexity:
      'Pose a demanding multi-constraint problem: competing stakeholder interests, at least two quantitative details that must be reconciled, and an ethical or strategic wrinkle. This is international-final difficulty.',
    blurb: 'Multi-constraint, international-final pressure.'
  }
}

export const DEFAULT_DIFFICULTY: Difficulty = 'provincial'

/** Type guard for difficulty strings arriving from request bodies / storage. */
export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'regional' || value === 'provincial' || value === 'icdc'
