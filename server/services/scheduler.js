/**
 * Weekly Digest Scheduler Service
 * Schedules and sends weekly newsletter digest emails
 */

import cron from 'node-cron'
import nodemailer from 'nodemailer'
import { addDigest, getDigestHistory } from './newsletterStore.js'
import { generateRecommendations, formatDigestEmail } from './recommender.js'
import { getUserProfile } from './newsletterStore.js'

let scheduledTask = null
let digestConfig = {
    enabled: false,
    dayOfWeek: 1,         // 0=Sunday, 1=Monday, ...6=Saturday
    hour: 8,              // 8 AM
    minute: 0,
    recipientEmail: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    apiKey: ''            // Claude API key for generating recommendations
}

/**
 * Get current scheduler configuration
 */
export function getSchedulerConfig() {
    return {
        ...digestConfig,
        smtpPass: digestConfig.smtpPass ? '***' : '', // Don't expose password
        isRunning: !!scheduledTask,
        nextRun: getNextRunTime()
    }
}

/**
 * Update scheduler configuration and restart if needed
 */
export function updateSchedulerConfig(config) {
    const wasEnabled = digestConfig.enabled
    Object.assign(digestConfig, config)

    if (digestConfig.enabled && !wasEnabled) {
        startScheduler()
    } else if (!digestConfig.enabled && wasEnabled) {
        stopScheduler()
    } else if (digestConfig.enabled) {
        // Restart with new config
        stopScheduler()
        startScheduler()
    }

    return getSchedulerConfig()
}

/**
 * Start the weekly digest cron job
 */
export function startScheduler() {
    if (scheduledTask) {
        scheduledTask.stop()
    }

    const { dayOfWeek, hour, minute } = digestConfig
    // Cron format: minute hour * * dayOfWeek
    const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`

    scheduledTask = cron.schedule(cronExpression, async () => {
        console.log('Running weekly newsletter digest...')
        await sendWeeklyDigest()
    })

    console.log(`Digest scheduler started: ${cronExpression} (${getDayName(dayOfWeek)} at ${hour}:${String(minute).padStart(2, '0')})`)
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
    if (scheduledTask) {
        scheduledTask.stop()
        scheduledTask = null
        console.log('Digest scheduler stopped')
    }
}

/**
 * Send a weekly digest email immediately (also used by cron)
 */
export async function sendWeeklyDigest() {
    const { apiKey, recipientEmail, smtpHost, smtpPort, smtpUser, smtpPass } = digestConfig

    if (!apiKey) throw new Error('Claude API key required for digest generation')
    if (!recipientEmail) throw new Error('Recipient email required')

    // Generate recommendations
    const recommendations = await generateRecommendations(apiKey)
    const userProfile = getUserProfile()
    const emailBody = formatDigestEmail(recommendations, userProfile)

    const digest = {
        date: new Date().toISOString(),
        theme: recommendations.weeklyTheme,
        mustReadsCount: recommendations.mustReads?.length || 0,
        totalRecommendations:
            (recommendations.mustReads?.length || 0) +
            (recommendations.worthReading?.length || 0),
        recommendations,
        sentTo: recipientEmail,
        sentVia: smtpHost ? 'smtp' : 'gmail'
    }

    // Send via SMTP if configured
    if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass }
        })

        await transporter.sendMail({
            from: smtpUser,
            to: recipientEmail,
            subject: `Newsletter Digest: ${recommendations.weeklyTheme}`,
            text: emailBody
        })

        digest.delivered = true
    } else {
        // No SMTP - save digest for manual viewing / Gmail compose
        digest.delivered = false
        digest.gmailComposeUrl = buildGmailComposeUrl(
            recipientEmail,
            `Newsletter Digest: ${recommendations.weeklyTheme}`,
            emailBody
        )
    }

    // Save to history
    addDigest(digest)

    return digest
}

/**
 * Generate a preview of the weekly digest without sending
 */
export async function previewDigest(apiKey) {
    const recommendations = await generateRecommendations(apiKey)
    const userProfile = getUserProfile()
    const emailBody = formatDigestEmail(recommendations, userProfile)

    return {
        recommendations,
        emailBody,
        previewDate: new Date().toISOString()
    }
}

/**
 * Build a Gmail compose URL for the digest
 */
function buildGmailComposeUrl(to, subject, body) {
    const params = new URLSearchParams({
        view: 'cm',
        fs: '1',
        to,
        su: subject,
        body
    })
    return `https://mail.google.com/mail/?${params.toString()}`
}

/**
 * Get the next scheduled run time
 */
function getNextRunTime() {
    if (!digestConfig.enabled) return null

    const now = new Date()
    const next = new Date()
    next.setHours(digestConfig.hour, digestConfig.minute, 0, 0)

    // Find next occurrence of the target day
    const currentDay = now.getDay()
    let daysUntil = digestConfig.dayOfWeek - currentDay
    if (daysUntil < 0 || (daysUntil === 0 && now > next)) {
        daysUntil += 7
    }
    next.setDate(next.getDate() + daysUntil)

    return next.toISOString()
}

/**
 * Get day name from number
 */
function getDayName(day) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[day] || 'Unknown'
}
