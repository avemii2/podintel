/**
 * Newsletter API Routes
 * Endpoints for Gmail connection, newsletter scanning, categorization,
 * engagement analytics, recommendations, and weekly digest
 */

import { Router } from 'express'
import {
    initGmailAuth, getAuthUrl, handleAuthCallback,
    isGmailConnected, disconnectGmail, scanNewsletters
} from '../services/email.js'
import {
    categorizeNewsletters, getRankedNewsletters,
    generateInsights, rebuildCategorySummary
} from '../services/newsletter.js'
import {
    analyzeUserProfile, generateRecommendations
} from '../services/recommender.js'
import {
    getSchedulerConfig, updateSchedulerConfig,
    sendWeeklyDigest, previewDigest
} from '../services/scheduler.js'
import {
    getOverviewStats, getEngagementStats, getSenders,
    getCategories, getDigestHistory, getUserProfile
} from '../services/newsletterStore.js'

const router = Router()

// ── Gmail Connection ──────────────────────────────────────────

/**
 * POST /api/newsletters/gmail/init
 * Initialize Gmail OAuth with client credentials
 */
router.post('/newsletters/gmail/init', (req, res) => {
    const { clientId, clientSecret, redirectUri } = req.body

    if (!clientId || !clientSecret) {
        return res.status(400).json({ error: 'Google OAuth client ID and secret required' })
    }

    try {
        initGmailAuth(
            clientId,
            clientSecret,
            redirectUri || `${req.protocol}://${req.get('host')}/api/newsletters/gmail/callback`
        )
        const authUrl = getAuthUrl()
        res.json({ authUrl, connected: false })
    } catch (err) {
        res.status(500).json({ error: 'Failed to initialize Gmail auth: ' + err.message })
    }
})

/**
 * GET /api/newsletters/gmail/callback
 * OAuth2 callback from Google
 */
router.get('/newsletters/gmail/callback', async (req, res) => {
    const { code, error } = req.query

    if (error) {
        return res.redirect('/?gmail_error=' + encodeURIComponent(error))
    }

    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' })
    }

    try {
        const user = await handleAuthCallback(code)
        // Redirect back to the app with success
        res.redirect(`/?gmail_connected=true&gmail_email=${encodeURIComponent(user.email)}`)
    } catch (err) {
        console.error('Gmail callback error:', err)
        res.redirect('/?gmail_error=' + encodeURIComponent(err.message))
    }
})

/**
 * GET /api/newsletters/gmail/status
 * Check Gmail connection status
 */
router.get('/newsletters/gmail/status', (req, res) => {
    res.json({ connected: isGmailConnected() })
})

/**
 * POST /api/newsletters/gmail/disconnect
 * Disconnect Gmail
 */
router.post('/newsletters/gmail/disconnect', (req, res) => {
    disconnectGmail()
    res.json({ success: true, connected: false })
})

// ── Scanning & Categorization ─────────────────────────────────

/**
 * POST /api/newsletters/scan
 * Scan Gmail for newsletters
 */
router.post('/newsletters/scan', async (req, res) => {
    const { maxResults = 200, daysBack = 90 } = req.body

    if (!isGmailConnected()) {
        return res.status(400).json({ error: 'Gmail not connected. Please connect Gmail first.' })
    }

    try {
        const result = await scanNewsletters({ maxResults, daysBack })
        res.json(result)
    } catch (err) {
        console.error('Scan error:', err)
        res.status(500).json({ error: 'Failed to scan newsletters: ' + err.message })
    }
})

/**
 * POST /api/newsletters/categorize
 * Categorize newsletters using Claude AI
 */
router.post('/newsletters/categorize', async (req, res) => {
    const { apiKey } = req.body

    if (!apiKey) {
        return res.status(400).json({ error: 'Claude API key required' })
    }

    try {
        const result = await categorizeNewsletters(apiKey)
        const categories = rebuildCategorySummary()
        res.json({ ...result, categories })
    } catch (err) {
        console.error('Categorize error:', err)
        res.status(500).json({ error: 'Failed to categorize newsletters: ' + err.message })
    }
})

// ── Analytics & Rankings ──────────────────────────────────────

/**
 * GET /api/newsletters/overview
 * Get high-level newsletter stats
 */
router.get('/newsletters/overview', (req, res) => {
    const stats = getOverviewStats()
    const categories = getCategories()
    res.json({ stats, categories })
})

/**
 * GET /api/newsletters/rankings
 * Get newsletters ranked by engagement
 */
router.get('/newsletters/rankings', (req, res) => {
    const rankings = getRankedNewsletters()
    res.json({ rankings })
})

/**
 * GET /api/newsletters/engagement
 * Get detailed engagement stats per sender
 */
router.get('/newsletters/engagement', (req, res) => {
    const stats = getEngagementStats()
    res.json({ stats })
})

/**
 * GET /api/newsletters/senders
 * Get all tracked newsletter senders
 */
router.get('/newsletters/senders', (req, res) => {
    const senders = getSenders()
    res.json({ senders })
})

/**
 * POST /api/newsletters/insights
 * Generate AI-powered insights about newsletter habits
 */
router.post('/newsletters/insights', async (req, res) => {
    const { apiKey } = req.body

    if (!apiKey) {
        return res.status(400).json({ error: 'Claude API key required' })
    }

    try {
        const insights = await generateInsights(apiKey)
        res.json(insights)
    } catch (err) {
        console.error('Insights error:', err)
        res.status(500).json({ error: 'Failed to generate insights: ' + err.message })
    }
})

// ── User Profile & Recommendations ───────────────────────────

/**
 * GET /api/newsletters/profile
 * Get the user's reader profile
 */
router.get('/newsletters/profile', (req, res) => {
    const profile = getUserProfile()
    res.json({ profile })
})

/**
 * POST /api/newsletters/profile/analyze
 * Analyze user profile from writing samples + engagement data
 */
router.post('/newsletters/profile/analyze', async (req, res) => {
    const { apiKey, writingSamples, writingStyle } = req.body

    if (!apiKey) {
        return res.status(400).json({ error: 'Claude API key required' })
    }

    try {
        const profile = await analyzeUserProfile(apiKey, writingSamples, writingStyle)
        res.json({ profile })
    } catch (err) {
        console.error('Profile analysis error:', err)
        res.status(500).json({ error: 'Failed to analyze profile: ' + err.message })
    }
})

/**
 * POST /api/newsletters/recommendations
 * Generate personalized newsletter recommendations
 */
router.post('/newsletters/recommendations', async (req, res) => {
    const { apiKey } = req.body

    if (!apiKey) {
        return res.status(400).json({ error: 'Claude API key required' })
    }

    try {
        const recommendations = await generateRecommendations(apiKey)
        res.json({ recommendations })
    } catch (err) {
        console.error('Recommendations error:', err)
        res.status(500).json({ error: 'Failed to generate recommendations: ' + err.message })
    }
})

// ── Weekly Digest ─────────────────────────────────────────────

/**
 * GET /api/newsletters/digest/config
 * Get digest scheduler configuration
 */
router.get('/newsletters/digest/config', (req, res) => {
    res.json(getSchedulerConfig())
})

/**
 * POST /api/newsletters/digest/config
 * Update digest scheduler configuration
 */
router.post('/newsletters/digest/config', (req, res) => {
    try {
        const config = updateSchedulerConfig(req.body)
        res.json(config)
    } catch (err) {
        console.error('Digest config error:', err)
        res.status(500).json({ error: 'Failed to update digest config: ' + err.message })
    }
})

/**
 * POST /api/newsletters/digest/send
 * Send a digest email immediately
 */
router.post('/newsletters/digest/send', async (req, res) => {
    const { apiKey, recipientEmail } = req.body

    if (!apiKey) {
        return res.status(400).json({ error: 'Claude API key required' })
    }

    try {
        // Temporarily set the API key and recipient for this send
        updateSchedulerConfig({ apiKey, recipientEmail: recipientEmail || '' })
        const digest = await sendWeeklyDigest()
        res.json(digest)
    } catch (err) {
        console.error('Digest send error:', err)
        res.status(500).json({ error: 'Failed to send digest: ' + err.message })
    }
})

/**
 * POST /api/newsletters/digest/preview
 * Preview what the digest would look like
 */
router.post('/newsletters/digest/preview', async (req, res) => {
    const { apiKey } = req.body

    if (!apiKey) {
        return res.status(400).json({ error: 'Claude API key required' })
    }

    try {
        const preview = await previewDigest(apiKey)
        res.json(preview)
    } catch (err) {
        console.error('Digest preview error:', err)
        res.status(500).json({ error: 'Failed to preview digest: ' + err.message })
    }
})

/**
 * GET /api/newsletters/digest/history
 * Get past digest history
 */
router.get('/newsletters/digest/history', (req, res) => {
    const history = getDigestHistory()
    res.json(history)
})

export default router
