/**
 * JSON File Cache Service
 * Simple file-based caching for scraped data and user preferences
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')
const cacheFile = join(dataDir, 'cache.json')
const summariesFile = join(dataDir, 'summaries.json')

let cache = {}
let summaries = {}

export function initDb() {
    // Ensure data directory exists
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true })
    }

    // Load existing cache
    if (existsSync(cacheFile)) {
        try {
            cache = JSON.parse(readFileSync(cacheFile, 'utf-8'))
        } catch {
            cache = {}
        }
    }

    // Load existing summaries
    if (existsSync(summariesFile)) {
        try {
            summaries = JSON.parse(readFileSync(summariesFile, 'utf-8'))
        } catch {
            summaries = {}
        }
    }

    // Clean expired cache entries
    const now = Date.now()
    for (const key of Object.keys(cache)) {
        if (cache[key].expiresAt < now) {
            delete cache[key]
        }
    }
    saveCache()

    console.log('📦 File-based cache initialized')
}

function saveCache() {
    writeFileSync(cacheFile, JSON.stringify(cache, null, 2))
}

function saveSummariesFile() {
    writeFileSync(summariesFile, JSON.stringify(summaries, null, 2))
}

/**
 * Get item from cache
 */
export function getFromCache(key) {
    const item = cache[key]
    if (!item) return null

    if (item.expiresAt < Date.now()) {
        delete cache[key]
        saveCache()
        return null
    }

    return item.value
}

/**
 * Set item in cache
 * @param {string} key Cache key
 * @param {any} value Value to cache
 * @param {number} ttlSeconds Time to live in seconds
 */
export function setInCache(key, value, ttlSeconds = 3600) {
    cache[key] = {
        value,
        expiresAt: Date.now() + (ttlSeconds * 1000)
    }
    saveCache()
}

/**
 * Clear cache for a specific key pattern
 */
export function clearCache(pattern = '') {
    if (!pattern) {
        cache = {}
    } else {
        for (const key of Object.keys(cache)) {
            if (key.includes(pattern)) {
                delete cache[key]
            }
        }
    }
    saveCache()
}

/**
 * Save episode summary
 */
export function saveSummary(episodeSlug, podcastSlug, summary) {
    summaries[episodeSlug] = {
        podcastSlug,
        summary,
        createdAt: Date.now()
    }
    saveSummariesFile()
}

/**
 * Get saved summary
 */
export function getSummary(episodeSlug) {
    const item = summaries[episodeSlug]
    return item ? item.summary : null
}

/**
 * Get all summaries for a podcast
 */
export function getPodcastSummaries(podcastSlug) {
    return Object.entries(summaries)
        .filter(([_, item]) => item.podcastSlug === podcastSlug)
        .map(([episodeSlug, item]) => ({
            episodeSlug,
            summary: item.summary,
            createdAt: new Date(item.createdAt)
        }))
        .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Count saved transcripts for a podcast
 * Looks in cache for transcript entries
 */
export function getSavedTranscriptCount(podcastSlug) {
    let count = 0
    for (const key of Object.keys(cache)) {
        if (key.startsWith(`transcript:${podcastSlug}:`)) {
            const item = cache[key]
            if (item && item.expiresAt > Date.now()) {
                count++
            }
        }
    }
    return count
}

/**
 * Get list of saved transcript episode slugs for a podcast
 */
export function getSavedTranscriptSlugs(podcastSlug) {
    const slugs = []
    for (const key of Object.keys(cache)) {
        if (key.startsWith(`transcript:${podcastSlug}:`)) {
            const item = cache[key]
            if (item && item.expiresAt > Date.now()) {
                const parts = key.split(':')
                if (parts[2]) slugs.push(parts[2])
            }
        }
    }
    return slugs
}

/**
 * Count summaries for a podcast
 */
export function getSummaryCount(podcastSlug) {
    return Object.values(summaries).filter(s => s.podcastSlug === podcastSlug).length
}
