/**
 * Podcast API Routes
 */

import { Router } from 'express'
import { searchPodcasts, getPodcastEpisodes, getTranscript, getPodcastInfo } from '../services/scraper.js'
import { generateSummary, calculateRelevance } from '../services/llm.js'
import { getSummary, saveSummary, getSavedTranscriptCount, getSummaryCount, getSavedTranscriptSlugs } from '../services/cache.js'

const router = Router()

/**
 * GET /api/podcasts/search?q=query
 * Search for podcasts
 */
router.get('/podcasts/search', async (req, res) => {
    const { q } = req.query

    if (!q || q.trim().length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' })
    }

    try {
        const podcasts = await searchPodcasts(q.trim())
        res.json({ podcasts })
    } catch (err) {
        console.error('Search error:', err)
        res.status(500).json({ error: 'Search failed' })
    }
})

/**
 * GET /api/podcasts/:slug
 * Get podcast info with stats
 */
router.get('/podcasts/:slug', async (req, res) => {
    const { slug } = req.params

    try {
        const { podcast, episodes } = await getPodcastEpisodes(slug)

        // Add transcript and summary stats
        const savedTranscripts = getSavedTranscriptCount(slug)
        const savedSummaries = getSummaryCount(slug)
        const savedSlugs = getSavedTranscriptSlugs(slug)

        res.json({
            podcast: {
                ...podcast,
                savedTranscripts,
                savedSummaries,
                savedSlugs
            }
        })
    } catch (err) {
        console.error('Podcast info error:', err)
        res.status(500).json({ error: 'Failed to get podcast info' })
    }
})

/**
 * GET /api/podcasts/:slug/episodes
 * Get podcast episodes with stats
 */
router.get('/podcasts/:slug/episodes', async (req, res) => {
    const { slug } = req.params
    const { page = 1, perPage = 10 } = req.query

    try {
        const data = await getPodcastEpisodes(slug)

        // Add transcript stats to response
        const savedTranscripts = getSavedTranscriptCount(slug)
        const savedSummaries = getSummaryCount(slug)
        const savedSlugs = getSavedTranscriptSlugs(slug)

        // Mark episodes that have saved transcripts
        const episodesWithStatus = data.episodes.map(ep => ({
            ...ep,
            hasTranscript: savedSlugs.includes(ep.slug)
        }))

        // Paginate: 10 per page
        const pageNum = parseInt(page) || 1
        const perPageNum = parseInt(perPage) || 10
        const startIdx = (pageNum - 1) * perPageNum
        const endIdx = startIdx + perPageNum
        const paginatedEpisodes = episodesWithStatus.slice(startIdx, endIdx)
        const totalPages = Math.ceil(episodesWithStatus.length / perPageNum)

        res.json({
            podcast: {
                ...data.podcast,
                savedTranscripts,
                savedSummaries
            },
            episodes: paginatedEpisodes,
            pagination: {
                page: pageNum,
                perPage: perPageNum,
                totalEpisodes: data.episodes.length,
                totalPages,
                hasMore: pageNum < totalPages
            }
        })
    } catch (err) {
        console.error('Episodes error:', err)
        res.status(500).json({ error: 'Failed to get episodes' })
    }
})

/**
 * GET /api/episodes/:podcastSlug/:episodeSlug/transcript
 * Alternative route format
 */
router.get('/episodes/:podcastSlug/:episodeSlug/transcript', async (req, res) => {
    const { podcastSlug, episodeSlug } = req.params

    try {
        const data = await getTranscript(podcastSlug, episodeSlug)

        // Check for cached summary
        const summary = getSummary(episodeSlug)
        if (summary) {
            data.summary = summary
        }

        res.json(data)
    } catch (err) {
        console.error('Transcript error:', err)
        res.status(500).json({ error: 'Failed to get transcript' })
    }
})

/**
 * GET /api/episodes/:slug/transcript
 * Get episode transcript (slug includes podcast info)
 */
router.get('/episodes/:slug/transcript', async (req, res) => {
    const { slug } = req.params

    // Parse slug - could be "podcast-slug/episode-slug" or just "episode-slug"
    let podcastSlug = 'modern-wisdom' // Default
    let episodeSlug = slug

    if (slug.includes('--')) {
        const parts = slug.split('--')
        podcastSlug = parts[0]
        episodeSlug = parts[1]
    }

    try {
        const data = await getTranscript(podcastSlug, episodeSlug)

        // Check for cached summary
        const summary = getSummary(episodeSlug)
        if (summary) {
            data.summary = summary
        }

        res.json(data)
    } catch (err) {
        console.error('Transcript error:', err)
        res.status(500).json({ error: 'Failed to get transcript' })
    }
})

/**
 * POST /api/episodes/:slug/summarize
 * Generate AI summary for episode
 */
router.post('/episodes/:slug/summarize', async (req, res) => {
    const { slug } = req.params
    const { apiKey, writingProfile, writingStyle, brandTemplate } = req.body

    if (!apiKey) {
        return res.status(400).json({ error: 'API key required' })
    }

    // Parse slug
    let podcastSlug = 'modern-wisdom'
    let episodeSlug = slug

    if (slug.includes('--')) {
        const parts = slug.split('--')
        podcastSlug = parts[0]
        episodeSlug = parts[1]
    }

    try {
        // Get transcript
        const { transcript } = await getTranscript(podcastSlug, episodeSlug)

        if (!transcript || transcript.length === 0) {
            return res.status(400).json({ error: 'No transcript available' })
        }

        // Generate summary with brand template and writing style
        const summary = await generateSummary(apiKey, transcript, writingProfile || '', {
            writingStyle: writingStyle || '',
            brandTemplate: brandTemplate || null
        })

        // Cache the summary
        saveSummary(episodeSlug, podcastSlug, summary)

        res.json({ summary })
    } catch (err) {
        console.error('Summary error:', err)
        res.status(500).json({ error: 'Failed to generate summary: ' + err.message })
    }
})

/**
 * POST /api/analyze-writing-style
 * Analyze writing samples and generate a writing style description
 */
router.post('/analyze-writing-style', async (req, res) => {
    const { apiKey, writingSamples } = req.body

    if (!apiKey) {
        return res.status(400).json({ error: 'API key required' })
    }

    if (!writingSamples || writingSamples.trim().length < 50) {
        return res.status(400).json({ error: 'Writing samples required' })
    }

    try {
        const { analyzeWritingStyle } = await import('../services/llm.js')
        const writingStyle = await analyzeWritingStyle(apiKey, writingSamples)
        res.json({ writingStyle })
    } catch (err) {
        console.error('Analyze style error:', err)
        res.status(500).json({ error: 'Failed to analyze writing style: ' + err.message })
    }
})

/**
 * GET /api/dashboard
 * Get dashboard data (recent episodes from subscriptions)
 */
router.get('/dashboard', async (req, res) => {
    const { slugs } = req.query

    try {
        const recentEpisodes = []

        // If subscriptions are provided, fetch recent episodes from each
        if (slugs) {
            const podcastSlugs = slugs.split(',').filter(s => s.trim())

            for (const slug of podcastSlugs.slice(0, 5)) { // Limit to 5 podcasts
                try {
                    const data = await getPodcastEpisodes(slug)
                    const savedSlugs = getSavedTranscriptSlugs(slug)

                    // Get first 3 episodes from each podcast
                    const episodes = data.episodes.slice(0, 3).map(ep => ({
                        ...ep,
                        podcastName: data.podcast?.name,
                        podcastSlug: slug,
                        hasSummary: savedSlugs.includes(ep.slug),
                        hasIdeas: savedSlugs.includes(ep.slug) // Ideas are generated with summary
                    }))

                    recentEpisodes.push(...episodes)
                } catch (e) {
                    console.error(`Error fetching ${slug}:`, e.message)
                }
            }
        }

        // Sort by date (most recent first) and limit
        recentEpisodes.sort((a, b) => {
            const dateA = a.date ? new Date(a.date) : new Date(0)
            const dateB = b.date ? new Date(b.date) : new Date(0)
            return dateB - dateA
        })

        res.json({
            recentEpisodes: recentEpisodes.slice(0, 10),
            stats: {
                totalSubscriptions: slugs ? slugs.split(',').length : 0,
                totalSummaries: recentEpisodes.filter(e => e.hasSummary).length
            }
        })
    } catch (err) {
        console.error('Dashboard error:', err)
        res.status(500).json({ error: 'Failed to load dashboard' })
    }
})

/**
 * POST /api/podcasts/import-rss
 * Import a podcast from RSS feed URL and check for transcripts
 */
router.post('/podcasts/import-rss', async (req, res) => {
    const { rssUrl } = req.body

    if (!rssUrl || !rssUrl.trim()) {
        return res.status(400).json({ error: 'RSS URL is required' })
    }

    try {
        // Fetch the RSS feed
        const response = await fetch(rssUrl.trim())
        if (!response.ok) {
            throw new Error('Failed to fetch RSS feed')
        }

        const xmlText = await response.text()

        // Parse RSS XML (simple parsing)
        const titleMatch = xmlText.match(/<title><!?\[?CDATA\[?([^\]<]+)/i) || xmlText.match(/<title>([^<]+)/i)
        const descMatch = xmlText.match(/<description><!?\[?CDATA\[?([^\]<]+)/i) || xmlText.match(/<description>([^<]+)/i)
        const imageMatch = xmlText.match(/<itunes:image[^>]*href="([^"]+)"/i) || xmlText.match(/<image>\s*<url>([^<]+)/i)

        // Count episodes
        const episodeMatches = xmlText.match(/<item>/gi) || []
        const episodeCount = episodeMatches.length

        const podcastName = titleMatch ? titleMatch[1].replace(']]>', '').trim() : 'Unknown Podcast'
        const description = descMatch ? descMatch[1].replace(']]>', '').trim().substring(0, 200) : ''
        const artwork = imageMatch ? imageMatch[1] : null

        // Create slug from name
        const slug = podcastName.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')

        // Check if podcast exists on podscripts.co
        let hasTranscripts = false
        try {
            const { podcast } = await getPodcastInfo(slug)
            hasTranscripts = !!podcast
        } catch (e) {
            // Podcast not found on podscripts.co
            hasTranscripts = false
        }

        const podcast = {
            name: podcastName,
            slug,
            description,
            artwork,
            episodeCount,
            rssUrl: rssUrl.trim()
        }

        res.json({
            podcast,
            hasTranscripts,
            added: true,
            message: hasTranscripts
                ? 'Podcast imported! Transcripts are available on podscripts.co'
                : 'Podcast imported, but transcripts are not yet available on podscripts.co'
        })
    } catch (err) {
        console.error('RSS import error:', err)
        res.status(400).json({ error: 'Failed to import RSS feed: ' + err.message })
    }
})

/**
 * Settings file path
 */
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { promises as fs } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SETTINGS_FILE = join(__dirname, '..', 'data', 'settings.json')

/**
 * GET /api/settings
 * Load user settings from file
 */
router.get('/settings', async (req, res) => {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf-8')
        const settings = JSON.parse(data)
        res.json(settings)
    } catch (err) {
        if (err.code === 'ENOENT') {
            // No settings file yet, return empty
            res.json({})
        } else {
            console.error('Settings load error:', err)
            res.status(500).json({ error: 'Failed to load settings' })
        }
    }
})

/**
 * POST /api/settings
 * Save user settings to file
 */
router.post('/settings', async (req, res) => {
    const settings = req.body

    try {
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
        res.json({ success: true })
    } catch (err) {
        console.error('Settings save error:', err)
        res.status(500).json({ error: 'Failed to save settings' })
    }
})

export default router


