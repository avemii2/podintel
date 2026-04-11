import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import podcastRoutes from './routes/podcasts.js'
import newsletterRoutes from './routes/newsletters.js'
import { initDb } from './services/cache.js'
import { initNewsletterStore } from './services/newsletterStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Initialize databases
initDb()
initNewsletterStore()

// API Routes
app.use('/api', podcastRoutes)
app.use('/api', newsletterRoutes)

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err)
    res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
    console.log(`🚀 PodIntel server running on http://localhost:${PORT}`)
    console.log(`📬 Newsletter analyzer ready at /api/newsletters`)
})
