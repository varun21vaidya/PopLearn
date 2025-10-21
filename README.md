# POPLEARN: Interactive Learning Chrome Extension
==========================================

Quickstart
----------
1) Open Chrome > Extensions > Manage Extensions > enable Developer mode.
2) Click "Load unpacked" and select this project folder.
3) Pin the extension. Open any article page.
4) Click the toolbar icon and choose: Simplify Article, Build Mindmap, or Test Knowledge.


https://github.com/user-attachments/assets/007b42aa-7508-45d5-9dd3-f5aec525fdbd


How it works
------------
- Popup (`popup/popup.html`) sends an action to the active tab.
- Content script (`content/content.js`) extracts page text, then:
  - uses Chrome Built‑in AI Summarizer API when available to create a summary; falls back to extractive heuristics.
  - generates a lightweight SVG mindmap from top topics.
  - builds 5 MCQs via Prompt API when available; falls back to topic-based questions.
- Background worker (`background/background.js`) provides right‑click context menus for the same actions.

APIs and privacy
----------------
- Prefers on‑device Chrome Built‑in AI (Summarizer, Prompt). No network calls for core flows.
- Optional external calls can be implemented in `utils/api-client.js`.
- Minimal permissions: `activeTab`, `storage`, `scripting`.

Notes
-----
- This is a minimal scaffold aimed at the Google Chrome Built‑in AI Challenge 2025. You can extend with Proofreader/Translator/Writer/Rewriter APIs and richer UIs.

## 🎯 Project Overview

The Interactive Learning Extension transforms any webpage into an interactive learning experience by providing three key features:

1. **📝 Simplify Article** - Clean, summarized version of the content
2. **🧠 Build Mindmap** - Visual concept mapping and timeline diagrams  
3. **❓ Test Knowledge** - AI-generated MCQ quizzes based on the content

## 🏗️ Architecture Overview

### Core Components

- **manifest.json** - Extension configuration and permissions
- **popup/** - User interface (HTML, CSS, JS)
- **content/** - Content scripts for text extraction and processing
- **background/** - Service worker for API calls and data management
- **libs/** - Third-party libraries (Readability.js, D3.js, etc.)
- **windows/** - Floating window interfaces for each feature

### Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Chrome APIs**: tabs, storage, scripting, action, runtime
- **Text Processing**: Mozilla Readability.js, Browser Summarizer API
- **Visualization**: D3.js or jsMind.js for mindmaps
- **AI Integration**: OpenAI GPT, Google AI Studio, or local NLP

## 🚀 Key Features & Functionality

### 1. Intelligent Text Extraction
- Uses Mozilla Readability.js for clean content extraction
- Works on articles, blogs, news sites, academic papers
- Handles various content formats and layouts
- Filters out ads, navigation, and irrelevant content

### 2. Advanced Summarization
- Primary: Browser's native Summarizer API (Chrome 121+)
- Fallback: Extractive summarization algorithms
- Alternative: OpenAI or Cohere API integration
- Customizable summary length and style

### 3. Interactive Mindmaps
- Automatic topic extraction from content
- Hierarchical visualization with D3.js or jsMind
- Interactive nodes with hover effects
- Export functionality (PNG, SVG)
- Different layout options (radial, tree)

### 4. Adaptive Quiz Generation
- AI-powered question generation
- Multiple question types (MCQ, True/False, Fill-in-blank)
- Difficulty level adjustment
- Real-time scoring and feedback
- Performance analytics and history

### 5. User Experience Features
- Floating, draggable windows
- Responsive design for all screen sizes
- Reading completion detection
- Automatic learning prompts
- Dark/light theme support
- Accessibility compliance (ARIA labels, keyboard navigation)

## 🔧 Technical Implementation Details

### File Structure
```
interactive-learning-extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/
│   ├── content.js
│   └── content.css
├── background/
│   └── background.js
├── libs/
│   ├── readability.js
│   ├── jsmind.js
│   └── d3.min.js
├── windows/
│   ├── simplified-text.html
│   ├── mindmap.html
│   └── quiz.html
├── utils/
│   ├── api-client.js
│   ├── storage.js
│   └── dom-utils.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### API Integration Options

**Text Summarization:**
- Primary: `window.ai.summarizer` (Browser native)
- Secondary: OpenAI GPT-3.5/4 API
- Fallback: Local extractive algorithms

**Question Generation:**
- OpenAI GPT for high-quality questions
- Google AI Studio (Gemini) for free tier
- Local NLP libraries for offline functionality

**Visualization:**
- jsMind.js for lightweight mindmaps
- D3.js for advanced customization
- vis.js for timeline visualizations

## 🧪 Testing Strategy

### Automated Testing
- Unit tests for core functions
- Integration tests for API calls
- Performance benchmarks
- Memory leak detection

### Manual Testing
- Functionality across different websites
- Cross-browser compatibility
- User experience validation
- Accessibility compliance
- Security vulnerability assessment

### User Testing
- Beta testing with target audience
- Usability studies
- Feedback collection and integration
- Iterative improvements

## 🛡️ Security & Privacy

### Data Protection
- Minimal data collection
- Local processing when possible
- Secure API key management
- No tracking or analytics without consent

### Extension Security
- Content Security Policy implementation
- Input sanitization and validation
- Permission minimization
- Regular security audits

## 📈 Success Metrics

### User Engagement
- Extension usage frequency
- Feature adoption rates
- Session duration
- User retention

### Educational Impact
- Quiz completion rates
- Learning outcome improvements
- User feedback scores
- Academic institution adoption

## 🚀 Deployment & Distribution

### Chrome Web Store
- Complete store listing optimization
- Screenshots and demo videos
- User onboarding flow
- Regular updates and maintenance

### Future Expansion
- Firefox and Safari versions
- Mobile browser support
- Educational institution partnerships
- Premium feature tiers

## 💡 Innovation Opportunities

### Advanced Features
- Multi-language support
- Collaborative learning tools
- Integration with Learning Management Systems
- Voice narration and audio summaries
- Adaptive learning algorithms

### AI Enhancements
- Personalized content recommendations
- Learning style adaptation
- Progress prediction and optimization
- Automated study schedule generation

## 🎯 Business Model Options

### Freemium Model
- Basic features free
- Advanced AI features premium
- Educational institution licenses
- API usage tiers

### Educational Partnerships
- Integration with schools and universities
- Bulk licensing for educational institutions
- Custom features for academic use
- Research collaboration opportunities

---

This comprehensive plan provides everything needed to build a full-scale Chrome extension that transforms web reading into an interactive learning experience. The modular architecture, detailed implementation guide, and thorough testing strategy ensure a professional, scalable solution that can serve millions of users while maintaining high performance and security standards.
