/**
 * Newsletter Detection, Categorization, and Analysis Service
 * Uses Claude AI to categorize newsletters and analyze engagement patterns
 */

import Anthropic from '@anthropic-ai/sdk'
import {
    getSenders, updateSenderCategory, getEmails,
    getEngagementStats, setCategories
} from './newsletterStore.js'

/**
 * Categorize all uncategorized newsletter senders using Claude AI
 */
export async function categorizeNewsletters(apiKey) {
    const client = new Anthropic({ apiKey })
    const senders = getSenders()
    const emails = getEmails()

    // Find uncategorized senders
    const uncategorized = Object.entries(senders)
        .filter(([_, s]) => !s.category)
        .map(([email, s]) => {
            // Get recent subjects for context
            const recentSubjects = emails
                .filter(e => e.sender === email)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5)
                .map(e => e.subject)

            return { email, name: s.name, subjects: recentSubjects }
        })

    if (uncategorized.length === 0) return { categorized: 0 }

    // Batch categorize (up to 50 at a time)
    const batchSize = 50
    let totalCategorized = 0

    for (let i = 0; i < uncategorized.length; i += batchSize) {
        const batch = uncategorized.slice(i, i + batchSize)

        const senderList = batch.map((s, idx) =>
            `${idx + 1}. "${s.name}" <${s.email}>\n   Recent subjects: ${s.subjects.join(' | ') || 'none'}`
        ).join('\n')

        const message = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{
                role: 'user',
                content: `Categorize these newsletter senders into categories. For each sender, provide a primary category and optional subcategory.

Categories to choose from:
- Technology (subcategories: AI/ML, Software Engineering, Startups, Product, DevOps, Security)
- Business (subcategories: Finance, Entrepreneurship, Marketing, Leadership, Strategy)
- Personal Development (subcategories: Productivity, Career, Health, Mindset, Learning)
- News & Media (subcategories: World News, Industry News, Science, Politics)
- Creative (subcategories: Design, Writing, Photography, Art)
- Lifestyle (subcategories: Travel, Food, Fitness, Entertainment)
- Other (subcategory: describe it)

NEWSLETTER SENDERS:
${senderList}

Respond in this exact JSON format:
{
  "results": [
    {"email": "sender@example.com", "category": "Technology", "subcategory": "AI/ML"},
    ...
  ]
}`
            }]
        })

        try {
            const content = message.content[0].text
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                for (const result of parsed.results) {
                    updateSenderCategory(result.email, result.category, result.subcategory || '')
                    totalCategorized++
                }
            }
        } catch (err) {
            console.error('Failed to parse categorization response:', err)
        }
    }

    // Update category summary
    rebuildCategorySummary()

    return { categorized: totalCategorized }
}

/**
 * Rebuild the category summary counts
 */
export function rebuildCategorySummary() {
    const senders = getSenders()
    const categories = {}

    for (const sender of Object.values(senders)) {
        if (sender.category) {
            if (!categories[sender.category]) {
                categories[sender.category] = {
                    count: 0,
                    subcategories: {}
                }
            }
            categories[sender.category].count++
            if (sender.subcategory) {
                categories[sender.category].subcategories[sender.subcategory] =
                    (categories[sender.category].subcategories[sender.subcategory] || 0) + 1
            }
        }
    }

    setCategories(categories)
    return categories
}

/**
 * Get a ranked list of newsletters by engagement
 */
export function getRankedNewsletters() {
    const stats = getEngagementStats()

    return stats.map(s => ({
        ...s,
        rank: null, // Will be set by position
        trend: calculateTrend(s.recentEmails)
    }))
}

/**
 * Calculate engagement trend (improving, stable, declining)
 */
function calculateTrend(recentEmails) {
    if (recentEmails.length < 4) return 'insufficient_data'

    const half = Math.floor(recentEmails.length / 2)
    const recent = recentEmails.slice(0, half)
    const older = recentEmails.slice(half)

    const recentRate = recent.filter(e => e.isRead).length / recent.length
    const olderRate = older.filter(e => e.isRead).length / older.length

    const diff = recentRate - olderRate
    if (diff > 0.15) return 'improving'
    if (diff < -0.15) return 'declining'
    return 'stable'
}

/**
 * Get newsletter insights summary using Claude
 */
export async function generateInsights(apiKey) {
    const client = new Anthropic({ apiKey })
    const stats = getEngagementStats()
    const senders = getSenders()

    if (stats.length === 0) {
        return { summary: 'No newsletter data available yet. Scan your email first.' }
    }

    // Build stats summary for Claude
    const topEngaged = stats.slice(0, 10)
    const leastEngaged = stats.slice(-5).reverse()
    const categories = rebuildCategorySummary()

    const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
            role: 'user',
            content: `Analyze these newsletter engagement patterns and provide insights:

TOP ENGAGED NEWSLETTERS (highest open/click rates):
${topEngaged.map(s => `- "${s.senderName}" (${s.category || 'uncategorized'}): ${s.openRate}% open rate, ${s.clickRate}% click rate, ${s.totalReceived} emails`).join('\n')}

LEAST ENGAGED NEWSLETTERS (lowest engagement):
${leastEngaged.map(s => `- "${s.senderName}" (${s.category || 'uncategorized'}): ${s.openRate}% open rate, ${s.totalReceived} emails`).join('\n')}

CATEGORIES:
${Object.entries(categories).map(([cat, info]) => `- ${cat}: ${info.count} newsletters`).join('\n')}

TOTAL: ${stats.length} newsletters, averaging ${Math.round(stats.reduce((sum, s) => sum + s.openRate, 0) / stats.length)}% open rate

Respond in JSON:
{
  "summary": "2-3 sentence overview of their newsletter habits",
  "topInterests": ["interest1", "interest2", "interest3"],
  "recommendations": [
    "recommendation about what to keep/unsubscribe/read more",
    ...
  ],
  "timeManagement": "suggestion about managing newsletter volume",
  "unsubscribeSuggestions": ["newsletter names they rarely engage with"]
}`
        }]
    })

    try {
        const content = message.content[0].text
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }
    } catch (err) {
        console.error('Failed to parse insights:', err)
    }

    return { summary: 'Failed to generate insights. Please try again.' }
}
