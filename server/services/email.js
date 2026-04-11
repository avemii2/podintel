/**
 * Gmail API Email Connector Service
 * Handles OAuth2 authentication and email scanning for newsletters
 */

import { google } from 'googleapis'
import {
    getGmailTokens, saveGmailTokens, clearGmailTokens,
    addEmails, upsertSender, setLastScanAt
} from './newsletterStore.js'

let oauth2Client = null

/**
 * Initialize OAuth2 client with credentials
 */
export function initGmailAuth(clientId, clientSecret, redirectUri) {
    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    // Restore saved tokens if they exist
    const savedTokens = getGmailTokens()
    if (savedTokens) {
        oauth2Client.setCredentials(savedTokens)
    }

    // Auto-refresh tokens
    oauth2Client.on('tokens', (tokens) => {
        const current = getGmailTokens() || {}
        const merged = { ...current, ...tokens }
        saveGmailTokens(merged)
        oauth2Client.setCredentials(merged)
    })

    return oauth2Client
}

/**
 * Get the OAuth2 authorization URL for the user to visit
 */
export function getAuthUrl() {
    if (!oauth2Client) throw new Error('Gmail auth not initialized')

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.email'
        ]
    })
}

/**
 * Exchange authorization code for tokens
 */
export async function handleAuthCallback(code) {
    if (!oauth2Client) throw new Error('Gmail auth not initialized')

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    saveGmailTokens(tokens)

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data } = await oauth2.userinfo.get()

    return { email: data.email, name: data.name }
}

/**
 * Check if we have a valid Gmail connection
 */
export function isGmailConnected() {
    const tokens = getGmailTokens()
    return !!(tokens && tokens.access_token)
}

/**
 * Disconnect Gmail (clear tokens)
 */
export function disconnectGmail() {
    clearGmailTokens()
    if (oauth2Client) {
        oauth2Client.setCredentials({})
    }
}

/**
 * Scan Gmail for newsletter emails
 * Looks for emails with "unsubscribe" headers or common newsletter patterns
 */
export async function scanNewsletters(options = {}) {
    if (!oauth2Client) throw new Error('Gmail auth not initialized')
    if (!isGmailConnected()) throw new Error('Gmail not connected')

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const { maxResults = 200, daysBack = 90 } = options

    // Calculate date filter
    const afterDate = new Date()
    afterDate.setDate(afterDate.getDate() - daysBack)
    const afterStr = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`

    // Search for newsletter-like emails
    // Gmail filters: has "unsubscribe" header OR common newsletter patterns
    const query = `after:${afterStr} (list:* OR "unsubscribe" OR label:newsletters)`

    let allMessages = []
    let pageToken = null

    // Paginate through results
    do {
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: Math.min(maxResults - allMessages.length, 100),
            pageToken
        })

        if (response.data.messages) {
            allMessages.push(...response.data.messages)
        }
        pageToken = response.data.nextPageToken
    } while (pageToken && allMessages.length < maxResults)

    console.log(`Found ${allMessages.length} potential newsletter emails`)

    // Fetch details for each message (batch in groups of 20)
    const newsletterEmails = []
    const batchSize = 20

    for (let i = 0; i < allMessages.length; i += batchSize) {
        const batch = allMessages.slice(i, i + batchSize)
        const details = await Promise.all(
            batch.map(msg => fetchMessageDetails(gmail, msg.id))
        )

        for (const detail of details) {
            if (detail && isNewsletter(detail)) {
                const senderEmail = extractEmail(detail.from)
                const senderName = extractName(detail.from)

                // Track the sender
                upsertSender(senderEmail, {
                    name: senderName,
                    lastSubject: detail.subject
                })

                newsletterEmails.push({
                    id: detail.id,
                    sender: senderEmail,
                    senderName,
                    subject: detail.subject,
                    date: detail.date,
                    isRead: !detail.labelIds?.includes('UNREAD'),
                    isClicked: detail.labelIds?.includes('OPENED') || !detail.labelIds?.includes('UNREAD'),
                    snippet: detail.snippet,
                    labels: detail.labelIds || []
                })
            }
        }
    }

    // Save to store
    const newCount = addEmails(newsletterEmails)
    setLastScanAt(Date.now())

    return {
        totalScanned: allMessages.length,
        newslettersFound: newsletterEmails.length,
        newAdded: newCount
    }
}

/**
 * Fetch full message details from Gmail
 */
async function fetchMessageDetails(gmail, messageId) {
    try {
        const response = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Id']
        })

        const headers = response.data.payload?.headers || []
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

        return {
            id: response.data.id,
            from: getHeader('From') || '',
            subject: getHeader('Subject') || '',
            date: getHeader('Date') || '',
            listUnsubscribe: getHeader('List-Unsubscribe'),
            listId: getHeader('List-Id'),
            snippet: response.data.snippet || '',
            labelIds: response.data.labelIds || []
        }
    } catch (err) {
        console.error(`Failed to fetch message ${messageId}:`, err.message)
        return null
    }
}

/**
 * Determine if an email is a newsletter
 */
function isNewsletter(detail) {
    // Has List-Unsubscribe header = almost certainly a newsletter/mailing list
    if (detail.listUnsubscribe) return true

    // Has List-Id header = mailing list
    if (detail.listId) return true

    // Check for common newsletter patterns in sender
    const from = detail.from.toLowerCase()
    const newsletterPatterns = [
        'newsletter', 'digest', 'weekly', 'daily', 'update',
        'noreply', 'no-reply', 'news@', 'hello@', 'team@',
        'substack', 'beehiiv', 'convertkit', 'mailchimp',
        'buttondown', 'revue', 'ghost', 'email.mg',
        'sendgrid', 'mandrillapp', 'mailgun'
    ]

    if (newsletterPatterns.some(p => from.includes(p))) return true

    // Check subject for newsletter patterns
    const subject = detail.subject.toLowerCase()
    const subjectPatterns = [
        'newsletter', 'digest', 'weekly', 'issue #', 'issue:', 'edition',
        'roundup', 'briefing', 'update:', 'this week'
    ]

    return subjectPatterns.some(p => subject.includes(p))
}

/**
 * Extract email address from "Name <email>" format
 */
function extractEmail(from) {
    const match = from.match(/<([^>]+)>/)
    return match ? match[1].toLowerCase() : from.toLowerCase().trim()
}

/**
 * Extract display name from "Name <email>" format
 */
function extractName(from) {
    const match = from.match(/^"?([^"<]+)"?\s*</)
    return match ? match[1].trim() : from.split('@')[0]
}

/**
 * Get recent newsletter content for recommendation purposes
 * Fetches the text content of recent unread newsletters
 */
export async function getRecentNewsletterContent(senderEmails = [], maxPerSender = 3) {
    if (!oauth2Client || !isGmailConnected()) return []

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const results = []

    for (const senderEmail of senderEmails.slice(0, 10)) {
        try {
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: `from:${senderEmail} newer_than:14d`,
                maxResults: maxPerSender
            })

            if (!response.data.messages) continue

            for (const msg of response.data.messages) {
                try {
                    const detail = await gmail.users.messages.get({
                        userId: 'me',
                        id: msg.id,
                        format: 'full'
                    })

                    const text = extractTextContent(detail.data.payload)
                    if (text) {
                        const headers = detail.data.payload?.headers || []
                        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value

                        results.push({
                            sender: senderEmail,
                            subject: getHeader('Subject') || '',
                            date: getHeader('Date') || '',
                            content: text.slice(0, 3000) // Limit content size
                        })
                    }
                } catch (err) {
                    console.error(`Failed to get content for ${msg.id}:`, err.message)
                }
            }
        } catch (err) {
            console.error(`Failed to list emails from ${senderEmail}:`, err.message)
        }
    }

    return results
}

/**
 * Extract text content from Gmail message payload
 */
function extractTextContent(payload) {
    if (!payload) return ''

    // Direct text/plain body
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8')
    }

    // Check parts recursively
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8')
            }
            if (part.parts) {
                const nested = extractTextContent(part)
                if (nested) return nested
            }
        }
        // Fall back to HTML if no plain text
        for (const part of payload.parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
                const html = Buffer.from(part.body.data, 'base64').toString('utf-8')
                return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            }
        }
    }

    return ''
}
