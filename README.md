# 🎙️ PodIntel - AI-Powered Podcast Intelligence

PodIntel is a personalized podcast intelligence tool that generates AI summaries and content ideas tailored to your unique writing style. It integrates with [podscripts.co](https://podscripts.co) for podcast transcripts and uses Claude AI for intelligent analysis.

![PodIntel Screenshot](docs/screenshot.png)

## ✨ Features

- **🔍 Podcast Search** - Search for any podcast available on podscripts.co
- **📝 Full Transcripts** - Read timestamped transcripts of any episode
- **🤖 AI Summaries** - Generate personalized summaries using Claude AI
- **💡 Content Ideas** - Get content creation ideas based on episode insights
- **✍️ Writing Style Matching** - AI adapts to YOUR writing style from samples
- **🎨 Brand Templates** - Create optional brand voices for different content needs
- **📡 Podcast Subscriptions** - Subscribe to podcasts and track new episodes

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Claude API Key** from [Anthropic](https://console.anthropic.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/podintel.git
   cd podintel
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Start the development servers**

   In one terminal (server):
   ```bash
   cd server
   npm run dev
   ```

   In another terminal (client):
   ```bash
   cd client
   npm run dev
   ```

5. **Open the app** at [http://localhost:5173](http://localhost:5173)

---

## ⚙️ Configuration

### Step 1: Add Your Claude API Key 🔑

1. Go to **Settings** in the app (gear icon in navigation)
2. Enter your **Claude API Key** from [console.anthropic.com](https://console.anthropic.com/)
3. Click **Save Settings**

> **Note:** Your API key is stored locally in your browser (localStorage) and is never sent to any server except Anthropic's API when generating summaries.

### Step 2: Upload Writing Samples ✍️

This is what makes PodIntel special - it learns YOUR writing style!

1. Go to **Settings** → **Writing Samples** section
2. Paste 2-3 samples of your writing (blog posts, newsletters, social posts)
3. Click **Analyze Writing Style**

The AI will analyze your samples and create a writing profile that includes:
- Your typical tone and voice
- Sentence structure preferences
- Vocabulary patterns
- Content formatting style

### Step 3: Brand Templates (Optional) 🎨

If you create content for different brands or contexts, you can set up templates:

1. Go to **Settings** → **Brand Templates**
2. Click **+ Add Template**
3. Define:
   - **Template Name** (e.g., "LinkedIn Posts", "Newsletter")
   - **Tone** (Professional, Conversational, Casual, etc.)
   - **Custom Instructions** (any specific guidelines)

When generating summaries, you can choose which brand template to apply.

---

## 📖 How to Use

### 1. Search & Subscribe to Podcasts
- Use the **Search** page to find podcasts
- Click **+ Subscribe** to add them to your dashboard

### 2. Browse Episodes
- Click on a podcast to see all episodes
- Episodes with saved transcripts are marked with 📝

### 3. Generate AI Summaries
- Open any episode to view its transcript
- Click **🤖 Generate AI Summary** 
- (Optional) Select a brand template if you have them set up
- The AI will generate:
  - **Key Takeaways** - Main insights from the episode
  - **Relevance to Your Content** - How this applies to your work
  - **Quotable Moments** - Shareable quotes
  - **Content Ideas** - Specific content you could create

### 4. Export Summaries
- Click **📧 Email Summary** to send insights to yourself via Gmail

---

## 🏗️ Project Structure

```
podintel/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx        # Main React application
│   │   └── index.css      # Styling
│   └── package.json
│
├── server/                 # Express backend
│   ├── routes/
│   │   └── podcasts.js    # API routes
│   ├── services/
│   │   └── claude.js      # Claude AI integration
│   ├── data/              # Local cache (gitignored)
│   ├── index.js           # Server entry point
│   └── package.json
│
└── README.md
```

---

## 🔒 Privacy & Security

- **API Key Storage**: Your Claude API key is stored only in your browser's localStorage
- **No External Tracking**: No analytics or tracking - your data stays local
- **Cached Data**: Transcripts are cached locally to reduce API calls to podscripts.co

---

## 🛠️ Development

### Tech Stack
- **Frontend**: React 18, Vite, Vanilla CSS
- **Backend**: Node.js, Express
- **AI**: Claude 3.5 Sonnet via Anthropic API
- **Data Source**: podscripts.co (podcast transcripts)

### Available Scripts

**Server:**
```bash
npm run dev    # Start development server with nodemon
npm start      # Start production server
```

**Client:**
```bash
npm run dev    # Start Vite dev server
npm run build  # Build for production
npm run preview # Preview production build
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

---

## 🙏 Acknowledgments

- [podscripts.co](https://podscripts.co) for providing podcast transcripts
- [Anthropic](https://anthropic.com) for Claude AI
