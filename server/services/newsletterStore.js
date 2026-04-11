/**
 * Newsletter Data Store
 * JSON file-based persistence for newsletter data, engagement tracking, and user profile
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')
const newslettersFile = join(dataDir, 'newsletters.json')
const userProfileFile = join(dataDir, 'user-profile.json')
const digestHistoryFile = join(dataDir, 'digest-history.json')

let newsletters = {
    senders: {},        // keyed by sender email: { name, email, category, subcategory, firstSeen, lastSeen }
    emails: [],         // all newsletter emails: { id, sender, subject, date, isRead, isClicked, snippet, labels }
    categories: {},     // category -> count mapping
    lastScanAt: null,
    gmailTokens: null   // OAuth2 tokens for Gmail
}

let userProfile = {
    interests: [],      // extracted user interests
    writingTopics: [],  // topics from writing samples
    profileSummary: '', // AI-generated profile summary
    lastAnalyzedAt: null
}

let digestHistory = {
    digests: [],        // past weekly digests sent
    lastSentAt: null,
    recipientEmail: ''
}

export function initNewsletterStore() {
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true })
    }

    if (existsSync(newslettersFile)) {
        try {
            newsletters = JSON.parse(readFileSync(newslettersFile, 'utf-8'))
        } catch { newsletters = { senders: {}, emails: [], categories: {}, lastScanAt: null, gmailTokens: null } }
    }

    if (existsSync(userProfileFile)) {
        try {
            userProfile = JSON.parse(readFileSync(userProfileFile, 'utf-8'))
        } catch { userProfile = { interests: [], writingTopics: [], profileSummary: '', lastAnalyzedAt: null } }
    }

    if (existsSync(digestHistoryFile)) {
        try {
            digestHistory = JSON.parse(readFileSync(digestHistoryFile, 'utf-8'))
        } catch { digestHistory = { digests: [], lastSentAt: null, recipientEmail: '' } }
    }

    console.log('📬 Newsletter store initialized')
}

function saveNewsletters() {
    writeFileSync(newslettersFile, JSON.stringify(newsletters, null, 2))
}

function saveUserProfile() {
    writeFileSync(userProfileFile, JSON.stringify(userProfile, null, 2))
}

function saveDigestHistory() {
    writeFileSync(digestHistoryFile, JSON.stringify(digestHistory, null, 2))
}

// ── Gmail Tokens ──────────────────────────────────────────────

export function getGmailTokens() {
    return newsletters.gmailTokens
}

export function saveGmailTokens(tokens) {
    newsletters.gmailTokens = tokens
    saveNewsletters()
}

export function clearGmailTokens() {
    newsletters.gmailTokens = null
    saveNewsletters()
}

// ── Newsletter Senders ────────────────────────────────────────

export function getSenders() {
    return newsletters.senders
}

export function upsertSender(email, data) {
    const existing = newsletters.senders[email] || {}
    newsletters.senders[email] = {
        ...existing,
        ...data,
        email,
        firstSeen: existing.firstSeen || Date.now(),
        lastSeen: Date.now()
    }
    saveNewsletters()
    return newsletters.senders[email]
}

export function updateSenderCategory(email, category, subcategory = '') {
    if (newsletters.senders[email]) {
        newsletters.senders[email].category = category
        newsletters.senders[email].subcategory = subcategory
        saveNewsletters()
    }
}

// ── Newsletter Emails ─────────────────────────────────────────

export function getEmails() {
    return newsletters.emails
}

export function addEmails(newEmails) {
    const existingIds = new Set(newsletters.emails.map(e => e.id))
    const toAdd = newEmails.filter(e => !existingIds.has(e.id))
    newsletters.emails.push(...toAdd)

    // Keep most recent 5000 emails to prevent unbounded growth
    if (newsletters.emails.length > 5000) {
        newsletters.emails = newsletters.emails
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5000)
    }

    saveNewsletters()
    return toAdd.length
}

export function updateEmailEngagement(emailId, updates) {
    const email = newsletters.emails.find(e => e.id === emailId)
    if (email) {
        Object.assign(email, updates)
        saveNewsletters()
    }
}

export function getLastScanAt() {
    return newsletters.lastScanAt
}

export function setLastScanAt(timestamp) {
    newsletters.lastScanAt = timestamp
    saveNewsletters()
}

// ── Categories ────────────────────────────────────────────────

export function getCategories() {
    return newsletters.categories
}

export function setCategories(cats) {
    newsletters.categories = cats
    saveNewsletters()
}

// ── Engagement Analytics ──────────────────────────────────────

export function getEngagementStats() {
    const senderStats = {}

    for (const email of newsletters.emails) {
        const sender = email.sender
        if (!senderStats[sender]) {
            senderStats[sender] = {
                sender,
                senderName: newsletters.senders[sender]?.name || sender,
                category: newsletters.senders[sender]?.category || 'Uncategorized',
                totalReceived: 0,
                totalRead: 0,
                totalClicked: 0,
                recentEmails: []
            }
        }
        senderStats[sender].totalReceived++
        if (email.isRead) senderStats[sender].totalRead++
        if (email.isClicked) senderStats[sender].totalClicked++
        senderStats[sender].recentEmails.push({
            subject: email.subject,
            date: email.date,
            isRead: email.isRead,
            isClicked: email.isClicked
        })
    }

    // Calculate rates and sort recent emails
    for (const stats of Object.values(senderStats)) {
        stats.openRate = stats.totalReceived > 0
            ? Math.round((stats.totalRead / stats.totalReceived) * 100)
            : 0
        stats.clickRate = stats.totalReceived > 0
            ? Math.round((stats.totalClicked / stats.totalReceived) * 100)
            : 0
        stats.engagementScore = Math.round(
            (stats.openRate * 0.6) + (stats.clickRate * 0.4)
        )
        stats.recentEmails = stats.recentEmails
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10)
    }

    return Object.values(senderStats)
        .sort((a, b) => b.engagementScore - a.engagementScore)
}

export function getOverviewStats() {
    const totalEmails = newsletters.emails.length
    const totalRead = newsletters.emails.filter(e => e.isRead).length
    const totalClicked = newsletters.emails.filter(e => e.isClicked).length
    const totalSenders = Object.keys(newsletters.senders).length
    const totalCategories = Object.keys(newsletters.categories).length

    return {
        totalEmails,
        totalRead,
        totalClicked,
        totalSenders,
        totalCategories,
        overallOpenRate: totalEmails > 0 ? Math.round((totalRead / totalEmails) * 100) : 0,
        overallClickRate: totalEmails > 0 ? Math.round((totalClicked / totalEmails) * 100) : 0,
        lastScanAt: newsletters.lastScanAt
    }
}

// ── User Profile ──────────────────────────────────────────────

export function getUserProfile() {
    return userProfile
}

export function updateUserProfile(updates) {
    Object.assign(userProfile, updates, { lastAnalyzedAt: Date.now() })
    saveUserProfile()
}

// ── Digest History ────────────────────────────────────────────

export function getDigestHistory() {
    return digestHistory
}

export function addDigest(digest) {
    digestHistory.digests.unshift(digest)
    if (digestHistory.digests.length > 52) {
        digestHistory.digests = digestHistory.digests.slice(0, 52)
    }
    digestHistory.lastSentAt = Date.now()
    saveDigestHistory()
}

export function updateDigestSettings(settings) {
    Object.assign(digestHistory, settings)
    saveDigestHistory()
}
