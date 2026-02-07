import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'

// Context for global state
const AppContext = createContext()

export function useApp() {
    return useContext(AppContext)
}

// API Service
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

// Navigation Component
function Nav() {
    return (
        <nav className="nav">
            <div className="container nav-content">
                <Link to="/" className="nav-logo">
                    <div className="nav-logo-icon">📡</div>
                    <span>PodIntel</span>
                </Link>
                <ul className="nav-links">
                    <li><Link to="/" className="nav-link">Dashboard</Link></li>
                    <li><Link to="/search" className="nav-link">Search</Link></li>
                    <li><Link to="/settings" className="nav-link">Settings</Link></li>
                </ul>
            </div>
        </nav>
    )
}

// Loading Spinner
function Spinner({ text = 'Loading...' }) {
    return (
        <div className="loading-container">
            <div className="spinner"></div>
            <p>{text}</p>
        </div>
    )
}

// Add Podcast Modal Component
function AddPodcastModal({ isOpen, onClose, onAddPodcast }) {
    const navigate = useNavigate()
    const [activeOption, setActiveOption] = useState(null)
    const [rssUrl, setRssUrl] = useState('')
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState(null)
    const [error, setError] = useState('')

    if (!isOpen) return null

    const handleRssImport = async () => {
        if (!rssUrl.trim()) {
            setError('Please enter an RSS feed URL')
            return
        }
        setImporting(true)
        setError('')
        setImportResult(null)

        try {
            const result = await api.post('/podcasts/import-rss', { rssUrl })
            setImportResult(result)
            if (result.podcast && onAddPodcast) {
                onAddPodcast(result.podcast)
            }
        } catch (err) {
            setError(err.message || 'Failed to import RSS feed')
        } finally {
            setImporting(false)
        }
    }

    const handleClose = () => {
        setActiveOption(null)
        setRssUrl('')
        setImportResult(null)
        setError('')
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal add-podcast-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>+ Add Podcasts</h2>
                    <button className="modal-close" onClick={handleClose}>×</button>
                </div>

                {!activeOption ? (
                    <div className="modal-body">
                        <p className="modal-subtitle">Choose how you want to add podcasts</p>

                        <div className="import-options">
                            <button
                                className="import-option-card"
                                onClick={() => { handleClose(); navigate('/search'); }}
                            >
                                <span className="import-icon">🔍</span>
                                <div className="import-info">
                                    <strong>Search Podcasts</strong>
                                    <p>Search podscripts.co for podcasts with transcripts</p>
                                </div>
                            </button>

                            <button
                                className="import-option-card"
                                onClick={() => setActiveOption('rss')}
                            >
                                <span className="import-icon">📡</span>
                                <div className="import-info">
                                    <strong>Import RSS Feed</strong>
                                    <p>Paste an RSS feed URL directly</p>
                                </div>
                            </button>

                            <button
                                className="import-option-card"
                                onClick={() => setActiveOption('connect')}
                            >
                                <span className="import-icon">🎵</span>
                                <div className="import-info">
                                    <strong>Connect Spotify / Apple</strong>
                                    <p>Import from your favorite podcast apps</p>
                                </div>
                            </button>
                        </div>
                    </div>
                ) : activeOption === 'rss' ? (
                    <div className="modal-body">
                        <button className="btn btn-ghost btn-sm mb-md" onClick={() => setActiveOption(null)}>
                            ← Back
                        </button>
                        <h3>📡 Import RSS Feed</h3>
                        <p className="mb-md">Paste the RSS feed URL of your podcast. We'll check if transcripts are available on podscripts.co.</p>

                        <div className="form-group">
                            <label className="form-label">RSS Feed URL</label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://feeds.example.com/podcast.xml"
                                value={rssUrl}
                                onChange={e => setRssUrl(e.target.value)}
                                disabled={importing}
                            />
                        </div>

                        {error && <div className="alert alert-error mb-md">{error}</div>}

                        {importResult && (
                            <div className="import-result card mb-md">
                                <div className="import-result-header">
                                    {importResult.podcast?.artwork && (
                                        <img src={importResult.podcast.artwork} alt="" className="import-result-artwork" />
                                    )}
                                    <div>
                                        <strong>{importResult.podcast?.name}</strong>
                                        <p>{importResult.podcast?.episodeCount} episodes</p>
                                    </div>
                                </div>
                                <div className={`transcript-status ${importResult.hasTranscripts ? 'has-transcripts' : 'no-transcripts'}`}>
                                    {importResult.hasTranscripts ? (
                                        <span>✅ Transcripts available on podscripts.co</span>
                                    ) : (
                                        <span>⚠️ No transcripts found on podscripts.co</span>
                                    )}
                                </div>
                                {importResult.added && (
                                    <div className="alert alert-success mt-md">
                                        ✓ Added to your subscriptions!
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            className="btn btn-primary w-full"
                            onClick={handleRssImport}
                            disabled={importing || !rssUrl.trim()}
                        >
                            {importing ? 'Importing...' : 'Import Podcast'}
                        </button>
                    </div>
                ) : (
                    <div className="modal-body">
                        <button className="btn btn-ghost btn-sm mb-md" onClick={() => setActiveOption(null)}>
                            ← Back
                        </button>
                        <h3>🎵 Connect Your Podcast Apps</h3>

                        <div className="connect-section">
                            <h4>🟢 Spotify</h4>
                            <p>Spotify doesn't provide public RSS feeds, but you can:</p>
                            <ol>
                                <li>Open Spotify and go to the podcast page</li>
                                <li>Click <strong>⋮ More</strong> → <strong>Share</strong> → <strong>Copy Link</strong></li>
                                <li>Search for the podcast name in our <strong>Search</strong> feature</li>
                            </ol>
                        </div>

                        <div className="connect-section">
                            <h4>🍎 Apple Podcasts</h4>
                            <p>To get the RSS feed from Apple Podcasts:</p>
                            <ol>
                                <li>Find the podcast in Apple Podcasts</li>
                                <li>Right-click → <strong>Share</strong> → <strong>Copy Link</strong></li>
                                <li>Visit <a href="https://getrssfeed.com" target="_blank" rel="noopener">getrssfeed.com</a> to extract the RSS URL</li>
                                <li>Paste the RSS URL in our <strong>Import RSS</strong> option</li>
                            </ol>
                        </div>

                        <div className="connect-section">
                            <h4>📦 OPML Export</h4>
                            <p>Many podcast apps (Pocket Casts, Overcast) support OPML export. This feature is coming soon!</p>
                        </div>

                        <button
                            className="btn btn-primary w-full mt-lg"
                            onClick={() => { handleClose(); navigate('/search'); }}
                        >
                            🔍 Search for Podcasts Instead
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}


// Podcast Card Component
function PodcastCard({ podcast, onSubscribe, isSubscribed }) {
    const navigate = useNavigate()

    return (
        <div
            className="card card-clickable podcast-card"
            onClick={() => navigate(`/podcast/${podcast.slug}`)}
        >
            <img
                src={podcast.artwork || '/placeholder-podcast.svg'}
                alt={podcast.name}
                className="podcast-artwork"
                onError={(e) => e.target.src = '/placeholder-podcast.svg'}
            />
            <div className="podcast-info">
                <h4>{podcast.name}</h4>
                <p>{podcast.description}</p>
            </div>
            <div className="podcast-meta">
                <span>📝 {podcast.episodeCount || '?'} episodes</span>
            </div>
            <button
                className={`btn ${isSubscribed ? 'btn-secondary' : 'btn-primary'} btn-sm w-full`}
                onClick={(e) => {
                    e.stopPropagation()
                    onSubscribe(podcast.slug)
                }}
            >
                {isSubscribed ? '✓ Subscribed' : '+ Subscribe'}
            </button>
        </div>
    )
}

// Episode Card Component
function EpisodeCard({ episode, showRelevance = false, showAiStatus = false }) {
    const navigate = useNavigate()
    const episodeNum = episode.title?.match(/#(\d+)/)?.[1] || '?'

    return (
        <div
            className="card card-clickable episode-card"
            onClick={() => navigate(`/episode/${episode.slug}`)}
        >
            <div className="episode-number">#{episodeNum}</div>
            <div className="episode-content">
                <h4>{episode.title}</h4>
                <div className="episode-meta">
                    {episode.date && <span>📅 {episode.date}</span>}
                    {episode.likes > 0 && <span>❤️ {episode.likes}</span>}
                </div>
                {showAiStatus && (episode.hasSummary || episode.hasIdeas) && (
                    <div className="episode-ai-badges">
                        {episode.hasSummary && (
                            <span className="ai-badge ai-badge-summary">🤖 AI Summary</span>
                        )}
                        {episode.hasIdeas && (
                            <span className="ai-badge ai-badge-ideas">💡 Content Ideas</span>
                        )}
                    </div>
                )}
            </div>
            {showRelevance && episode.relevance && (
                <div className="episode-actions">
                    <span className={`relevance-badge relevance-${episode.relevance.level}`}>
                        {episode.relevance.score}% match
                    </span>
                </div>
            )}
        </div>
    )
}

// Dashboard Page
function Dashboard() {
    const { subscriptions, profile, addSubscription } = useApp()
    const [recentEpisodes, setRecentEpisodes] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)

    useEffect(() => {
        async function loadDashboard() {
            if (subscriptions.length === 0) {
                setRecentEpisodes([])
                setLoading(false)
                return
            }
            try {
                const slugs = subscriptions.map(s => s.slug).join(',')
                const data = await api.get(`/dashboard?slugs=${encodeURIComponent(slugs)}`)
                setRecentEpisodes(data.recentEpisodes || [])
            } catch (err) {
                console.error('Dashboard error:', err)
            } finally {
                setLoading(false)
            }
        }
        loadDashboard()
    }, [subscriptions])

    if (!profile?.apiKey) {
        return (
            <div className="page container">
                <div className="hero">
                    <h1>Welcome to PodIntel</h1>
                    <p>AI-powered podcast intelligence with personalized summaries tailored to your writing style.</p>
                    <Link to="/settings" className="btn btn-primary btn-lg">
                        🔑 Set Up API Key to Get Started
                    </Link>
                </div>

                <div className="card text-center" style={{ marginTop: '2rem' }}>
                    <h3>How it works</h3>
                    <div className="grid grid-3 mt-lg">
                        <div>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                            <h4>Search</h4>
                            <p>Find any podcast on podscripts.co</p>
                        </div>
                        <div>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                            <h4>Transcripts</h4>
                            <p>Read full timestamped transcripts</p>
                        </div>
                        <div>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤖</div>
                            <h4>AI Summaries</h4>
                            <p>Get personalized insights via Claude</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page container">
            <AddPodcastModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAddPodcast={(podcast) => addSubscription && addSubscription(podcast)}
            />
            <div className="section-header">
                <h2>📡 Your Podcast Feed</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                    + Add Podcasts
                </button>
            </div>

            {loading ? (
                <Spinner text="Loading your feed..." />
            ) : subscriptions.length === 0 ? (
                <div className="card empty-state">
                    <div className="empty-state-icon">🎧</div>
                    <h3>No subscriptions yet</h3>
                    <p>Search for podcasts to subscribe and track new episodes</p>
                    <Link to="/search" className="btn btn-primary mt-lg">Search Podcasts</Link>
                </div>
            ) : (
                <>
                    <h3 className="mb-md">Your Subscriptions</h3>
                    <div className="grid grid-4 mb-xl">
                        {subscriptions.map(sub => (
                            <div key={sub.slug} className="card podcast-card">
                                <img
                                    src={sub.artwork || '/placeholder-podcast.svg'}
                                    alt={sub.name}
                                    className="podcast-artwork"
                                />
                                <div className="podcast-info">
                                    <h4>{sub.name}</h4>
                                </div>
                                <Link to={`/podcast/${sub.slug}`} className="btn btn-secondary btn-sm w-full">
                                    View Episodes
                                </Link>
                            </div>
                        ))}
                    </div>

                    <h3 className="mb-md">Recent Episodes</h3>
                    <div className="flex flex-col gap-md">
                        {recentEpisodes.map(ep => (
                            <EpisodeCard key={ep.slug} episode={ep} showRelevance showAiStatus />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// Search Page
function SearchPage() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [searchParams, setSearchParams] = useSearchParams()
    const { subscriptions, toggleSubscription } = useApp()

    const handleSearch = async (e) => {
        e?.preventDefault()
        if (!query.trim()) return

        setLoading(true)
        setSearchParams({ q: query })

        try {
            const data = await api.get(`/podcasts/search?q=${encodeURIComponent(query)}`)
            setResults(data.podcasts || [])
        } catch (err) {
            console.error('Search error:', err)
        } finally {
            setLoading(false)
        }
    }

    // Load from URL params
    useEffect(() => {
        const q = searchParams.get('q')
        if (q && q !== query) {
            setQuery(q)
            handleSearch()
        }
    }, [])

    return (
        <div className="page container">
            <div className="hero">
                <h1>Search Podcasts</h1>
                <p>Find any podcast with transcripts on podscripts.co</p>
            </div>

            <form onSubmit={handleSearch} className="search-bar mb-xl">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="input"
                    placeholder="Search for podcasts (e.g., Modern Wisdom, Huberman Lab)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </form>

            {loading ? (
                <Spinner text="Searching podcasts..." />
            ) : results.length > 0 ? (
                <div className="grid grid-3">
                    {results.map(podcast => (
                        <PodcastCard
                            key={podcast.slug}
                            podcast={podcast}
                            isSubscribed={subscriptions.some(s => s.slug === podcast.slug)}
                            onSubscribe={toggleSubscription}
                        />
                    ))}
                </div>
            ) : query && !loading ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h3>No podcasts found</h3>
                    <p>Try a different search term</p>
                </div>
            ) : null}
        </div>
    )
}

// Podcast Detail Page with Pagination
function PodcastPage() {
    const { slug } = useParams()
    const [podcast, setPodcast] = useState(null)
    const [episodes, setEpisodes] = useState([])
    const [pagination, setPagination] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const { subscriptions, toggleSubscription } = useApp()
    const [searchParams, setSearchParams] = useSearchParams()

    const currentPage = parseInt(searchParams.get('page')) || 1

    const loadPage = async (page) => {
        setLoadingMore(true)
        try {
            const data = await api.get(`/podcasts/${slug}/episodes?page=${page}&perPage=10`)
            setPodcast(data.podcast)
            setEpisodes(data.episodes || [])
            setPagination(data.pagination)
            setSearchParams({ page: page.toString() })
        } catch (err) {
            console.error('Podcast load error:', err)
        } finally {
            setLoadingMore(false)
            setLoading(false)
        }
    }

    useEffect(() => {
        loadPage(currentPage)
    }, [slug])

    if (loading) return <div className="page container"><Spinner /></div>
    if (!podcast) return <div className="page container"><p>Podcast not found</p></div>

    const isSubscribed = subscriptions.some(s => s.slug === slug)

    return (
        <div className="page container">
            <div className="flex gap-lg items-center mb-xl">
                <img
                    src={podcast.artwork || '/placeholder-podcast.svg'}
                    alt={podcast.name}
                    style={{ width: 150, height: 150, borderRadius: 'var(--radius-lg)' }}
                />
                <div style={{ flex: 1 }}>
                    <h1>{podcast.name}</h1>
                    <p style={{ maxWidth: 600 }}>{podcast.description}</p>

                    {/* Stats Display */}
                    <div className="flex gap-lg mt-md" style={{ flexWrap: 'wrap' }}>
                        <div className="card" style={{ padding: 'var(--space-md)', minWidth: 120 }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                {podcast.totalEpisodes || pagination?.totalEpisodes || '?'}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Total Episodes</div>
                        </div>
                        <div className="card" style={{ padding: 'var(--space-md)', minWidth: 120 }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                                {podcast.savedTranscripts || 0}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Saved Transcripts</div>
                        </div>
                        <div className="card" style={{ padding: 'var(--space-md)', minWidth: 120 }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                                {podcast.savedSummaries || 0}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>AI Summaries</div>
                        </div>
                    </div>

                    <button
                        className={`btn ${isSubscribed ? 'btn-secondary' : 'btn-primary'} mt-md`}
                        onClick={() => toggleSubscription(slug)}
                    >
                        {isSubscribed ? '✓ Subscribed' : '+ Subscribe'}
                    </button>
                </div>
            </div>

            {/* Episode Header with Pagination Info */}
            <div className="section-header">
                <h2>
                    Episodes
                    {pagination && (
                        <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 'var(--space-sm)' }}>
                            (showing {((pagination.page - 1) * pagination.perPage) + 1}-{Math.min(pagination.page * pagination.perPage, pagination.totalEpisodes)} of {pagination.totalEpisodes})
                        </span>
                    )}
                </h2>
            </div>

            {/* Episodes List */}
            <div className="flex flex-col gap-md">
                {loadingMore ? (
                    <Spinner text="Loading episodes..." />
                ) : (
                    episodes.map(ep => (
                        <div
                            key={ep.slug}
                            className="card card-clickable episode-card"
                            onClick={() => window.location.href = `/episode/${ep.slug}`}
                            style={{ position: 'relative' }}
                        >
                            <div className="episode-number">#{ep.title?.match(/#(\d+)/)?.[1] || '?'}</div>
                            <div className="episode-content">
                                <h4>{ep.title}</h4>
                                <div className="episode-meta">
                                    {ep.date && <span>📅 {ep.date}</span>}
                                    {ep.likes > 0 && <span>❤️ {ep.likes}</span>}
                                    {ep.hasTranscript && <span className="tag" style={{ background: 'rgba(34, 197, 94, 0.2)', color: 'var(--success)' }}>📝 Saved</span>}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex gap-md items-center justify-center mt-xl">
                    <button
                        className="btn btn-secondary"
                        disabled={pagination.page <= 1}
                        onClick={() => loadPage(pagination.page - 1)}
                    >
                        ← Previous
                    </button>

                    <div className="flex gap-sm">
                        {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, i) => {
                            // Show pages around current page
                            let pageNum
                            if (pagination.totalPages <= 10) {
                                pageNum = i + 1
                            } else if (pagination.page <= 5) {
                                pageNum = i + 1
                            } else if (pagination.page >= pagination.totalPages - 4) {
                                pageNum = pagination.totalPages - 9 + i
                            } else {
                                pageNum = pagination.page - 4 + i
                            }

                            return (
                                <button
                                    key={pageNum}
                                    className={`btn ${pagination.page === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ minWidth: 40, padding: 'var(--space-sm)' }}
                                    onClick={() => loadPage(pageNum)}
                                >
                                    {pageNum}
                                </button>
                            )
                        })}
                    </div>

                    <button
                        className="btn btn-secondary"
                        disabled={!pagination.hasMore}
                        onClick={() => loadPage(pagination.page + 1)}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    )
}

// Episode Detail Page with Transcript and AI Summary
function EpisodePage() {
    const { slug } = useParams()
    const [episode, setEpisode] = useState(null)
    const [transcript, setTranscript] = useState([])
    const [summary, setSummary] = useState(null)
    const [activeTab, setActiveTab] = useState('transcript')
    const [loading, setLoading] = useState(true)
    const [summarizing, setSummarizing] = useState(false)
    const [showTemplateModal, setShowTemplateModal] = useState(false)
    const [selectedTemplateId, setSelectedTemplateId] = useState('none')
    const { profile } = useApp()

    // Get saved brand templates
    const brandTemplates = profile?.brandTemplates || []

    // Tone options for display
    const toneLabels = {
        professional: '👔 Professional',
        conversational: '💬 Conversational',
        casual: '😎 Casual',
        inspirational: '✨ Inspirational',
        educational: '📚 Educational'
    }

    useEffect(() => {
        async function loadEpisode() {
            try {
                const data = await api.get(`/episodes/${slug}/transcript`)
                setEpisode(data.episode)
                setTranscript(data.transcript || [])
                if (data.summary) setSummary(data.summary)
            } catch (err) {
                console.error('Episode load error:', err)
            } finally {
                setLoading(false)
            }
        }
        loadEpisode()
    }, [slug])

    const handleGenerateClick = () => {
        if (!profile?.apiKey) {
            alert('Please set your Claude API key in Settings first')
            return
        }

        // If user has brand templates, show selection modal
        if (brandTemplates.length > 0) {
            setShowTemplateModal(true)
        } else {
            // No templates, generate directly
            handleSummarize(null)
        }
    }

    const handleSummarize = async (template) => {
        setShowTemplateModal(false)
        setSummarizing(true)

        try {
            const data = await api.post(`/episodes/${slug}/summarize`, {
                apiKey: profile.apiKey,
                writingProfile: profile.writingSamples,
                writingStyle: profile.writingStyle,
                brandTemplate: template
            })
            setSummary(data.summary)
            setActiveTab('summary')
        } catch (err) {
            console.error('Summary error:', err)
            alert('Failed to generate summary. Check your API key.')
        } finally {
            setSummarizing(false)
        }
    }

    const handleModalGenerate = () => {
        if (selectedTemplateId === 'none') {
            handleSummarize(null)
        } else {
            const template = brandTemplates.find(t => t.id === selectedTemplateId)
            handleSummarize(template)
        }
    }

    // Handle email summary - opens Gmail compose with summary content
    const handleEmailSummary = () => {
        if (!summary || !episode) return

        const subject = encodeURIComponent(`Podcast Summary: ${episode.title}`)

        // Format summary into readable email text
        let body = `🎙️ PODCAST SUMMARY\n\n`
        body += `Episode: ${episode.title}\n`
        if (episode.date) body += `Date: ${episode.date}\n`
        body += `\n---\n\n`

        if (summary.keyTakeaways?.length > 0) {
            body += `📌 KEY TAKEAWAYS\n\n`
            summary.keyTakeaways.forEach((t, i) => {
                body += `${i + 1}. ${t}\n`
            })
            body += `\n`
        }

        if (summary.relevance) {
            body += `🎯 RELEVANCE\n\n${summary.relevance}\n\n`
        }

        if (summary.contentIdeas?.length > 0) {
            body += `💡 CONTENT IDEAS\n\n`
            summary.contentIdeas.forEach((idea) => {
                body += `• ${idea.title}\n  ${idea.description}\n\n`
            })
        }

        if (summary.quotes?.length > 0) {
            body += `💬 QUOTABLE MOMENTS\n\n`
            summary.quotes.forEach((q) => {
                body += `"${q}"\n\n`
            })
        }

        body += `---\nGenerated with PodIntel`

        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${encodeURIComponent(body)}`
        window.open(gmailUrl, '_blank')
    }

    if (loading) return <div className="page container"><Spinner /></div>
    if (!episode) return <div className="page container"><p>Episode not found</p></div>

    return (
        <div className="page container">
            <div className="mb-xl">
                <Link to={`/podcast/${episode.podcastSlug}`} className="btn btn-ghost btn-sm mb-md">
                    ← Back to podcast
                </Link>
                <h1>{episode.title}</h1>
                <div className="episode-meta mt-sm">
                    {episode.date && <span>📅 {episode.date}</span>}
                    {episode.duration && <span>⏱️ {episode.duration}</span>}
                </div>
                {episode.description && <p className="mt-md">{episode.description}</p>}
            </div>

            <div className="flex gap-md mb-lg">
                <button
                    className={`btn ${summarizing ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleGenerateClick}
                    disabled={summarizing}
                >
                    {summarizing ? '⏳ Generating...' : '🤖 Generate AI Summary'}
                </button>
            </div>

            {/* Template Selection Modal */}
            {showTemplateModal && (
                <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>🎨 Select Brand & Tone</h3>
                        <p>Choose how you want the summary to be written:</p>

                        <div className="template-selector">
                            <label
                                className={`template-selector-option ${selectedTemplateId === 'none' ? 'selected' : ''}`}
                                onClick={() => setSelectedTemplateId('none')}
                            >
                                <input
                                    type="radio"
                                    name="template"
                                    checked={selectedTemplateId === 'none'}
                                    onChange={() => setSelectedTemplateId('none')}
                                />
                                <div className="template-selector-info">
                                    <strong>No template (general summary)</strong>
                                    <p>Generate a standard summary without specific brand styling</p>
                                </div>
                            </label>

                            {brandTemplates.map((template) => (
                                <label
                                    key={template.id}
                                    className={`template-selector-option ${selectedTemplateId === template.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedTemplateId(template.id)}
                                >
                                    <input
                                        type="radio"
                                        name="template"
                                        checked={selectedTemplateId === template.id}
                                        onChange={() => setSelectedTemplateId(template.id)}
                                    />
                                    <div className="template-selector-info">
                                        <strong>{template.name}</strong>
                                        <p>
                                            {toneLabels[template.tone] || template.tone}
                                            {template.audience && ` • ${template.audience}`}
                                        </p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setShowTemplateModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleModalGenerate}>
                                Generate Summary
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'transcript' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transcript')}
                >
                    📝 Transcript
                </button>
                <button
                    className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                >
                    🤖 AI Summary
                </button>
                {summary && (
                    <button
                        className={`tab ${activeTab === 'ideas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ideas')}
                    >
                        💡 Content Ideas
                    </button>
                )}
            </div>

            {activeTab === 'transcript' && (
                <div className="card transcript-container">
                    {transcript.length > 0 ? (
                        <div className="transcript-content">
                            {transcript.map((seg, i) => (
                                <div key={i} className="transcript-paragraph">
                                    {seg.timestamp && (
                                        <span className="transcript-timestamp">{seg.timestamp}</span>
                                    )}
                                    <p className="transcript-text">{seg.text}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">📝</div>
                            <h3>No transcript available</h3>
                            <p>This episode may not have a transcript on podscripts.co</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'summary' && (
                <div className="card summary-panel">
                    {summary ? (
                        <>
                            <div className="summary-header">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleEmailSummary}
                                >
                                    📧 Email Summary
                                </button>
                            </div>
                            <div className="summary-section">
                                <h3><span className="icon">📌</span> Key Takeaways</h3>
                                <ul className="summary-list">
                                    {summary.keyTakeaways?.map((item, i) => (
                                        <li key={i}>{item}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="summary-section">
                                <h3><span className="icon">🎯</span> Relevance to Your Content</h3>
                                <p>{summary.relevance}</p>
                                <div className={`relevance-badge relevance-${summary.relevanceLevel} mt-md`}>
                                    {summary.relevanceScore}% match to your writing profile
                                </div>
                            </div>

                            <div className="summary-section">
                                <h3><span className="icon">💬</span> Quotable Moments</h3>
                                <ul className="summary-list">
                                    {summary.quotes?.map((quote, i) => (
                                        <li key={i}>"{quote}"</li>
                                    ))}
                                </ul>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">🤖</div>
                            <h3>No summary yet</h3>
                            <p>Click "Generate AI Summary" to create a personalized summary</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'ideas' && summary && (
                <div className="card content-ideas-panel">
                    {/* Relevance Section */}
                    <div className="summary-section">
                        <h3><span className="icon">🎯</span> Relevance to Your Content</h3>
                        <p>{summary.relevance}</p>
                        <div className={`relevance-badge relevance-${summary.relevanceLevel} mt-md`}>
                            {summary.relevanceScore}% match to your writing profile
                        </div>
                    </div>

                    {/* Content Ideas */}
                    <div className="ideas-header">
                        <h2>💡 Content Ideas</h2>
                        <p className="ideas-subtitle">Ideas tailored to your writing style and topics</p>
                    </div>
                    {summary.contentIdeas?.length > 0 ? (
                        <div className="ideas-grid">
                            {summary.contentIdeas.slice(0, 4).map((idea, i) => (
                                <div key={i} className="idea-card">
                                    <div className="idea-number">{i + 1}</div>
                                    <div className="idea-content">
                                        <div className="idea-header">
                                            <h3 className="idea-title">{idea.title}</h3>
                                            <div className={`strength-badge strength-${idea.strength || 3}`}>
                                                {'★'.repeat(idea.strength || 3)}{'☆'.repeat(5 - (idea.strength || 3))}
                                            </div>
                                        </div>
                                        <p className="idea-description">{idea.description}</p>
                                        {idea.strengthReason && (
                                            <p className="strength-reason">💡 {idea.strengthReason}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>No content ideas were generated for this episode.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Settings Page with Sidebar Navigation
function SettingsPage() {
    const { profile, updateProfile } = useApp()
    const [activeSection, setActiveSection] = useState('api-key')
    const [apiKey, setApiKey] = useState(profile?.apiKey || '')
    const [writingSamples, setWritingSamples] = useState(profile?.writingSamples || '')
    const [writingStyle, setWritingStyle] = useState(profile?.writingStyle || '')
    const [brandTemplates, setBrandTemplates] = useState(profile?.brandTemplates || [])
    const [saved, setSaved] = useState(false)
    const [showApiKey, setShowApiKey] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState(null)
    const [analyzing, setAnalyzing] = useState(false)

    // Sync local state with profile when it loads from localStorage
    useEffect(() => {
        if (profile?.apiKey) setApiKey(profile.apiKey)
        if (profile?.writingSamples) setWritingSamples(profile.writingSamples)
        if (profile?.writingStyle) setWritingStyle(profile.writingStyle)
        if (profile?.brandTemplates) setBrandTemplates(profile.brandTemplates)
    }, [profile?.apiKey, profile?.writingSamples, profile?.writingStyle, profile?.brandTemplates])

    // Check if settings are saved
    const apiKeySaved = profile?.apiKey && profile.apiKey.length > 0
    const writingSamplesSaved = profile?.writingSamples && profile.writingSamples.length > 0
    const writingStyleSaved = profile?.writingStyle && profile.writingStyle.length > 0
    const brandTemplatesSaved = profile?.brandTemplates && profile.brandTemplates.length > 0

    // Parse writing samples into a list
    const parseSamples = (text) => {
        if (!text) return []
        const samples = text.split('---').filter(s => s.trim().length > 20)
        return samples.map(s => {
            const lines = s.trim().split('\n')
            const titleLine = lines.find(l => l.toLowerCase().startsWith('title:'))
            return {
                title: titleLine ? titleLine.replace(/^title:\s*/i, '').trim() : lines[0]?.slice(0, 60) + '...',
                preview: lines.slice(1, 3).join(' ').slice(0, 100)
            }
        })
    }

    const savedSamples = parseSamples(profile?.writingSamples)

    const handleSave = () => {
        updateProfile({ apiKey, writingSamples, writingStyle, brandTemplates })
        setSaved(true)
        setTimeout(() => setSaved(false), 8000)
    }

    const handleAnalyzeStyle = async () => {
        if (!apiKey) {
            alert('Please enter your Claude API key first')
            return
        }
        if (!writingSamples || writingSamples.trim().length < 50) {
            alert('Please add at least one writing sample first')
            return
        }

        setAnalyzing(true)
        try {
            const data = await api.post('/analyze-writing-style', {
                apiKey,
                writingSamples
            })
            if (data.writingStyle) {
                setWritingStyle(data.writingStyle)
            }
        } catch (err) {
            console.error('Analyze style error:', err)
            alert('Failed to analyze writing style. Check your API key and try again.')
        } finally {
            setAnalyzing(false)
        }
    }

    const handleAddTemplate = () => {
        setEditingTemplate({ id: '', name: '', tone: 'professional', audience: '', description: '' })
    }

    const handleEditTemplate = (template) => {
        setEditingTemplate({ ...template })
    }

    const handleDeleteTemplate = (id) => {
        setBrandTemplates(brandTemplates.filter(t => t.id !== id))
    }

    const handleSaveTemplate = () => {
        if (!editingTemplate.name.trim()) {
            alert('Please enter a template name')
            return
        }

        if (editingTemplate.id) {
            // Update existing
            setBrandTemplates(brandTemplates.map(t =>
                t.id === editingTemplate.id ? editingTemplate : t
            ))
        } else {
            // Add new
            const newTemplate = {
                ...editingTemplate,
                id: Date.now().toString()
            }
            setBrandTemplates([...brandTemplates, newTemplate])
        }
        setEditingTemplate(null)
    }

    const toneOptions = [
        { value: 'professional', label: '👔 Professional', desc: 'Formal, authoritative' },
        { value: 'conversational', label: '💬 Conversational', desc: 'Friendly, approachable' },
        { value: 'casual', label: '😎 Casual', desc: 'Relaxed, informal' },
        { value: 'inspirational', label: '✨ Inspirational', desc: 'Motivating, uplifting' },
        { value: 'educational', label: '📚 Educational', desc: 'Informative, teaching' },
    ]

    const navItems = [
        { id: 'api-key', icon: '🔑', label: 'Claude API Key', saved: apiKeySaved },
        { id: 'writing-samples', icon: '✍️', label: 'Writing Samples', saved: writingSamplesSaved, count: savedSamples.length },
        { id: 'writing-style', icon: '📝', label: 'Writing Style', saved: writingStyleSaved },
        { id: 'brand-templates', icon: '🎨', label: 'Brand & Tone', saved: brandTemplatesSaved, count: brandTemplates.length },
    ]

    return (
        <div className="settings-layout">
            {/* Sidebar Navigation */}
            <div className="settings-sidebar">
                <h2 className="settings-sidebar-title">Settings</h2>
                <nav className="settings-nav">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            className={`settings-nav-item ${activeSection === item.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(item.id)}
                        >
                            <span className="settings-nav-icon">{item.icon}</span>
                            <span className="settings-nav-label">{item.label}</span>
                            {item.saved && <span className="settings-nav-badge">✓</span>}
                            {item.count > 0 && !item.saved && (
                                <span className="settings-nav-count">{item.count}</span>
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="settings-content">
                {/* API Key Section */}
                {activeSection === 'api-key' && (
                    <div className="settings-panel">
                        <div className="settings-panel-header">
                            <h2>🔑 Claude API Key</h2>
                            {apiKeySaved && <span className="saved-badge">✓ Connected</span>}
                        </div>
                        <p className="settings-panel-desc">Connect your Claude API key to enable AI-powered summaries and writing analysis.</p>

                        <div className="form-group">
                            <label className="form-label">API Key</label>
                            <div className="flex gap-sm items-center">
                                <input
                                    type={showApiKey ? "text" : "password"}
                                    className="input"
                                    placeholder="sk-ant-..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    type="button"
                                >
                                    {showApiKey ? '🙈 Hide' : '👁️ Show'}
                                </button>
                            </div>
                            <p className="form-helper">
                                Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>
                            </p>
                        </div>

                        <button className="btn btn-primary" onClick={() => {
                            updateProfile({ ...profile, apiKey })
                            setSaved(true)
                            setTimeout(() => setSaved(false), 3000)
                        }}>
                            💾 Save API Key
                        </button>
                    </div>
                )}

                {/* Writing Samples Section */}
                {activeSection === 'writing-samples' && (
                    <div className="settings-panel">
                        <div className="settings-panel-header">
                            <h2>✍️ Writing Samples</h2>
                            {writingSamplesSaved && (
                                <span className="saved-badge">✓ {savedSamples.length} samples</span>
                            )}
                        </div>
                        <p className="settings-panel-desc">Paste samples of your LinkedIn posts or articles. The AI will learn from these to tailor summaries to your voice.</p>

                        {savedSamples.length > 0 && (
                            <div className="saved-samples mb-lg">
                                <p className="form-label">Your Saved Writing Samples:</p>
                                <div className="samples-list">
                                    {savedSamples.map((sample, i) => (
                                        <div key={i} className="sample-item">
                                            <div className="sample-check">✓</div>
                                            <div>
                                                <strong>{sample.title}</strong>
                                                <p className="sample-preview">{sample.preview}...</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Edit Writing Samples</label>
                            <textarea
                                className="input"
                                rows={10}
                                placeholder="Paste 2-3 of your best LinkedIn posts here...

Example:
---
Title: Why Most Leaders Fail at Delegation
I used to think being a great leader meant doing everything myself...
---"
                                value={writingSamples}
                                onChange={(e) => setWritingSamples(e.target.value)}
                            />
                            <p className="form-helper">
                                Separate samples with --- (three dashes). Include 2-5 samples for best results.
                            </p>
                        </div>

                        <button className="btn btn-primary" onClick={() => {
                            updateProfile({ ...profile, writingSamples })
                            setSaved(true)
                            setTimeout(() => setSaved(false), 3000)
                        }}>
                            💾 Save Writing Samples
                        </button>
                    </div>
                )}

                {/* Writing Style Section */}
                {activeSection === 'writing-style' && (
                    <div className="settings-panel">
                        <div className="settings-panel-header">
                            <h2>📝 Writing Style</h2>
                            {writingStyleSaved && <span className="saved-badge">✓ Defined</span>}
                        </div>
                        <p className="settings-panel-desc">Your writing style preferences, automatically analyzed from your samples or manually defined.</p>

                        <div className="flex gap-md mb-lg">
                            <button
                                className={`btn ${analyzing ? 'btn-secondary' : 'btn-primary'}`}
                                onClick={handleAnalyzeStyle}
                                disabled={analyzing || !writingSamples}
                            >
                                {analyzing ? '⏳ Analyzing...' : '✨ Analyze My Writing Style'}
                            </button>
                            {!writingSamples && (
                                <span className="form-helper" style={{ alignSelf: 'center' }}>
                                    Add writing samples first
                                </span>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Writing Style Description</label>
                            <textarea
                                className="input"
                                rows={8}
                                placeholder="Click 'Analyze My Writing Style' to auto-generate, or describe manually..."
                                value={writingStyle}
                                onChange={(e) => setWritingStyle(e.target.value)}
                            />
                            <p className="form-helper">This will guide AI-generated content to match your voice.</p>
                        </div>

                        <button className="btn btn-primary" onClick={() => {
                            updateProfile({ ...profile, writingStyle })
                            setSaved(true)
                            setTimeout(() => setSaved(false), 3000)
                        }}>
                            💾 Save Writing Style
                        </button>
                    </div>
                )}

                {/* Brand & Tone Templates Section */}
                {activeSection === 'brand-templates' && (
                    <div className="settings-panel">
                        <div className="settings-panel-header">
                            <h2>🎨 Brand & Tone Templates</h2>
                            {brandTemplatesSaved && (
                                <span className="saved-badge">✓ {brandTemplates.length} templates</span>
                            )}
                        </div>
                        <p className="settings-panel-desc">Create templates for different content types. When generating AI summaries, you can choose which template to use.</p>

                        <button className="btn btn-primary mb-lg" onClick={handleAddTemplate}>
                            + Add Template
                        </button>

                        {brandTemplates.length > 0 ? (
                            <div className="templates-list">
                                {brandTemplates.map((template) => (
                                    <div key={template.id} className="template-card">
                                        <div className="template-header">
                                            <h4>{template.name}</h4>
                                            <div className="template-actions">
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleEditTemplate(template)}>Edit</button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteTemplate(template.id)}>🗑️</button>
                                            </div>
                                        </div>
                                        <div className="template-meta">
                                            <span className="template-tone">{toneOptions.find(t => t.value === template.tone)?.label || template.tone}</span>
                                            {template.audience && <span className="template-audience">🎯 {template.audience}</span>}
                                        </div>
                                        {template.description && <p className="template-desc">{template.description}</p>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state"><p>No templates yet. Create your first brand template!</p></div>
                        )}

                        <button className="btn btn-primary mt-lg" onClick={() => {
                            updateProfile({ ...profile, brandTemplates })
                            setSaved(true)
                            setTimeout(() => setSaved(false), 3000)
                        }}>💾 Save Templates</button>
                    </div>
                )}

                {/* Template Edit Modal */}
                {editingTemplate && (
                    <div className="modal-overlay" onClick={() => setEditingTemplate(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <h3>{editingTemplate.id ? 'Edit Template' : 'Create New Template'}</h3>
                            <div className="form-group">
                                <label className="form-label">Template Name</label>
                                <input type="text" className="input" placeholder="e.g., Professional LinkedIn"
                                    value={editingTemplate.name}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tone</label>
                                <div className="tone-options">
                                    {toneOptions.map((tone) => (
                                        <label key={tone.value} className={`tone-option ${editingTemplate.tone === tone.value ? 'selected' : ''}`}>
                                            <input type="radio" name="tone" value={tone.value}
                                                checked={editingTemplate.tone === tone.value}
                                                onChange={(e) => setEditingTemplate({ ...editingTemplate, tone: e.target.value })} />
                                            <span className="tone-label">{tone.label}</span>
                                            <span className="tone-desc">{tone.desc}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Target Audience</label>
                                <input type="text" className="input" placeholder="e.g., B2B executives"
                                    value={editingTemplate.audience}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, audience: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Additional Instructions</label>
                                <textarea className="input" rows={3} placeholder="Any specific guidelines..."
                                    value={editingTemplate.description}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })} />
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-ghost" onClick={() => setEditingTemplate(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSaveTemplate}>
                                    {editingTemplate.id ? 'Save Changes' : 'Create Template'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {saved && <div className="toast toast-success">✓ Settings saved!</div>}
        </div>
    )
}
// Main App Component
function App() {
    const [subscriptions, setSubscriptions] = useState([])
    const [profile, setProfile] = useState({})
    const [isLoaded, setIsLoaded] = useState(false)

    // Load settings from server first, fallback to localStorage
    useEffect(() => {
        async function loadSettings() {
            // Try to load from server first
            try {
                const serverSettings = await api.get('/settings')
                if (serverSettings && Object.keys(serverSettings).length > 0) {
                    // Server has settings
                    if (serverSettings.subscriptions) {
                        setSubscriptions(serverSettings.subscriptions)
                    }
                    if (serverSettings.profile) {
                        setProfile(serverSettings.profile)
                    }
                    setIsLoaded(true)
                    return
                }
            } catch (err) {
                console.log('Server settings not available, using localStorage')
            }

            // Fallback to localStorage
            const savedSubs = localStorage.getItem('podintel_subscriptions')
            const savedProfile = localStorage.getItem('podintel_profile')
            if (savedSubs) {
                try {
                    setSubscriptions(JSON.parse(savedSubs))
                } catch (e) {
                    console.error('Failed to parse subscriptions:', e)
                }
            }
            if (savedProfile) {
                try {
                    setProfile(JSON.parse(savedProfile))
                } catch (e) {
                    console.error('Failed to parse profile:', e)
                }
            }
            setIsLoaded(true)
        }
        loadSettings()
    }, [])

    // Persist to both localStorage and server
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('podintel_subscriptions', JSON.stringify(subscriptions))
            // Save to server (fire and forget)
            api.post('/settings', { subscriptions, profile }).catch(err => {
                console.log('Failed to save settings to server:', err)
            })
        }
    }, [subscriptions, isLoaded])

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('podintel_profile', JSON.stringify(profile))
            // Save to server (fire and forget)
            api.post('/settings', { subscriptions, profile }).catch(err => {
                console.log('Failed to save settings to server:', err)
            })
        }
    }, [profile, isLoaded])

    const toggleSubscription = async (slug) => {
        const exists = subscriptions.some(s => s.slug === slug)
        if (exists) {
            setSubscriptions(subscriptions.filter(s => s.slug !== slug))
        } else {
            // Fetch podcast details and add
            try {
                const data = await api.get(`/podcasts/${slug}`)
                setSubscriptions([...subscriptions, data.podcast])
            } catch (err) {
                console.error('Subscribe error:', err)
            }
        }
    }

    const updateProfile = (newProfile) => {
        setProfile({ ...profile, ...newProfile })
    }

    const contextValue = {
        subscriptions,
        toggleSubscription,
        profile,
        updateProfile
    }

    return (
        <AppContext.Provider value={contextValue}>
            <BrowserRouter>
                <Nav />
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/podcast/:slug" element={<PodcastPage />} />
                    <Route path="/episode/:slug" element={<EpisodePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </BrowserRouter>
        </AppContext.Provider>
    )
}

export default App
