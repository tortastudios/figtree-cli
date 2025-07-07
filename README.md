# 🌳 figtree

**Extract design tokens from Figma and convert them to clean, production-ready code. No plugins or Dev Mode required.**

## Why we built this

Figtree makes it easy to turn your Figma styles (colors, text, effects, gradients) into real, usable code for your app. Whether you're working with Tailwind, CSS, Swift, or Android, Figtree saves you time by extracting design tokens directly from your Figma files.

No extra tools. No copy-pasting. Just your Figma token and this CLI.

**What this tool does:**

- Reads design styles from any Figma file (colors, text, effects, spacing)
- Converts them into multiple code formats: CSS, Tailwind, SwiftUI, Android XML, JSON
- Optionally uses AI (like GPT or Claude) to generate polished code for you
- Works with personal Figma tokens

**Instead of:**

- ❌ Installing Figma plugins
- ❌ Copying styles manually
- ❌ Maintaining parallel style systems

**You get:**

- ✅ Fast, accurate design token extraction
- ✅ AI-generated or prompt-based code
- ✅ Multiple format options
- ✅ Fully local control (nothing gets sent unless you use an AI provider)

## Quick Start

### 1. Get your Figma token (free)

1. Go to [Figma Settings](https://www.figma.com/developers/api#access-tokens)
2. Click "Create new personal access token"
3. Name it "figtree" and copy the token

### 2. Install and run

```bash
npm install -g figtree-cli
figtree
```

That's it! The tool will walk you through everything.

## How it works

### Step 1: Connect to Figma

- Paste your Figma file URL or file key (both work!)
  - **Full URL**: `https://www.figma.com/design/FVt1g2IuPzKJeQu8QlIGlA/My-Design`
  - **File key only**: `FVt1g2IuPzKJeQu8QlIGlA`
- Tool reads all your colors, fonts, and effects
- Shows you a summary of what it found

### Step 2: Choose how to generate code

**Option A: AI does it for you**

- Add an AI API key (OpenAI, Claude, etc.)
- Pick your format (CSS, Tailwind, Swift, etc.)
- Get perfect code written automatically

**Option B: Copy-paste to any AI**

- Get a smart prompt to copy
- Paste into ChatGPT, Claude, or any AI
- Still get great code, just manually

### Step 3: Use your code

- Code gets saved to a file
- Copy into your app
- Your design system is now code!

## What you can export

**From Figma:**

- Colors (solid, gradients, images)
- Text styles (fonts, sizes, weights)
- Effects (shadows, blurs, etc.)
- Layout grids and spacing

**To these formats:**

- **CSS** - Custom properties and classes
- **SCSS** - Variables and mixins
- **Tailwind** - Complete config file
- **JavaScript** - ES modules with types
- **JSON** - Design token standard
- **Android XML** - Resource files
- **SwiftUI** - Color and font extensions

## Setup

### Basic setup (required)

```bash
# Install
npm install -g figtree-cli

# Copy environment file and add your Figma token
cp .env.example .env
# Edit .env and add: FIGMA_TOKEN=your_figma_token_here
```

### AI setup (optional but recommended)

Add one or more AI provider keys to your .env file for automatic code generation:

```bash
# Add to your .env file (you only need one):
OPENAI_API_KEY=your-openai-key-here
ANTHROPIC_API_KEY=your-claude-key-here
GOOGLE_API_KEY=your-gemini-key-here
DEEPSEEK_API_KEY=your-deepseek-key-here
```

The tool will automatically detect which providers you have configured.

## Commands

```bash
# Interactive mode (easiest)
figtree

# Quick help
figtree --help

# Show version
figtree --version

# Use specific file
figtree --output my-styles.css

# Use different token
figtree --token your-figma-token

# Debug mode
figtree --debug
```

**Pro tip**: When the tool asks for your Figma file key, you can paste either:

- The full Figma URL: `https://www.figma.com/design/FVt1g2IuPzKJeQu8QlIGlA/My-Design`
- Just the file key: `FVt1g2IuPzKJeQu8QlIGlA`

The tool will automatically extract the file key from the URL if needed!

## Examples

### What gets extracted from Figma

```json
{
  "colors": [
    { "name": "Primary Blue", "hex": "#007AFF", "css": "rgb(0, 122, 255)" },
    { "name": "Success Green", "hex": "#34C759", "css": "rgb(52, 199, 89)" }
  ],
  "typography": [
    {
      "name": "Heading Large",
      "fontSize": 32,
      "fontFamily": "SF Pro Display",
      "fontWeight": "bold"
    }
  ],
  "effects": [
    {
      "name": "Card Shadow",
      "type": "DROP_SHADOW",
      "color": "#000000",
      "opacity": 0.1
    }
  ]
}
```

### What you get as CSS

```css
/* Colors */
:root {
  --color-primary-blue: #007aff;
  --color-success-green: #34c759;
}

/* Typography */
.heading-large {
  font-family: "SF Pro Display", system-ui;
  font-size: 2rem;
  font-weight: bold;
  line-height: 1.2;
}

/* Effects */
.card-shadow {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
```

### What you get as Tailwind

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        "primary-blue": "#007AFF",
        "success-green": "#34C759",
      },
      fontSize: {
        "heading-large": ["2rem", { lineHeight: "1.2", fontWeight: "bold" }],
      },
      boxShadow: {
        card: "0 4px 8px rgba(0, 0, 0, 0.1)",
      },
    },
  },
};
```

## Features

**Smart extraction:**

- Gets all paint types (solid, gradient, image)
- Extracts complete font information
- Handles all effect types (shadows, blurs, etc.)
- Compresses large files automatically

**AI integration:**

- Latest models (o4, Opus 4, Gemini 2.5 Pro)
- Smart prompts for better code
- Automatic error handling
- Falls back to manual prompts

**Production ready:**

- Professional error handling
- Debug mode for troubleshooting
- Token usage optimization
- File chunking for large projects

## Troubleshooting

**"Invalid Figma token"**

- Check your token is copied correctly
- Make sure it's a personal access token, not a team token
- Generate a new one if needed

**"File not found"**

- Make sure the Figma file is public or you have access
- Check the file URL is correct
- Try with a different file

**"No styles found"**

- File might not have any defined styles
- Try a file with colors and text styles
- Check if styles are in components or just local styles

**"AI generation failed"**

- Check your AI API key is valid
- Make sure you have credits/quota left
- Tool will offer manual prompt as backup

**"File too large"**

- Tool automatically splits large files
- If still issues, try with a smaller file first
- Check debug mode to see token usage

## 🛠️ Development

### Project structure

```
figtree/
├── bin/figtree.js          # Main CLI entry
├── src/
│   ├── index.js            # Main app flow
│   ├── figma.js            # Figma API calls
│   ├── prompts.js          # User interaction
│   ├── ai-providers.js     # AI integrations
│   ├── export.js           # Prompt generation
│   ├── logger.js           # Logging system
│   ├── validation.js       # Input validation
│   ├── config.js           # Configuration
│   ├── constants.js        # App constants
│   └── errors.js           # Error handling
└── package.json
```

### Running locally

```bash
# Clone and install
git clone <repo-url>
cd figtree
npm install

# Run development version
npm start

# Run tests (when available)
npm test

# Lint code
npm run lint
```

### Adding new output formats

1. Add format to `chooseCodeFormat()` in `src/prompts.js`
2. Add case in `createPrompt()` in `src/ai-providers.js`
3. Add file extension in `saveCodeToFile()`
4. Test with sample Figma file

### Adding new AI providers

1. Add provider config to `AI_PROVIDERS` in `src/ai-providers.js`
2. Add environment variable check
3. Update documentation
4. Test with real API key

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repo
2. Create feature branch: `git checkout -b my-feature`
3. Make changes and test locally
4. Commit: `git commit -m 'Add my feature'`
5. Push: `git push origin my-feature`
6. Open Pull Request

### Code style

- Use simple, clear variable names
- Add comments for complex logic
- Keep functions small and focused
- Use logger instead of console.log
- Add error handling for all async operations

### Testing

- Test with real Figma files
- Try different file sizes
- Test all output formats
- Verify AI providers work
- Check error scenarios

## 📄 License

This project is licensed under the Business Source License 1.1. See the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ to help designers and developers work better together.**

Get started: `npm install -g figtree-cli`
