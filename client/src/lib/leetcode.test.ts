import { describe, expect, it } from 'vitest'
import { parseLeetCodeUrl, titleFromSlug } from './leetcode'

describe('titleFromSlug', () => {
  it.each([
    ['two-sum', 'Two Sum'],
    ['best-time-to-buy-and-sell-stock-ii', 'Best Time to Buy and Sell Stock II'],
    ['lowest-common-ancestor-of-a-binary-tree', 'Lowest Common Ancestor of a Binary Tree'],
    ['lru-cache', 'LRU Cache'],
    ['3sum', '3Sum'],
    ['the-skyline-problem', 'The Skyline Problem'],
    ['word-search-iii', 'Word Search III'],
    ['minimum-window-substring', 'Minimum Window Substring'],
    ['validate-binary-search-tree', 'Validate Binary Search Tree'],
  ])('%s -> %s', (slug, title) => {
    expect(titleFromSlug(slug)).toBe(title)
  })

  it('does not mistake ordinary words for roman numerals', () => {
    expect(titleFromSlug('mix-vivid-civic')).toBe('Mix Vivid Civic')
  })
})

describe('parseLeetCodeUrl', () => {
  it('parses plain, description, and query-string links', () => {
    const expected = { slug: 'two-sum', title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/' }
    expect(parseLeetCodeUrl('https://leetcode.com/problems/two-sum')).toEqual(expected)
    expect(parseLeetCodeUrl('  https://leetcode.com/problems/two-sum/description/  ')).toEqual(expected)
    expect(parseLeetCodeUrl('https://www.leetcode.com/problems/Two-Sum/?envType=study-plan')).toEqual({
      ...expected,
      url: 'https://www.leetcode.com/problems/two-sum/',
    })
  })

  it('returns null for other sites, non-problem pages, and junk', () => {
    expect(parseLeetCodeUrl('https://neetcode.io/problems/two-sum')).toBeNull()
    expect(parseLeetCodeUrl('https://leetcode.com/problemset/')).toBeNull()
    expect(parseLeetCodeUrl('https://evil.example/leetcode.com/problems/two-sum')).toBeNull()
    expect(parseLeetCodeUrl('not a url')).toBeNull()
    expect(parseLeetCodeUrl('')).toBeNull()
  })
})
