/**
 * Podscripts.co Scraper Service
 * Fetches podcast listings, episodes, and transcripts from podscripts.co
 */

import * as cheerio from 'cheerio'
import { getFromCache, setInCache } from './cache.js'

const BASE_URL = 'https://podscripts.co'
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

async function fetchPage(url) {
    const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
    })
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }
    return response.text()
}

/**
 * Search for podcasts by name
 */
export async function searchPodcasts(query) {
    // Check cache first
    const cacheKey = `search:${query.toLowerCase()}`
    const cached = getFromCache(cacheKey)
    if (cached) return cached

    try {
        // Podscripts.co doesn't have a search API, so we'll search the podcasts page
        const html = await fetchPage(`${BASE_URL}/podcasts`)
        const $ = cheerio.load(html)

        const podcasts = []
        const queryLower = query.toLowerCase()

        // Find all podcast links
        $('a[href*="/podcasts/"]').each((_, el) => {
            const $el = $(el)
            const href = $el.attr('href')
            const name = $el.text().trim()

            // Skip non-podcast links
            if (!href || href === '/podcasts' || href === '/podcasts/') return
            if (!name || name.length < 3) return

            // Match query
            if (name.toLowerCase().includes(queryLower)) {
                const slug = href.replace('/podcasts/', '').replace('/', '')
                if (slug && !podcasts.find(p => p.slug === slug)) {
                    podcasts.push({
                        name,
                        slug,
                        url: `${BASE_URL}${href}`,
                        artwork: null,
                        description: '',
                        episodeCount: null
                    })
                }
            }
        })

        // Also add some featured podcasts if they match
        const featured = [
            { name: 'Modern Wisdom', slug: 'modern-wisdom', description: 'Life lessons from the greatest thinkers on the planet with Chris Williamson.' },
            { name: 'The Joe Rogan Experience', slug: 'the-joe-rogan-experience', description: 'The official Joe Rogan Experience podcast.' },
            { name: 'Huberman Lab', slug: 'huberman-lab', description: 'Science-based tools for everyday life with Dr. Andrew Huberman.' },
            { name: 'The Diary Of A CEO', slug: 'the-diary-of-a-ceo-with-steven-bartlett', description: 'Conversations with business leaders and thinkers.' },
            { name: 'All-In Podcast', slug: 'all-in-with-chamath-jason-sacks-friedberg', description: 'Industry veterans discuss tech, economics, and more.' },
            { name: 'The Jordan B. Peterson Podcast', slug: 'the-jordan-b-peterson-podcast', description: 'Exploring ideas, psychology, and culture.' },
            { name: 'Lex Fridman Podcast', slug: 'lex-fridman-podcast', description: 'Conversations about AI, science, and the human condition.' },
            { name: 'The Knowledge Project', slug: 'the-knowledge-project-with-shane-parrish', description: 'Mastering the best of what other people have figured out.' }
        ]

        for (const fp of featured) {
            if (fp.name.toLowerCase().includes(queryLower) && !podcasts.find(p => p.slug === fp.slug)) {
                podcasts.push({
                    ...fp,
                    url: `${BASE_URL}/podcasts/${fp.slug}/`,
                    artwork: null,
                    episodeCount: null
                })
            }
        }

        // Cache results for 1 hour
        setInCache(cacheKey, podcasts, 3600)
        return podcasts
    } catch (err) {
        console.error('Search error:', err)
        return []
    }
}

/**
 * Get podcast details and episodes (up to 100)
 * Fetches multiple pages from podscripts.co to get 100 episodes
 */
export async function getPodcastEpisodes(slug, page = 1) {
    const cacheKey = `podcast:${slug}:all`
    const cached = getFromCache(cacheKey)
    if (cached) return cached

    try {
        // Fetch up to 5 pages to get ~100 episodes
        const episodes = []
        let podcast = null

        for (let pageNum = 1; pageNum <= 5; pageNum++) {
            const url = pageNum === 1
                ? `${BASE_URL}/podcasts/${slug}/`
                : `${BASE_URL}/podcasts/${slug}?page=${pageNum}`

            const html = await fetchPage(url)
            const $ = cheerio.load(html)

            // Extract podcast info from first page only
            if (!podcast) {
                let artworkUrl = $('meta[property="og:image"]').attr('content') || null
                // Make relative URLs absolute
                if (artworkUrl && artworkUrl.startsWith('/')) {
                    artworkUrl = `${BASE_URL}${artworkUrl}`
                }
                podcast = {
                    name: $('h1').first().text().trim() || slug,
                    slug,
                    url: `${BASE_URL}/podcasts/${slug}/`,
                    description: $('meta[property="og:description"]').attr('content') || '',
                    artwork: artworkUrl
                }
            }

            // Use correct selectors - titles are in h3 a elements
            let foundEpisodes = 0
            $('h3 a').each((_, el) => {
                const $titleLink = $(el)
                const href = $titleLink.attr('href')
                const title = $titleLink.text().trim()

                // Skip if not an episode link
                if (!href || !href.includes(`/podcasts/${slug}/`)) return
                if (!title || title.length < 5) return

                const episodeSlug = href.split('/').filter(Boolean).pop()
                if (!episodeSlug || episodes.find(e => e.slug === episodeSlug)) return

                // Get episode date from parent container text
                const $card = $titleLink.closest('.geodir-category-listing, .listing-item, article') || $titleLink.parent().parent()
                const cardText = $card.text()

                // Extract date from "Episode Date: Month DD, YYYY" pattern
                let date = null
                const dateMatch = cardText.match(/Episode Date:\s*([A-Za-z]+ \d{1,2},? \d{4})/i)
                if (dateMatch) {
                    date = dateMatch[1].trim()
                }

                // Try to get likes count (heart icon badge)
                let likes = null
                const likeBadge = $card.find('.fa-heart').parent()
                if (likeBadge.length) {
                    const likeText = likeBadge.find('span').first().text().trim()
                    if (likeText && !isNaN(parseInt(likeText))) {
                        likes = parseInt(likeText)
                    }
                }

                episodes.push({
                    title,
                    slug: episodeSlug,
                    podcastSlug: slug,
                    url: `${BASE_URL}${href}`,
                    date,
                    likes: likes || 0
                })
                foundEpisodes++
            })

            // If we found fewer than 10 episodes, we've hit the last page
            if (foundEpisodes < 10) break
            if (episodes.length >= 100) break
        }

        const limitedEpisodes = episodes.slice(0, 100)

        const result = {
            podcast: {
                ...podcast,
                totalEpisodes: episodes.length,
                loadedEpisodes: limitedEpisodes.length
            },
            episodes: limitedEpisodes
        }
        setInCache(cacheKey, result, 1800) // Cache 30 min
        return result
    } catch (err) {
        console.error('Podcast fetch error:', err)
        return { podcast: { name: slug, slug, totalEpisodes: 0, loadedEpisodes: 0 }, episodes: [] }
    }
}

/**
 * Get episode transcript
 */
export async function getTranscript(podcastSlug, episodeSlug) {
    const cacheKey = `transcript:${podcastSlug}:${episodeSlug}`
    const cached = getFromCache(cacheKey)
    if (cached) return cached

    try {
        const url = `${BASE_URL}/podcasts/${podcastSlug}/${episodeSlug}`
        const html = await fetchPage(url)
        const $ = cheerio.load(html)

        // Extract episode info
        const episode = {
            title: $('h1').first().text().trim().replace(' Transcript and Discussion', ''),
            slug: episodeSlug,
            podcastSlug,
            url,
            description: $('meta[property="og:description"]').attr('content') || '',
            date: null,
            duration: null
        }

        // Extract transcript segments
        const transcript = []

        // Patterns that indicate non-transcript content (podcast descriptions)
        const descriptionPatterns = [
            /^From the .+ Hotel/i,
            /Grab onto this fast moving train/i,
            /years at the Late Night desk/i,
            /Take control of your life and money/i,
            /first time ever, full .+ episodes are now a podcast/i,
            /daily podcast that revels/i,
            /Subscribe to this .+ podcast/i,
            /unique perspectives on all-things/i,
            /funniest podcast out there/i,
            /straight talk from .+ and his team/i,
            /Join .+ as they praise, ridicule/i,
            /Get your API key from/i,
            /Featured Podcasts/i,
            /Newest Episodes/i,
            /Privacy Policy/i,
            /Sign In/i,
            /Cookie/i,
            /Advertisement/i,
            /podscripts\.co/i
        ]

        const isDescriptionText = (text) => {
            return descriptionPatterns.some(pattern => pattern.test(text))
        }

        // Podscripts uses various formats - try multiple selectors
        // Look for timestamped content first (most reliable)
        $('[class*="transcript"], [class*="segment"], [data-timestamp]').each((_, el) => {
            const $el = $(el)
            const text = $el.text().trim()

            if (!text || text.length < 20) return
            if (isDescriptionText(text)) return

            // Look for timestamp patterns like "00:00:00" or "Starting point is 00:00:00"
            const timestampMatch = text.match(/(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})/g)

            if (timestampMatch) {
                const timestamp = timestampMatch[0]
                const content = text.replace(/Starting point is \d{1,2}:\d{2}:\d{2}/g, '').trim()
                if (content.length > 10 && !isDescriptionText(content)) {
                    transcript.push({ timestamp, text: content })
                }
            }
        })

        // Look for main content area paragraphs if no timestamped content found
        if (transcript.length < 5) {
            // Try to find the main article/content area
            const mainContent = $('article, .content, .transcript-content, main, [class*="episode"]').first()
            const paragraphContainer = mainContent.length ? mainContent : $('body')

            paragraphContainer.find('p').each((_, el) => {
                const $el = $(el)
                const text = $el.text().trim()

                if (!text || text.length < 30) return
                if (isDescriptionText(text)) return

                // Skip if it looks like a short podcast description
                if (text.length < 200 && (text.includes('...') || text.endsWith('more'))) return

                // Look for timestamp in the paragraph
                const timestampMatch = text.match(/^(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\s*/)
                if (timestampMatch) {
                    transcript.push({
                        timestamp: timestampMatch[1],
                        text: text.replace(timestampMatch[0], '').trim()
                    })
                } else if (text.length > 80) {
                    // Only include longer paragraphs as plain text (likely transcript content)
                    transcript.push({ timestamp: null, text })
                }
            })
        }

        // If still no content, try splitting body text but be more selective
        if (transcript.length < 3) {
            const bodyText = $('body').text()
            // Split on double newlines or period followed by capital letter
            const paragraphs = bodyText.split(/\n\n+|\.\s+(?=[A-Z])/)
                .map(p => p.trim())
                .filter(p => p.length > 100 && p.length < 2000) // Not too short, not too long
                .filter(p => !isDescriptionText(p))

            for (const para of paragraphs.slice(0, 50)) {
                const cleaned = para.trim()
                if (cleaned.length > 80) {
                    transcript.push({ timestamp: null, text: cleaned })
                }
            }
        }

        const result = { episode, transcript: transcript.slice(0, 200) }
        setInCache(cacheKey, result, 86400) // Cache 24 hours
        return result
    } catch (err) {
        console.error('Transcript fetch error:', err)
        return { episode: { title: episodeSlug, slug: episodeSlug }, transcript: [] }
    }
}

/**
 * Get podcast info only
 */
export async function getPodcastInfo(slug) {
    const { podcast } = await getPodcastEpisodes(slug)
    return podcast
}
