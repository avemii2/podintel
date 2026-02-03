/**
 * Claude AI Integration Service
 * Generates personalized podcast summaries using Claude API
 */

import Anthropic from '@anthropic-ai/sdk'

/**
 * Generate a personalized summary of a podcast episode
 * @param {string} apiKey - Claude API key
 * @param {Array} transcript - Array of transcript segments
 * @param {string} writingProfile - User's writing samples
 * @param {Object} options - Additional options
 * @param {string} options.writingStyle - User's general writing style preferences
 * @param {Object} options.brandTemplate - Selected brand template with tone, audience, description
 */
export async function generateSummary(apiKey, transcript, writingProfile = '', options = {}) {
    const client = new Anthropic({ apiKey })
    const { writingStyle = '', brandTemplate = null } = options

    const transcriptText = transcript
        .map(seg => seg.text)
        .join('\n\n')
        .slice(0, 50000) // Limit to fit context window

    // Build brand/tone instructions
    let brandInstructions = ''
    if (brandTemplate) {
        const toneDescriptions = {
            professional: 'professional, formal, and authoritative',
            conversational: 'conversational, friendly, and approachable',
            casual: 'casual, relaxed, and informal',
            inspirational: 'inspirational, motivating, and uplifting',
            educational: 'educational, informative, and teaching-oriented'
        }

        brandInstructions = `
BRAND & TONE TEMPLATE: "${brandTemplate.name}"
- Write in a ${toneDescriptions[brandTemplate.tone] || brandTemplate.tone} tone
${brandTemplate.audience ? `- Target audience: ${brandTemplate.audience}` : ''}
${brandTemplate.description ? `- Additional guidelines: ${brandTemplate.description}` : ''}

Apply this brand voice to all content suggestions and the overall summary style.
`
    }

    // Build writing style instructions
    let styleInstructions = ''
    if (writingStyle) {
        styleInstructions = `
USER'S WRITING STYLE PREFERENCES:
${writingStyle.slice(0, 2000)}

Apply these preferences to content ideas and suggestions.
`
    }

    const systemPrompt = `You are an expert podcast analyst helping a content creator identify valuable insights from podcast episodes. Your goal is to:

1. Extract key takeaways that would be valuable for someone building a professional brand
2. Identify how relevant this content is to the user's writing topics
3. Generate specific content ideas the user could create based on this episode
4. Find quotable moments that could be used in social media

${writingProfile ? `
The user's writing style and topics (from their LinkedIn posts):
---
${writingProfile.slice(0, 5000)}
---
Tailor your analysis to match their interests and writing style.
` : ''}
${brandInstructions}
${styleInstructions}
Be concise. Focus on actionable insights. Think like a content strategist.`

    const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
            {
                role: 'user',
                content: `Analyze this podcast transcript and provide a personalized summary:

TRANSCRIPT:
${transcriptText}

Respond in this exact JSON format:
{
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3", "takeaway 4", "takeaway 5"],
  "relevance": "A 2-3 sentence explanation of how this episode relates to the user's content interests",
  "relevanceLevel": "high" | "medium" | "low",
  "relevanceScore": 0-100,
  "contentIdeas": [
    {"title": "LinkedIn Post Title 1", "description": "Brief description of the post angle", "strength": 5, "strengthReason": "Why this matches the user's style/topics"},
    {"title": "LinkedIn Post Title 2", "description": "Brief description of the post angle", "strength": 4, "strengthReason": "Why this matches the user's style/topics"},
    {"title": "LinkedIn Post Title 3", "description": "Brief description of the post angle", "strength": 3, "strengthReason": "Why this matches the user's style/topics"},
    {"title": "LinkedIn Post Title 4", "description": "Brief description of the post angle", "strength": 2, "strengthReason": "Why this matches the user's style/topics"}
  ],
  "quotes": ["Notable quote 1", "Notable quote 2", "Notable quote 3"]
}`
            }
        ]
    })

    try {
        const content = message.content[0].text
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }
        throw new Error('No JSON found in response')
    } catch (err) {
        console.error('Failed to parse summary:', err)
        // Return a fallback structure
        return {
            keyTakeaways: ['Could not parse AI response - please try again'],
            relevance: 'Summary generation encountered an error',
            relevanceLevel: 'low',
            relevanceScore: 0,
            contentIdeas: [],
            quotes: []
        }
    }
}

/**
 * Calculate relevance score for an episode based on title/description
 */
export async function calculateRelevance(apiKey, episodeTitle, episodeDescription, writingProfile) {
    if (!writingProfile) return { score: 50, level: 'medium' }

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [
            {
                role: 'user',
                content: `Rate how relevant this podcast episode would be for a content creator with these interests:

User's content topics (from their writing):
${writingProfile.slice(0, 2000)}

Episode: ${episodeTitle}
${episodeDescription ? `Description: ${episodeDescription}` : ''}

Respond with ONLY a JSON object:
{"score": 0-100, "level": "high" | "medium" | "low"}`
            }
        ]
    })

    try {
        const content = message.content[0].text
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }
    } catch (err) {
        console.error('Relevance calculation error:', err)
    }

    return { score: 50, level: 'medium' }
}

/**
 * Analyze writing samples and generate a writing style description
 */
export async function analyzeWritingStyle(apiKey, writingSamples) {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
            {
                role: 'user',
                content: `Analyze the following writing samples and describe the writer's unique style. Focus on:

1. **Tone**: Is it formal, conversational, inspirational, educational, casual?
2. **Sentence structure**: Short and punchy? Long and flowing? Mix?
3. **Formatting preferences**: Use of bullet points, emojis, headers, questions?
4. **Voice characteristics**: First person? Direct? Storytelling? Data-driven?
5. **Common patterns**: Hook styles, closing techniques, paragraph structure
6. **Unique elements**: Any distinctive characteristics that make this writing recognizable

WRITING SAMPLES:
---
${writingSamples.slice(0, 8000)}
---

Provide a concise but comprehensive description (2-4 paragraphs) that can guide an AI to write in this person's voice. Focus on actionable writing instructions, not just observations.`
            }
        ]
    })

    try {
        return message.content[0].text
    } catch (err) {
        console.error('Failed to analyze writing style:', err)
        throw new Error('Failed to analyze writing style')
    }
}
