/**
 * Newsletter Recommendation Engine
 * Uses Claude AI to generate personalized newsletter/article recommendations
 * based on user profile, engagement patterns, and newsletter content
 */

import Anthropic from '@anthropic-ai/sdk'
import {
    getEngagementStats, getUserProfile, updateUserProfile,
    getSenders, getEmails
} from './newsletterStore.js'
import { getRecentNewsletterContent } from './email.js'

/**
 * Analyze the user's profile from their writing samples and newsletter engagement
 * Builds a comprehensive understanding of who they are and what they care about
 */
export async function analyzeUserProfile(apiKey, writingSamples = '', writingStyle = '') {
    const client = new Anthropic({ apiKey })
    const stats = getEngagementStats()

    // Build engagement context
    const topNewsletters = stats
        .filter(s => s.openRate > 50)
        .slice(0, 15)
        .map(s => `- "${s.senderName}" (${s.category || 'unknown'}): ${s.openRate}% open rate`)
        .join('\n')

    const categoryBreakdown = {}
    for (const s of stats) {
        if (s.category) {
            categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + s.totalRead
        }
    }
    const topCategories = Object.entries(categoryBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, count]) => `- ${cat}: ${count} emails read`)
        .join('\n')

    const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
            role: 'user',
            content: `Build a comprehensive reader profile based on the following data:

${writingSamples ? `WRITING SAMPLES (what this person writes about):
${writingSamples.slice(0, 4000)}
` : ''}
${writingStyle ? `WRITING STYLE ANALYSIS:
${writingStyle.slice(0, 1000)}
` : ''}
${topNewsletters ? `TOP NEWSLETTERS (highest engagement):
${topNewsletters}
` : ''}
${topCategories ? `READING CATEGORIES (by volume):
${topCategories}
` : ''}

Based on this data, create a reader profile. Respond in JSON:
{
  "profileSummary": "2-3 paragraph description of who this person is, what they care about, their professional focus, and intellectual interests",
  "interests": ["interest1", "interest2", ...],
  "writingTopics": ["topic1", "topic2", ...],
  "preferredCategories": ["category1", "category2", ...],
  "readingGoals": ["what kind of content would benefit them most"],
  "blindSpots": ["topics they should explore more based on their interests"]
}`
        }]
    })

    try {
        const content = message.content[0].text
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const profile = JSON.parse(jsonMatch[0])
            updateUserProfile(profile)
            return profile
        }
    } catch (err) {
        console.error('Failed to parse user profile:', err)
    }

    return { profileSummary: 'Failed to analyze profile. Please try again.' }
}

/**
 * Generate weekly newsletter recommendations
 * Picks the best content based on user profile and engagement patterns
 */
export async function generateRecommendations(apiKey) {
    const client = new Anthropic({ apiKey })
    const userProfile = getUserProfile()
    const stats = getEngagementStats()
    const emails = getEmails()

    // Get recent unread newsletters from high-engagement senders
    const highEngagementSenders = stats
        .filter(s => s.engagementScore > 30)
        .map(s => s.sender)

    // Get recent emails (last 7 days) sorted by relevance signals
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const recentEmails = emails
        .filter(e => new Date(e.date) > oneWeekAgo)
        .sort((a, b) => {
            // Prioritize: high-engagement sender + unread
            const aScore = (highEngagementSenders.includes(a.sender) ? 10 : 0) + (!a.isRead ? 5 : 0)
            const bScore = (highEngagementSenders.includes(b.sender) ? 10 : 0) + (!b.isRead ? 5 : 0)
            return bScore - aScore
        })
        .slice(0, 30)

    // Try to get actual content from top senders
    let contentSamples = []
    try {
        const topSenderEmails = [...new Set(recentEmails.map(e => e.sender))].slice(0, 5)
        contentSamples = await getRecentNewsletterContent(topSenderEmails, 2)
    } catch (err) {
        console.error('Could not fetch newsletter content:', err.message)
    }

    // Build recommendation context
    const emailList = recentEmails.map(e => {
        const sender = getSenders()[e.sender]
        return `- "${e.subject}" by ${e.senderName} (${sender?.category || 'unknown'}) [${e.isRead ? 'read' : 'unread'}]`
    }).join('\n')

    const contentContext = contentSamples.length > 0
        ? `\nNEWSLETTER CONTENT SAMPLES:\n${contentSamples.map(c =>
            `--- ${c.subject} by ${c.sender} ---\n${c.content.slice(0, 1500)}\n`
        ).join('\n')}`
        : ''

    const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{
            role: 'user',
            content: `You are a personal newsletter curator. Based on this reader's profile and recent newsletters, recommend which articles/newsletters they should read this week.

READER PROFILE:
${userProfile.profileSummary || 'No profile available'}

INTERESTS: ${(userProfile.interests || []).join(', ')}
WRITING TOPICS: ${(userProfile.writingTopics || []).join(', ')}

RECENT NEWSLETTERS (last 7 days):
${emailList}
${contentContext}

Generate a curated weekly digest with recommendations. Respond in JSON:
{
  "weeklyTheme": "A catchy theme for this week's digest",
  "mustReads": [
    {
      "subject": "exact newsletter subject line",
      "sender": "sender name",
      "reason": "why this is a must-read for them",
      "relevanceScore": 90,
      "category": "category"
    }
  ],
  "worthReading": [
    {
      "subject": "newsletter subject",
      "sender": "sender name",
      "reason": "brief reason",
      "relevanceScore": 70,
      "category": "category"
    }
  ],
  "skipThisWeek": [
    {
      "subject": "newsletter subject",
      "sender": "sender name",
      "reason": "why they can skip this one"
    }
  ],
  "newDiscoveries": [
    {
      "suggestion": "A newsletter or topic they should explore",
      "reason": "why it fits their interests"
    }
  ],
  "contentIdeas": [
    {
      "title": "Content idea inspired by this week's newsletters",
      "description": "Brief description",
      "inspiredBy": "which newsletter(s) inspired this"
    }
  ],
  "weeklyInsight": "A key theme or insight that connects multiple newsletters this week"
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
        console.error('Failed to parse recommendations:', err)
    }

    return {
        weeklyTheme: 'Your Weekly Newsletter Digest',
        mustReads: [],
        worthReading: [],
        skipThisWeek: [],
        newDiscoveries: [],
        contentIdeas: [],
        weeklyInsight: 'Unable to generate recommendations. Please try again.'
    }
}

/**
 * Generate a formatted weekly digest email body
 */
export function formatDigestEmail(recommendations, userProfile) {
    const { weeklyTheme, mustReads, worthReading, skipThisWeek, newDiscoveries, contentIdeas, weeklyInsight } = recommendations

    let body = `WEEKLY NEWSLETTER DIGEST\n`
    body += `${weeklyTheme}\n`
    body += `${'='.repeat(50)}\n\n`

    if (weeklyInsight) {
        body += `THIS WEEK'S INSIGHT\n${weeklyInsight}\n\n`
    }

    if (mustReads?.length > 0) {
        body += `MUST READS\n${'-'.repeat(30)}\n`
        for (const item of mustReads) {
            body += `[${item.relevanceScore}% match] "${item.subject}" - ${item.sender}\n`
            body += `  Why: ${item.reason}\n\n`
        }
    }

    if (worthReading?.length > 0) {
        body += `WORTH READING\n${'-'.repeat(30)}\n`
        for (const item of worthReading) {
            body += `[${item.relevanceScore}% match] "${item.subject}" - ${item.sender}\n`
            body += `  ${item.reason}\n\n`
        }
    }

    if (skipThisWeek?.length > 0) {
        body += `SKIP THIS WEEK\n${'-'.repeat(30)}\n`
        for (const item of skipThisWeek) {
            body += `"${item.subject}" - ${item.sender}: ${item.reason}\n`
        }
        body += '\n'
    }

    if (newDiscoveries?.length > 0) {
        body += `EXPLORE THESE\n${'-'.repeat(30)}\n`
        for (const item of newDiscoveries) {
            body += `${item.suggestion}\n  ${item.reason}\n\n`
        }
    }

    if (contentIdeas?.length > 0) {
        body += `CONTENT IDEAS (inspired by this week's reading)\n${'-'.repeat(30)}\n`
        for (const item of contentIdeas) {
            body += `"${item.title}"\n  ${item.description}\n  Inspired by: ${item.inspiredBy}\n\n`
        }
    }

    body += `\n${'='.repeat(50)}\n`
    body += `Generated by PodIntel Newsletter Analyzer\n`

    return body
}
