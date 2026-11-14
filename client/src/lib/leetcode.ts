const SMALL_WORDS = new Set(['a', 'an', 'the', 'of', 'in', 'to', 'and', 'or', 'for', 'on', 'at', 'by', 'from', 'as'])
const ACRONYMS = new Set(['lru', 'lfu', 'bst', 'ip', 'xor', 'utf', 'lca', 'gcd', 'lcm', 'bfs', 'dfs'])
const ROMAN = /^(?=[ivx])(x{0,2})(ix|iv|v?i{0,3})$/

export interface ParsedLeetCodeUrl {
  slug: string
  /** Best-guess title from the slug. Punctuation LeetCode drops from slugs cannot be recovered. */
  title: string
  /** Canonical link to the problem description. */
  url: string
}

/** Turns a URL slug such as "best-time-to-buy-and-sell-stock-ii" into a title. */
export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word, i) => {
      if (ROMAN.test(word) || ACRONYMS.has(word)) return word.toUpperCase()
      const kSum = /^(\d+)sum$/.exec(word)
      if (kSum) return `${kSum[1]}Sum`
      if (i > 0 && SMALL_WORDS.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Recognises LeetCode problem links (including ones that end in /description/,
 * /solutions/, or carry query strings) and extracts a title. Returns null for
 * anything else.
 */
export function parseLeetCodeUrl(input: string): ParsedLeetCodeUrl | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (!/^(www\.)?leetcode\.(com|cn)$/i.test(url.hostname)) return null
  const slug = /^\/problems\/([a-z0-9-]+)(\/|$)/i.exec(url.pathname)?.[1]?.toLowerCase()
  if (!slug) return null
  return { slug, title: titleFromSlug(slug), url: `https://${url.hostname.toLowerCase()}/problems/${slug}/` }
}
