/**
 * Newsletter Analyzer & Recommender - Frontend Pages
 * Dashboard, Rankings, Recommendations, and Digest management
 */

import { useState, useEffect } from 'react'
import { useApp } from './App'

// API helper
const api = {
    async get(endpoint) {
        const res = await fetch(`/api${endpoint}`)
        if (!res.ok) throw new Error(`API Error: ${res.status}`)
        return res.json()
    },
    async post(endpoint, data) {
        const res = await fetch(`/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        if (!res.ok) throw new Error(`API Error: ${res.status}`)
        return res.json()
    }
}

// ── Gmail Connection Component ────────────────────────────────

function GmailConnect({ onConnected }) {
    const { profile } = useApp()
    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [connected, setConnected] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        api.get('/newsletters/gmail/status')
            .then(data => {
                setConnected(data.connected)
                if (data.connected && onConnected) onConnected()
            })
            .catch(() => {})
            .finally(() => setLoading(false))

        // Check URL params for OAuth callback
        const params = new URLSearchParams(window.location.search)
        if (params.get('gmail_connected') === 'true') {
            setConnected(true)
            if (onConnected) onConnected()
            window.history.replaceState({}, '', window.location.pathname)
        }
        if (params.get('gmail_error')) {
            setError(params.get('gmail_error'))
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [])

    const handleConnect = async () => {
        if (!clientId.trim() || !clientSecret.trim()) {
            setError('Please enter your Google OAuth credentials')
            return
        }
        setError('')
        setLoading(true)

        try {
            const data = await api.post('/newsletters/gmail/init', {
                clientId: clientId.trim(),
                clientSecret: clientSecret.trim(),
                redirectUri: `${window.location.origin}/api/newsletters/gmail/callback`
            })
            // Redirect to Google OAuth
            window.location.href = data.authUrl
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }

    const handleDisconnect = async () => {
        await api.post('/newsletters/gmail/disconnect')
        setConnected(false)
    }

    if (loading) {
        return <div className="card"><p>Checking Gmail connection...</p></div>
    }

    if (connected) {
        return (
            <div className="card gmail-connected">
                <div className="flex items-center gap-md">
                    <span style={{ fontSize: '2rem' }}>&#9989;</span>
                    <div style={{ flex: 1 }}>
                        <strong>Gmail Connected</strong>
                        <p style={{ color: 'var(--text-tertiary)', margin: 0 }}>Ready to scan your newsletters</p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={handleDisconnect}>Disconnect</button>
                </div>
            </div>
        )
    }

    return (
        <div className="card">
            <h3>Connect Gmail</h3>
            <p>Connect your Gmail account to scan for newsletters. We only request read-only access.</p>

            <div className="form-group">
                <label className="form-label">Google OAuth Client ID</label>
                <input
                    type="text"
                    className="input"
                    placeholder="your-client-id.apps.googleusercontent.com"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label className="form-label">Google OAuth Client Secret</label>
                <input
                    type="password"
                    className="input"
                    placeholder="GOCSPX-..."
                    value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)}
                />
                <p className="form-helper">
                    Create OAuth credentials at{' '}
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
                        Google Cloud Console
                    </a>
                    . Enable the Gmail API and add {window.location.origin}/api/newsletters/gmail/callback as an authorized redirect URI.
                </p>
            </div>

            {error && <div className="alert alert-error mb-md">{error}</div>}

            <button className="btn btn-primary" onClick={handleConnect}>
                Connect Gmail Account
            </button>
        </div>
    )
}

// ── Newsletter Dashboard ──────────────────────────────────────

export function NewsletterDashboard() {
    const { profile } = useApp()
    const [overview, setOverview] = useState(null)
    const [gmailConnected, setGmailConnected] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [categorizing, setCategorizing] = useState(false)
    const [scanResult, setScanResult] = useState(null)
    const [insights, setInsights] = useState(null)
    const [loadingInsights, setLoadingInsights] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')

    const loadOverview = async () => {
        try {
            const data = await api.get('/newsletters/overview')
            setOverview(data)
        } catch (err) {
            console.error('Overview error:', err)
        }
    }

    useEffect(() => {
        loadOverview()
    }, [])

    const handleScan = async () => {
        setScanning(true)
        setScanResult(null)
        try {
            const result = await api.post('/newsletters/scan', { maxResults: 300, daysBack: 90 })
            setScanResult(result)
            await loadOverview()
        } catch (err) {
            setScanResult({ error: err.message })
        } finally {
            setScanning(false)
        }
    }

    const handleCategorize = async () => {
        if (!profile?.apiKey) {
            alert('Please set your Claude API key in Settings first')
            return
        }
        setCategorizing(true)
        try {
            await api.post('/newsletters/categorize', { apiKey: profile.apiKey })
            await loadOverview()
        } catch (err) {
            alert('Categorization failed: ' + err.message)
        } finally {
            setCategorizing(false)
        }
    }

    const handleGenerateInsights = async () => {
        if (!profile?.apiKey) {
            alert('Please set your Claude API key in Settings first')
            return
        }
        setLoadingInsights(true)
        try {
            const data = await api.post('/newsletters/insights', { apiKey: profile.apiKey })
            setInsights(data)
        } catch (err) {
            alert('Failed to generate insights: ' + err.message)
        } finally {
            setLoadingInsights(false)
        }
    }

    return (
        <div className="page container">
            <div className="section-header">
                <h1>Newsletter Analyzer</h1>
            </div>
            <p className="mb-lg" style={{ color: 'var(--text-secondary)' }}>
                Scan your email, categorize newsletters, track engagement, and get personalized recommendations.
            </p>

            {/* Gmail Connection */}
            <GmailConnect onConnected={() => setGmailConnected(true)} />

            {/* Action Bar */}
            <div className="flex gap-md mt-lg mb-lg" style={{ flexWrap: 'wrap' }}>
                <button
                    className={`btn ${scanning ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleScan}
                    disabled={scanning || !gmailConnected}
                >
                    {scanning ? 'Scanning...' : 'Scan Newsletters'}
                </button>
                <button
                    className={`btn ${categorizing ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleCategorize}
                    disabled={categorizing || !overview?.stats?.totalSenders}
                >
                    {categorizing ? 'Categorizing...' : 'Categorize with AI'}
                </button>
                <button
                    className={`btn ${loadingInsights ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleGenerateInsights}
                    disabled={loadingInsights || !overview?.stats?.totalSenders}
                >
                    {loadingInsights ? 'Analyzing...' : 'Generate Insights'}
                </button>
            </div>

            {/* Scan Result */}
            {scanResult && (
                <div className={`alert ${scanResult.error ? 'alert-error' : 'alert-success'} mb-lg`}>
                    {scanResult.error
                        ? `Scan failed: ${scanResult.error}`
                        : `Scanned ${scanResult.totalScanned} emails. Found ${scanResult.newslettersFound} newsletters (${scanResult.newAdded} new).`
                    }
                </div>
            )}

            {/* Tabs */}
            <div className="tabs mb-lg">
                <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                    Overview
                </button>
                <button className={`tab ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => setActiveTab('insights')}>
                    AI Insights
                </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && overview && (
                <div>
                    {/* Stats Grid */}
                    <div className="grid grid-4 mb-xl">
                        <div className="card stat-card">
                            <div className="stat-value">{overview.stats.totalSenders}</div>
                            <div className="stat-label">Newsletters</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{overview.stats.totalEmails}</div>
                            <div className="stat-label">Total Emails</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{overview.stats.overallOpenRate}%</div>
                            <div className="stat-label">Open Rate</div>
                        </div>
                        <div className="card stat-card">
                            <div className="stat-value">{overview.stats.totalCategories}</div>
                            <div className="stat-label">Categories</div>
                        </div>
                    </div>

                    {/* Categories */}
                    {overview.categories && Object.keys(overview.categories).length > 0 && (
                        <div className="card mb-lg">
                            <h3>Newsletter Categories</h3>
                            <div className="categories-grid mt-md">
                                {Object.entries(overview.categories)
                                    .sort((a, b) => b[1].count - a[1].count)
                                    .map(([cat, info]) => (
                                        <div key={cat} className="category-card">
                                            <div className="category-name">{cat}</div>
                                            <div className="category-count">{info.count} newsletter{info.count !== 1 ? 's' : ''}</div>
                                            {info.subcategories && Object.keys(info.subcategories).length > 0 && (
                                                <div className="category-subs">
                                                    {Object.entries(info.subcategories).map(([sub, count]) => (
                                                        <span key={sub} className="tag">{sub} ({count})</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {overview.stats.lastScanAt && (
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            Last scanned: {new Date(overview.stats.lastScanAt).toLocaleString()}
                        </p>
                    )}
                </div>
            )}

            {/* Insights Tab */}
            {activeTab === 'insights' && (
                <div>
                    {insights ? (
                        <div className="card">
                            <h3>Newsletter Insights</h3>
                            <p className="mt-md mb-lg">{insights.summary}</p>

                            {insights.topInterests?.length > 0 && (
                                <div className="mb-lg">
                                    <h4>Your Top Interests</h4>
                                    <div className="flex gap-sm mt-sm" style={{ flexWrap: 'wrap' }}>
                                        {insights.topInterests.map((interest, i) => (
                                            <span key={i} className="tag tag-primary">{interest}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {insights.recommendations?.length > 0 && (
                                <div className="mb-lg">
                                    <h4>Recommendations</h4>
                                    <ul className="summary-list mt-sm">
                                        {insights.recommendations.map((rec, i) => (
                                            <li key={i}>{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {insights.timeManagement && (
                                <div className="mb-lg">
                                    <h4>Time Management</h4>
                                    <p className="mt-sm">{insights.timeManagement}</p>
                                </div>
                            )}

                            {insights.unsubscribeSuggestions?.length > 0 && (
                                <div className="mb-lg">
                                    <h4>Consider Unsubscribing</h4>
                                    <div className="flex gap-sm mt-sm" style={{ flexWrap: 'wrap' }}>
                                        {insights.unsubscribeSuggestions.map((name, i) => (
                                            <span key={i} className="tag tag-danger">{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card empty-state">
                            <div className="empty-state-icon">&#x1F4CA;</div>
                            <h3>No insights yet</h3>
                            <p>Scan your newsletters and click "Generate Insights" to get AI-powered analysis</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Newsletter Rankings Page ──────────────────────────────────

export function NewsletterRankings() {
    const [rankings, setRankings] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [sortBy, setSortBy] = useState('engagement')

    useEffect(() => {
        api.get('/newsletters/rankings')
            .then(data => setRankings(data.rankings || []))
            .catch(err => console.error('Rankings error:', err))
            .finally(() => setLoading(false))
    }, [])

    const filteredRankings = rankings
        .filter(r => {
            if (filter === 'all') return true
            if (filter === 'high') return r.openRate >= 70
            if (filter === 'medium') return r.openRate >= 30 && r.openRate < 70
            if (filter === 'low') return r.openRate < 30
            return r.category === filter
        })
        .sort((a, b) => {
            if (sortBy === 'engagement') return b.engagementScore - a.engagementScore
            if (sortBy === 'opens') return b.openRate - a.openRate
            if (sortBy === 'clicks') return b.clickRate - a.clickRate
            if (sortBy === 'volume') return b.totalReceived - a.totalReceived
            return 0
        })

    const categories = [...new Set(rankings.map(r => r.category).filter(Boolean))]
    const trendIcon = (trend) => {
        if (trend === 'improving') return '\u2191'
        if (trend === 'declining') return '\u2193'
        if (trend === 'stable') return '\u2192'
        return '\u2022'
    }
    const trendColor = (trend) => {
        if (trend === 'improving') return 'var(--success)'
        if (trend === 'declining') return 'var(--error, #ef4444)'
        return 'var(--text-tertiary)'
    }

    if (loading) {
        return (
            <div className="page container">
                <div className="loading-container"><div className="spinner"></div><p>Loading rankings...</p></div>
            </div>
        )
    }

    return (
        <div className="page container">
            <h1>Newsletter Rankings</h1>
            <p className="mb-lg" style={{ color: 'var(--text-secondary)' }}>
                Your newsletters ranked by engagement. See which ones you actually read.
            </p>

            {/* Filters */}
            <div className="flex gap-md mb-lg" style={{ flexWrap: 'wrap' }}>
                <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                >
                    <option value="all">All Newsletters</option>
                    <option value="high">High Engagement (70%+)</option>
                    <option value="medium">Medium Engagement (30-70%)</option>
                    <option value="low">Low Engagement (&lt;30%)</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>

                <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                >
                    <option value="engagement">Sort by Engagement Score</option>
                    <option value="opens">Sort by Open Rate</option>
                    <option value="clicks">Sort by Click Rate</option>
                    <option value="volume">Sort by Volume</option>
                </select>
            </div>

            {/* Rankings Table */}
            {filteredRankings.length > 0 ? (
                <div className="rankings-list">
                    {filteredRankings.map((r, idx) => (
                        <div key={r.sender} className="card ranking-card mb-md">
                            <div className="ranking-rank">#{idx + 1}</div>
                            <div className="ranking-info" style={{ flex: 1 }}>
                                <div className="flex items-center gap-sm">
                                    <strong>{r.senderName}</strong>
                                    <span
                                        style={{ color: trendColor(r.trend), fontWeight: 600 }}
                                        title={`Trend: ${r.trend}`}
                                    >
                                        {trendIcon(r.trend)}
                                    </span>
                                </div>
                                <div className="flex gap-md mt-sm" style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                    {r.category && <span className="tag">{r.category}</span>}
                                    <span>{r.totalReceived} emails</span>
                                </div>
                            </div>
                            <div className="ranking-stats">
                                <div className="ranking-stat">
                                    <div className="ranking-stat-value" style={{ color: r.openRate >= 70 ? 'var(--success)' : r.openRate >= 30 ? 'var(--accent-primary)' : 'var(--error, #ef4444)' }}>
                                        {r.openRate}%
                                    </div>
                                    <div className="ranking-stat-label">Open</div>
                                </div>
                                <div className="ranking-stat">
                                    <div className="ranking-stat-value">{r.clickRate}%</div>
                                    <div className="ranking-stat-label">Click</div>
                                </div>
                                <div className="ranking-stat">
                                    <div className="ranking-stat-value">{r.engagementScore}</div>
                                    <div className="ranking-stat-label">Score</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card empty-state">
                    <div className="empty-state-icon">&#x1F4CA;</div>
                    <h3>No ranking data</h3>
                    <p>Scan your newsletters first to see rankings</p>
                </div>
            )}
        </div>
    )
}

// ── Recommendations Page ──────────────────────────────────────

export function NewsletterRecommendations() {
    const { profile } = useApp()
    const [userProf, setUserProf] = useState(null)
    const [recommendations, setRecommendations] = useState(null)
    const [loading, setLoading] = useState(false)
    const [analyzingProfile, setAnalyzingProfile] = useState(false)

    useEffect(() => {
        api.get('/newsletters/profile')
            .then(data => setUserProf(data.profile))
            .catch(() => {})
    }, [])

    const handleAnalyzeProfile = async () => {
        if (!profile?.apiKey) {
            alert('Please set your Claude API key in Settings first')
            return
        }
        setAnalyzingProfile(true)
        try {
            const data = await api.post('/newsletters/profile/analyze', {
                apiKey: profile.apiKey,
                writingSamples: profile.writingSamples || '',
                writingStyle: profile.writingStyle || ''
            })
            setUserProf(data.profile)
        } catch (err) {
            alert('Profile analysis failed: ' + err.message)
        } finally {
            setAnalyzingProfile(false)
        }
    }

    const handleGetRecommendations = async () => {
        if (!profile?.apiKey) {
            alert('Please set your Claude API key in Settings first')
            return
        }
        setLoading(true)
        try {
            const data = await api.post('/newsletters/recommendations', { apiKey: profile.apiKey })
            setRecommendations(data.recommendations)
        } catch (err) {
            alert('Failed to get recommendations: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="page container">
            <h1>Personalized Recommendations</h1>
            <p className="mb-lg" style={{ color: 'var(--text-secondary)' }}>
                AI-curated newsletter picks based on who you are and what you engage with.
            </p>

            {/* User Profile */}
            <div className="card mb-lg">
                <div className="flex items-center gap-md mb-md">
                    <h3 style={{ margin: 0 }}>Your Reader Profile</h3>
                    <button
                        className={`btn btn-sm ${analyzingProfile ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={handleAnalyzeProfile}
                        disabled={analyzingProfile}
                    >
                        {analyzingProfile ? 'Analyzing...' : userProf?.profileSummary ? 'Re-analyze' : 'Build Profile'}
                    </button>
                </div>

                {userProf?.profileSummary ? (
                    <div>
                        <p>{userProf.profileSummary}</p>
                        {userProf.interests?.length > 0 && (
                            <div className="mt-md">
                                <strong>Interests:</strong>
                                <div className="flex gap-sm mt-sm" style={{ flexWrap: 'wrap' }}>
                                    {userProf.interests.map((i, idx) => (
                                        <span key={idx} className="tag tag-primary">{i}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {userProf.blindSpots?.length > 0 && (
                            <div className="mt-md">
                                <strong>Blind Spots (explore more):</strong>
                                <div className="flex gap-sm mt-sm" style={{ flexWrap: 'wrap' }}>
                                    {userProf.blindSpots.map((b, idx) => (
                                        <span key={idx} className="tag">{b}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-tertiary)' }}>
                        Click "Build Profile" to analyze your writing samples and newsletter engagement to create your reader profile.
                    </p>
                )}
            </div>

            {/* Generate Recommendations */}
            <div className="flex gap-md mb-xl">
                <button
                    className={`btn btn-lg ${loading ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleGetRecommendations}
                    disabled={loading}
                >
                    {loading ? 'Generating Recommendations...' : 'Get This Week\'s Recommendations'}
                </button>
            </div>

            {/* Recommendations Display */}
            {recommendations && (
                <div>
                    <h2 className="mb-md">{recommendations.weeklyTheme}</h2>

                    {recommendations.weeklyInsight && (
                        <div className="card mb-lg" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
                            <h4>Weekly Insight</h4>
                            <p>{recommendations.weeklyInsight}</p>
                        </div>
                    )}

                    {/* Must Reads */}
                    {recommendations.mustReads?.length > 0 && (
                        <div className="mb-xl">
                            <h3>Must Reads</h3>
                            <div className="flex flex-col gap-md mt-md">
                                {recommendations.mustReads.map((item, i) => (
                                    <div key={i} className="card recommendation-card must-read">
                                        <div className="flex items-center gap-md">
                                            <div className="rec-score">{item.relevanceScore}%</div>
                                            <div style={{ flex: 1 }}>
                                                <strong>"{item.subject}"</strong>
                                                <div className="flex gap-sm mt-sm" style={{ fontSize: '0.85rem' }}>
                                                    <span style={{ color: 'var(--text-tertiary)' }}>by {item.sender}</span>
                                                    {item.category && <span className="tag">{item.category}</span>}
                                                </div>
                                                <p className="mt-sm" style={{ color: 'var(--text-secondary)' }}>{item.reason}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Worth Reading */}
                    {recommendations.worthReading?.length > 0 && (
                        <div className="mb-xl">
                            <h3>Worth Reading</h3>
                            <div className="flex flex-col gap-md mt-md">
                                {recommendations.worthReading.map((item, i) => (
                                    <div key={i} className="card recommendation-card">
                                        <div className="flex items-center gap-md">
                                            <div className="rec-score rec-score-secondary">{item.relevanceScore}%</div>
                                            <div style={{ flex: 1 }}>
                                                <strong>"{item.subject}"</strong>
                                                <div className="flex gap-sm mt-sm" style={{ fontSize: '0.85rem' }}>
                                                    <span style={{ color: 'var(--text-tertiary)' }}>by {item.sender}</span>
                                                    {item.category && <span className="tag">{item.category}</span>}
                                                </div>
                                                <p className="mt-sm" style={{ color: 'var(--text-secondary)' }}>{item.reason}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Skip This Week */}
                    {recommendations.skipThisWeek?.length > 0 && (
                        <div className="mb-xl">
                            <h3>Skip This Week</h3>
                            <div className="flex flex-col gap-sm mt-md">
                                {recommendations.skipThisWeek.map((item, i) => (
                                    <div key={i} className="card" style={{ opacity: 0.7, padding: 'var(--space-md)' }}>
                                        <strong>"{item.subject}"</strong> - {item.sender}
                                        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{item.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* New Discoveries */}
                    {recommendations.newDiscoveries?.length > 0 && (
                        <div className="mb-xl">
                            <h3>Explore These</h3>
                            <div className="grid grid-2 gap-md mt-md">
                                {recommendations.newDiscoveries.map((item, i) => (
                                    <div key={i} className="card">
                                        <strong>{item.suggestion}</strong>
                                        <p className="mt-sm" style={{ color: 'var(--text-secondary)' }}>{item.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Content Ideas */}
                    {recommendations.contentIdeas?.length > 0 && (
                        <div className="mb-xl">
                            <h3>Content Ideas (inspired by your reading)</h3>
                            <div className="flex flex-col gap-md mt-md">
                                {recommendations.contentIdeas.map((item, i) => (
                                    <div key={i} className="card idea-card">
                                        <h4>{item.title}</h4>
                                        <p>{item.description}</p>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                            Inspired by: {item.inspiredBy}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!recommendations && !loading && (
                <div className="card empty-state">
                    <div className="empty-state-icon">&#x2728;</div>
                    <h3>Ready for recommendations</h3>
                    <p>Build your profile first, then click "Get This Week's Recommendations" for AI-curated picks</p>
                </div>
            )}
        </div>
    )
}

// ── Weekly Digest Page ────────────────────────────────────────

export function WeeklyDigest() {
    const { profile } = useApp()
    const [config, setConfig] = useState(null)
    const [history, setHistory] = useState(null)
    const [preview, setPreview] = useState(null)
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [recipientEmail, setRecipientEmail] = useState('')
    const [dayOfWeek, setDayOfWeek] = useState(1)
    const [hour, setHour] = useState(8)

    useEffect(() => {
        Promise.all([
            api.get('/newsletters/digest/config'),
            api.get('/newsletters/digest/history')
        ]).then(([configData, historyData]) => {
            setConfig(configData)
            setHistory(historyData)
            if (configData.recipientEmail) setRecipientEmail(configData.recipientEmail)
            if (configData.dayOfWeek !== undefined) setDayOfWeek(configData.dayOfWeek)
            if (configData.hour !== undefined) setHour(configData.hour)
        }).catch(err => console.error('Digest load error:', err))
    }, [])

    const handlePreview = async () => {
        if (!profile?.apiKey) {
            alert('Please set your Claude API key in Settings first')
            return
        }
        setLoading(true)
        try {
            const data = await api.post('/newsletters/digest/preview', { apiKey: profile.apiKey })
            setPreview(data)
        } catch (err) {
            alert('Preview failed: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSendNow = async () => {
        if (!profile?.apiKey) {
            alert('Please set your Claude API key in Settings first')
            return
        }
        if (!recipientEmail) {
            alert('Please enter a recipient email address')
            return
        }
        setSending(true)
        try {
            const result = await api.post('/newsletters/digest/send', {
                apiKey: profile.apiKey,
                recipientEmail
            })

            if (result.gmailComposeUrl) {
                // Open Gmail compose with the digest
                window.open(result.gmailComposeUrl, '_blank')
            }

            // Refresh history
            const historyData = await api.get('/newsletters/digest/history')
            setHistory(historyData)

            alert('Digest generated! ' + (result.delivered ? 'Email sent.' : 'Opening Gmail compose...'))
        } catch (err) {
            alert('Failed to send digest: ' + err.message)
        } finally {
            setSending(false)
        }
    }

    const handleSaveSchedule = async () => {
        try {
            const data = await api.post('/newsletters/digest/config', {
                enabled: true,
                dayOfWeek,
                hour,
                recipientEmail,
                apiKey: profile?.apiKey || ''
            })
            setConfig(data)
            alert('Schedule saved! Digest will be generated ' + getDayName(dayOfWeek) + ' at ' + hour + ':00')
        } catch (err) {
            alert('Failed to save schedule: ' + err.message)
        }
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    function getDayName(d) { return days[d] || 'Unknown' }

    return (
        <div className="page container">
            <h1>Weekly Digest</h1>
            <p className="mb-lg" style={{ color: 'var(--text-secondary)' }}>
                Get a curated weekly digest of your best newsletter content delivered to your inbox.
            </p>

            {/* Config */}
            <div className="card mb-lg">
                <h3>Digest Settings</h3>

                <div className="grid grid-3 gap-md mt-md">
                    <div className="form-group">
                        <label className="form-label">Your Email</label>
                        <input
                            type="email"
                            className="input"
                            placeholder="you@example.com"
                            value={recipientEmail}
                            onChange={e => setRecipientEmail(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Day of Week</label>
                        <select className="input" value={dayOfWeek} onChange={e => setDayOfWeek(parseInt(e.target.value))}>
                            {days.map((name, i) => (
                                <option key={i} value={i}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Time</label>
                        <select className="input" value={hour} onChange={e => setHour(parseInt(e.target.value))}>
                            {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-md mt-md">
                    <button className="btn btn-primary" onClick={handleSaveSchedule}>
                        Save Schedule
                    </button>
                    {config?.isRunning && (
                        <span style={{ color: 'var(--success)', alignSelf: 'center' }}>
                            Scheduled: {config.nextRun ? new Date(config.nextRun).toLocaleString() : 'Running'}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-md mb-xl">
                <button
                    className={`btn ${loading ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handlePreview}
                    disabled={loading}
                >
                    {loading ? 'Generating Preview...' : 'Preview Digest'}
                </button>
                <button
                    className={`btn ${sending ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleSendNow}
                    disabled={sending}
                >
                    {sending ? 'Sending...' : 'Send Now'}
                </button>
            </div>

            {/* Preview */}
            {preview && (
                <div className="card mb-lg">
                    <h3>Digest Preview</h3>
                    <pre className="digest-preview mt-md">{preview.emailBody}</pre>
                </div>
            )}

            {/* History */}
            {history?.digests?.length > 0 && (
                <div>
                    <h3>Past Digests</h3>
                    <div className="flex flex-col gap-md mt-md">
                        {history.digests.map((digest, i) => (
                            <div key={i} className="card" style={{ padding: 'var(--space-md)' }}>
                                <div className="flex items-center gap-md">
                                    <div style={{ flex: 1 }}>
                                        <strong>{digest.theme || 'Weekly Digest'}</strong>
                                        <div className="flex gap-md mt-sm" style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                            <span>{new Date(digest.date).toLocaleDateString()}</span>
                                            <span>{digest.totalRecommendations} recommendations</span>
                                            <span>{digest.mustReadsCount} must-reads</span>
                                            <span>{digest.delivered ? 'Delivered' : 'Not sent'}</span>
                                        </div>
                                    </div>
                                    {digest.gmailComposeUrl && (
                                        <a
                                            href={digest.gmailComposeUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="btn btn-ghost btn-sm"
                                        >
                                            Open in Gmail
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
