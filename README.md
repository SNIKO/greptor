# Greptor

> **Grep + Raptor**: Transform messy, unstructured text into clean, grep-friendly data for agentic search workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/greptor.svg)](https://www.npmjs.com/package/greptor)

Claude Code has proven that agentic search (`ripgrep` + filesystem traversal + iterative investigation) is powerful enough for complex code navigation tasks. But what about **textual data** like documents, transcripts, posts, articles, notes, and reports?

Greptor is a library that helps you with this. It **ingests and indexes unstructured text** into a format that agents can easily search using simple tools like `ripgrep`.

## Why Agentic Search (and Why Not Classic RAG)?

RAG worked around small context windows by chunking documents and retrieving "relevant" fragments. That approach has recurring pain points:

- **Chunking breaks structure**: Tables, section hierarchies, and cross-references get lost.
- **Embeddings are fuzzy**: They struggle with exact terms, numbers, and identifiers.
- **Complexity overhead**: Hybrid search + rerankers add latency, cost, and moving parts.
- **Error cascade**: If retrieval misses the right chunk, the answer can't be correct.

Agentic search flips the approach: with larger context windows and better tool use, agents can **search, open files, follow references, and refine queries** — more like a human analyst.

Greptor's job is to clean, chunk, and add structure to your documents, making them **easily searchable with text tools** like `ripgrep`. No complex indices, no retrievers, no vector databases. Just **minimal initial processing + maximal grep-ability**.

## How It Works

### Step 1: Install

```bash
npm install greptor
# or
bun add greptor
```

### Step 2: Initialize

Create a Greptor instance with your base directory, topic, and LLM model.

```typescript
import { createGreptor } from 'greptor';

// Create Greptor instance
const greptor = await createGreptor({
  baseDir: './projects/investing',
  topic: 'Investing, stock market, financial, and macroeconomics',
  llmModel: 'openai:gpt-5-mini'
});
```

- **`baseDir`**: Home directory for your project where all data will be stored.
- **`topic`**: Helps Greptor understand your data better and generate a relevant metadata schema.
- **`llmModel`**: OpenAI-compatible model for chunking and metadata extraction. You must provide an API key via environment variables.

### Step 3: Start Feeding Documents

```typescript
await greptor.eat({
  id: 'QwwVJfvfqN8',
  source: 'youtube',
  publisher: '@JosephCarlsonShow',
  format: 'text',
  label: 'Top Five AI Stocks I\'m Buying Now',
  content: '{fetch and populate video transcript here}',
  creationDate: new Date('2025-11-15'),
  metadata: {
    // Optional custom metadata specific to the source or document
    channelTitle: 'Joseph Carlson',
    channelSubscribers: 496000
  },
});

await greptor.eat({
  id: 'tesla_reports_418227_deliveries_for_the_fourth',
  source: 'reddit',
  publisher: 'investing',  // For Reddit, publisher is the subreddit name
  format: 'text',
  label: 'Tesla reports 418,227 deliveries for the fourth quarter, down 16%',
  content: '{fetch and populate Reddit post with comments here}',
  creationDate: new Date('2025-12-03'),
  metadata: {
    // Optional custom metadata
    upvotes: 1400
  },
});
```

### Step 4: Wait for Background Processing

Greptor will write your input to a raw Markdown file immediately, then run background enrichment (LLM cleaning + chunking + metadata extraction) and write a processed Markdown file. You can grep the raw files right away, and the processed files will appear shortly after.

### Step 5: Generate a Claude Code Skill

```typescript
await greptor.createSkill(['youtube', 'reddit']);
```

This generates a Claude Code skill that instructs agents on how to search your indexed content effectively.

The skill is customized for the sources you provide and includes search tips based on the metadata schema. You can always customize it manually further for better results.

### Step 6: Run the Agent

By this point, you should have the following structure in your `baseDir`:

```
./projects/investing/
  .claude/
    skills/
      search-youtube-reddit/
        SKILL.md
  content/
    raw/
      youtube/
        JosephCarlsonShow/
          2025-12/
            2025-12-01-Top-Five-AI-Stocks-Im-Buying-Now.md
      reddit/
        investing/
          2025-12/
            2025-12-03-Tesla-reports-418227-deliveries-for-the-fourth-quarter-down-16.md
    processed/
      youtube/
        JosephCarlsonShow/
          2025-12/
            2025-12-01-Top-Five-AI-Stocks-Im-Buying-Now.md
      reddit/
        investing/
          2025-12/
            2025-12-03-Tesla-reports-418227-deliveries-for-the-fourth-quarter-down-16.md
```

Now run Claude Code (or any other agent) in this folder and ask questions about your data or perform research tasks!

**Note**: For other agents, you may need to adapt the skill accordingly.

**For better results**:
1. Connect MCP servers like Yahoo Finance or other relevant financial/stock market MCP servers for up-to-date information.
2. Add personal financial information, such as your portfolio holdings, watchlists, and risk profile.
3. Create custom skills, slash commands, or subagents for researching specific tickers, sectors, topics, or managing your portfolio.

Now you have a personal investment research assistant with access to your portfolio, sentiment data (YouTube, Reddit), news, and market data! You don't have to manually watch dozens of YouTube channels or spend hours scrolling Reddit and other sources.

## Under the Hood

### 1) Raw Write (Immediate)

`eat()` writes the input to a raw Markdown file with YAML frontmatter. You can grep it right away.

### 2) Background Processing (Asynchronous)

Workers pick up new documents and run a one-time pipeline:

1. **LLM cleaning**: Remove timestamps, ads, disclaimers, boilerplate, and irrelevant content.
2. **LLM chunking**: Transform a blob into semantic section chunks.
3. **LLM metadata extraction**: Extract metadata relevant to your topic/domain and enrich each chunk with denormalized metadata.

Here's an example of a processed file:

```markdown
---
title: "NVIDIA Q4 2024 Earnings: AI Boom Continues"
source: "youtube"
publisher: "Wall Street Millennial"
date: 2025-11-15
ticker: "NVDA"
videoId: "dQw4w9WgXcQ"
url: "https://youtube.com/watch?v=dQw4w9WgXcQ"
chunks:
  - id: c01
    title: "Revenue Growth Analysis"
    topics: [earnings, revenue, data-center]
    sentiment: positive
    tickers: [NVDA]
    price_mentioned_usd: 850.50
    revenue_mentioned_billions: 35.1
  - id: c02
    title: "AI Chip Demand Outlook"
    topics: [ai, competition, market-share]
    sentiment: bullish
    tickers: [NVDA, AMD, INTC]
    timeframe: next-quarter
---

CHUNK c01: "Revenue Growth Analysis"
NVIDIA reported Q4 revenue of $35.1 billion, beating estimates...

CHUNK c02: "AI Chip Demand Outlook"
The demand for AI accelerators continues to outpace supply...
```

### 3) Navigate with grep/glob

Your "index" is the YAML frontmatter combined with the file layout. Agents can search it deterministically.

**Search examples**:

```bash
# Find all bullish sentiment for TSLA stock
rg -l "ticker:.*TSLA" content/processed | xargs rg "sentiment:.*bullish"

# Count documents per ticker
rg "ticker:" content/processed -o | sort | uniq -c | sort -rn | head -20

# What companies does a specific YouTuber discuss?
rg "company:" content/processed/youtube/JosephCarlsonShow -o | sort | uniq -c | sort -rn

# Find all AI-related narratives with strong buy recommendations
rg -l "narrative:.*ai_boom" content/processed | xargs rg "recommendation:.*strong_buy"

# Technology sector stocks with bullish sentiment in December 2025
rg -l "sector:.*technology" content/processed --glob "**/2025-12/*.md" | xargs rg "sentiment:.*bullish"

# Find dividend investment style discussions
rg "investment_style:.*dividend" content/processed -l | head -10

# Bearish sentiment on large-cap stocks
rg -l "market_cap:.*large_cap" content/processed | xargs rg "sentiment:.*bearish"

# List all tickers mentioned with their sentiment
rg "ticker: \[.*\]" content/processed -A 5 | rg "sentiment:"

# Find EV-related discussions across all sources
rg "narrative:.*ev_transition" content/processed

# Combine multiple filters: tech stocks with strong buy in specific timeframe
rg -l "sector:.*technology" content/processed --glob "**/2025-11/*.md" | \
  xargs rg -l "recommendation:.*strong_buy" | \
  xargs rg "ticker:" -o | sort | uniq -c
```

**Analysis patterns**:

```bash
# Aggregate sentiment distribution
rg "sentiment:" content/processed -o | cut -d: -f2 | tr -d ' ' | sort | uniq -c

# Most discussed sectors
rg "sector:" content/processed -o | sort | uniq -c | sort -rn

# Track narrative evolution over time
for month in 2025-{10..12}; do
  echo "=== $month ==="
  rg "narrative:" content/processed --glob "**/$month-*/*.md" -o | sort | uniq -c | sort -rn | head -5
done

# Compare sentiment on specific stock across sources
for source in youtube reddit; do
  echo "=== $source ==="
  rg -l "ticker:.*AAPL" content/processed/$source | xargs rg "sentiment:" -o | sort | uniq -c
done
```

## Configuration

### LLM Model Format

Greptor uses the following LLM model format: `provider:model-name`

The provider is an OpenAI API-compatible provider, such as `openai`, `azure`, `ollama`, `deepseek`, etc.

**Examples**:

```typescript
llmModel: 'openai:gpt-5-mini'
llmModel: 'ollama:llama3-70b'
```

**Important**: Use a model at least at the level of GPT-5-mini or better.
**Required Environment Variables**:

```bash
# For OpenAI models
OPENAI_API_KEY=your_key_here

# For Azure OpenAI models
AZURE_API_KEY=your_key_here
AZURE_API_BASE_URL=https://your-azure-endpoint.com/v1
```

## Metadata Schemas

If you don't provide a schema, Greptor can initialize one for your topic. However, for better results, provide a custom schema.

Here's a comprehensive example for investment research:

```typescript
const greptor = await createGreptor({
  baseDir: './projects/investing',
  topic: 'Investing, stock market, financial, and macroeconomics',
  llmModel: 'openai:gpt-5-mini',
  metadataSchema: [
    {
      name: 'company',
      type: 'string[]',
      description: 'Canonical company names in snake_case (e.g. apple, tesla, microsoft)',
    },
    {
      name: 'ticker',
      type: 'string[]',
      description: 'Canonical stock tickers, UPPERCASE only (e.g. AAPL, TSLA, MSFT, SPY)',
    },
    {
      name: 'sector',
      type: 'enum[]',
      description: 'GICS sector classification for stocks/companies discussed',
      enumValues: [
        'technology', 'healthcare', 'financials', 'consumer_discretionary',
        'consumer_staples', 'energy', 'utilities', 'industrials',
        'materials', 'real_estate', 'communication_services',
        'etf', 'index', 'commodity', 'bond', 'mixed'
      ],
    },
    {
      name: 'industry',
      type: 'string[]',
      description: 'Specific industry/sub-sector in snake_case (e.g. semiconductors, biotech, banking)',
    },
    {
      name: 'market_cap',
      type: 'enum[]',
      description: 'Market capitalization category of the company',
      enumValues: ['mega_cap', 'large_cap', 'mid_cap', 'small_cap', 'micro_cap'],
    },
    {
      name: 'investment_style',
      type: 'enum[]',
      description: 'Investment approach or style discussed',
      enumValues: [
        'value', 'growth', 'dividend', 'momentum', 'index',
        'passive', 'active', 'day_trading', 'swing_trading', 'long_term_hold'
      ],
    },
    {
      name: 'asset_type',
      type: 'enum[]',
      description: 'Type of financial instrument discussed',
      enumValues: [
        'stock', 'etf', 'mutual_fund', 'option', 'bond',
        'reit', 'commodity', 'crypto', 'cash'
      ],
    },
    {
      name: 'narrative',
      type: 'string[]',
      description: 'Investment or market narratives in snake_case (e.g. ai_boom, ev_transition, rate_cuts)',
    },
    {
      name: 'sentiment',
      type: 'enum[]',
      description: 'Directional stance on the stock/market',
      enumValues: ['bullish', 'bearish', 'neutral', 'mixed', 'cautious'],
    },
    {
      name: 'recommendation',
      type: 'enum[]',
      description: 'Analyst or influencer recommendation type',
      enumValues: ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'],
    },
  ],
});
```

## License

MIT © Sergii Vashchyshchuk