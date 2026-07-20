// The performance-indicator bank: official-style DECA PIs per career cluster.
//
// Instead of letting the model invent indicator-sounding phrases, scenario
// generation samples candidates from this bank and instructs the model to pick
// the most relevant ones VERBATIM — so every generated run is judged against
// the same wording a student sees on real event papers. (Official-PDF runs
// already copy their printed PIs verbatim; this closes the gap for generated
// runs.) Curated from DECA's published PI lists: Business Administration Core
// plus cluster-specific instructional areas.

const CORE: string[] = [
  'Explain the nature of effective communication',
  'Demonstrate problem-solving skills',
  'Demonstrate active listening skills',
  'Explain the concept of management',
  'Describe the nature of ethics in business',
  'Explain the role of business in society',
  'Explain the nature of positive customer relations',
  'Demonstrate orderly and systematic behavior',
  'Explain the concept of organizational culture',
  'Describe the nature of budgets',
  'Make oral presentations',
  'Persuade others',
  'Explain the nature of staff communication',
  'Show empathy for others'
]

const BANK: Record<string, string[]> = {
  'Business Management + Administration': [
    ...CORE,
    'Explain the concept of human resource management',
    'Describe managerial considerations in staffing',
    'Explain managerial considerations in directing',
    'Describe the nature of managerial control',
    'Explain the impact of resource productivity on business success',
    'Describe crisis management strategies',
    'Explain employee rights',
    'Explain the nature of remedial action',
    'Describe the nature of organizational goals',
    'Explain the nature of workplace regulations'
  ],
  Marketing: [
    ...CORE,
    'Explain the concept of marketing strategies',
    'Explain the concept of market and market identification',
    'Describe the role of promotion as a marketing function',
    'Explain the types of advertising media',
    'Explain factors affecting pricing decisions',
    'Describe the use of target marketing in professional selling',
    'Explain the nature of a promotional plan',
    'Identify ways to segment markets',
    'Explain the nature of product/service branding',
    'Describe the impact of a product life cycle on marketing decisions'
  ],
  Finance: [
    ...CORE,
    'Explain the time value of money',
    'Describe the need for financial information',
    'Explain the nature of balance sheets',
    'Explain the purposes and importance of credit',
    'Describe sources of financing for businesses',
    'Explain the nature of operating budgets',
    'Demonstrate the wise use of credit',
    'Describe the concept of insurance',
    'Explain the nature of risk management',
    'Describe the relationship between economic conditions and financial markets'
  ],
  'Hospitality + Tourism': [
    ...CORE,
    'Explain the nature of positive guest relations',
    'Describe the impact of the hospitality and tourism industry on the economy',
    'Explain the importance of service recovery in hospitality',
    'Describe the nature of quality-service standards in hospitality',
    'Explain booking and reservation procedures',
    'Describe considerations in scheduling hospitality staff',
    'Explain the role of special events in the hospitality industry',
    'Describe safety and security considerations in hospitality',
    'Explain the concept of revenue management in hospitality',
    'Describe strategies for managing guest complaints'
  ]
}

/** The full bank for a cluster (Business Administration Core is the fallback). */
export const indicatorsForCluster = (cluster: string): string[] =>
  BANK[cluster] ?? (BANK['Business Management + Administration'] as string[])

/**
 * Sample `count` distinct candidate PIs for a cluster, shuffled so repeated
 * runs draw different combinations. `rng` is injectable for deterministic tests.
 */
export const sampleIndicators = (
  cluster: string,
  count: number,
  rng: () => number = Math.random
): string[] => {
  const pool = [...indicatorsForCluster(cluster)]
  // Fisher–Yates, driven by the injectable rng.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const a = pool[i] as string
    pool[i] = pool[j] as string
    pool[j] = a
  }
  return pool.slice(0, Math.min(count, pool.length))
}
