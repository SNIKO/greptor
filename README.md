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

Create a Greptor instance with your base directory, topic, and AI SDK language model.

```typescript
import { createGreptor } from 'greptor';
import { openai } from "@ai-sdk/openai";

// Create Greptor instance
const greptor = await createGreptor({
  baseDir: './projects/investing',
  topic: 'Investing, stock market, financial, and macroeconomics',
  model: openai("gpt-5-mini"),
});
```

- **`baseDir`**: Home directory for your project where all data will be stored.
- **`topic`**: Helps Greptor understand your data better and generate a relevant tag schema.
- **`model`**: A `LanguageModel` instance from [Vercel AI SDK](https://ai-sdk.dev).

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
  tags: {
    // Optional custom tags specific to the source or document
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
  tags: {
    // Optional custom tags
    upvotes: 1400
  },
});
```

### Step 4: Wait for Background Processing

Greptor will write your input to a raw Markdown file immediately, then run background enrichment (LLM cleaning + chunking + tagging) and write a processed Markdown file. You can grep the raw files right away, and the processed files will appear shortly after.

### Step 5: Generate a Claude Code Skill

```typescript
await greptor.createSkill(['youtube', 'reddit']);
```

This generates a Claude Code skill that instructs agents on how to search your indexed content effectively.

The skill is customized for the sources you provide and includes search tips based on the tag schema. You can always customize it manually further for better results.

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

1. **LLM clean + chunk + tag (single prompt)**: Remove boilerplate, split into semantic chunks, and inline grep-friendly per-chunk tags.

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
---

## 01 Revenue Growth Analysis
topics=earnings,revenue,data_center
sentiment=positive
tickers=NVDA

NVIDIA reported Q4 revenue of $35.1 billion, beating estimates...

## 02 AI Chip Demand Outlook
topics=ai,competition,market_share
sentiment=bullish
tickers=NVDA,AMD,INTC
timeframe=next_quarter

The demand for AI accelerators continues to outpace supply...
```

### 3) Navigate with grep/glob

Your "index" is the YAML frontmatter (document-level) plus the per-chunk tag lines. Agents can search it deterministically.

**Basic search examples**:

```bash
# Simple tag search with context
rg -n -C 6 "ticker=NVDA" content/processed/

# Search for any value in a tag field
rg -n -C 6 "sentiment=" content/processed/

# Case-insensitive full-text search
rg -i -n -C 3 "artificial intelligence" content/processed/

# Search within a specific source
rg -n -C 6 "sector=technology" content/processed/youtube/
```

**Date-filtered searches**:

```bash
# Content from December 2025
rg -n -C 6 "ticker=TSLA" content/processed/ --glob "**/2025-12/*.md"

# Q4 2025 content
rg -n -C 6 "sentiment=bullish" content/processed/ --glob "**/2025-1[0-2]/*.md"

# Specific month and source
rg -n -C 6 "asset_type=etf" content/processed/reddit/ --glob "**/2025-11/*.md"
```

**Combined tag filters**:

```bash
# Match chunks with two specific tags (using file list)
rg -l "sector=technology" content/processed/ | xargs rg -n -C 6 "sentiment=bullish"

# Pipeline filter for complex queries
rg -n -C 6 "ticker=AAPL" content/processed/ | rg "recommendation=.*buy"

# Three-way filter: tech stocks with bullish sentiment and buy recommendation
rg -l "sector=technology" content/processed/ | xargs rg -l "sentiment=bullish" | xargs rg -n -C 6 "recommendation=buy"

# Find AI narrative discussions with specific tickers
rg -n -C 6 "narrative=.*ai" content/processed/ | rg "ticker=NVDA\|ticker=.*,NVDA"
```

**Discovery and exploration**:

```bash
# List all unique tickers mentioned
rg -o "ticker=[^\n]+" content/processed/ | cut -d= -f2 | tr ',' '\n' | sort -u

# Count occurrences of each sentiment
rg -o "sentiment=[^\n]+" content/processed/ | cut -d= -f2 | sort | uniq -c | sort -rn

# Top 20 most discussed companies
rg -o "company=[^\n]+" content/processed/ | cut -d= -f2 | tr ',' '\n' | sort | uniq -c | sort -rn | head -20

# Find all files discussing dividend investing
rg -l "investment_style=dividend" content/processed/

# See what narratives exist in the data
rg -o "narrative=[^\n]+" content/processed/ | cut -d= -f2 | tr ',' '\n' | sort -u
```

**Analysis patterns**:

```bash
# Sentiment distribution for a specific ticker
rg -n -C 6 "ticker=TSLA" content/processed/ | rg -o "sentiment=[^\n]+" | cut -d= -f2 | sort | uniq -c

# Most discussed sectors
rg -o "sector=[^\n]+" content/processed/ | cut -d= -f2 | tr ',' '\n' | sort | uniq -c | sort -rn

# Track narrative evolution over time
for month in 2025-{10..12}; do
  echo "=== $month ==="
  rg -o "narrative=[^\n]+" content/processed/ --glob "**/$month/*.md" | cut -d= -f2 | tr ',' '\n' | sort | uniq -c | sort -rn | head -5
done

# Compare sentiment across sources for a stock
for source in youtube reddit; do
  echo "=== $source ==="
  rg -n -C 6 "ticker=AAPL" content/processed/$source/ | rg -o "sentiment=[^\n]+" | cut -d= -f2 | tr ',' '\n' | sort | uniq -c
done

# Find all strong buy recommendations by sector
for sector in technology healthcare financials; do
  echo "=== $sector ==="
  rg -l "sector=$sector" content/processed/ | xargs rg -n -C 3 "recommendation=strong_buy" | head -5
done
```

**Advanced multi-criteria searches**:

```bash
# Large-cap tech stocks with bullish sentiment
rg -l "market_cap=large_cap" content/processed/ | xargs rg -l "sector=technology" | xargs rg -n -C 6 "sentiment=bullish"

# Growth investing discussions about mega-cap stocks
rg -n -C 6 "investment_style=growth" content/processed/ | rg "market_cap=mega_cap"

# ETF recommendations from specific time period
rg -n -C 6 "asset_type=etf" content/processed/ --glob "**/2025-12/*.md" | rg "recommendation=buy\|recommendation=strong_buy"

# Bearish sentiment on specific narrative
rg -n -C 6 "narrative=ev_transition" content/processed/ | rg "sentiment=bearish"
```

## Configuration

### Event Hooks

Greptor provides optional hooks to monitor the ingestion and processing pipeline. These are useful for logging, metrics, progress tracking, or building custom UIs.

```typescript
const greptor = await createGreptor({
  baseDir: './projects/investing',
  topic: 'Investing, stock market, financial, and macroeconomics',
  model: openai("gpt-5-mini"),
  hooks: {
    onProcessingRunStarted: ({ documentsToProcess, totalDocuments }) => {
      console.log(`📋 Starting processing run: ${documentsToProcess} documents queued`);
    },
    
    onDocumentProcessingStarted: ({ source, publisher, label, successful, failed, queueSize }) => {
      const processed = successful + failed;
      console.log(`[${processed}/${queueSize}] Processing: ${source}/${publisher}/${label}`);
    },
    
    onDocumentProcessingCompleted: ({ 
      success, 
      label, 
      successful, 
      failed, 
      queueSize,
      elapsedMs,
      inputTokens,
      outputTokens,
      totalTokens
    }) => {
      const processed = successful + failed;
      const status = success ? '✓' : '✗';
      console.log(
        `[${processed}/${queueSize}] ${status} ${label} (${elapsedMs}ms, ${totalTokens} tokens)`
      );
    },
    
    onProcessingRunCompleted: ({ successful, failed, elapsedMs }) => {
      const total = successful + failed;
      console.log(
        `✨ Run complete: ${successful}/${total} succeeded in ${(elapsedMs / 1000).toFixed(1)}s`
      );
      if (failed > 0) {
        console.log(`⚠️  ${failed} documents failed`);
      }
    },
    
    onError: ({ error, context }) => {
      if (context?.label) {
        console.error(`❌ Error processing ${context.label}: ${error.message}`);
      } else {
        console.error(`❌ Error: ${error.message}`);
      }
    },
  },
});
```

#### Available Hooks

| Hook | When Called | Event Data |
|------|-------------|------------|
| `onProcessingRunStarted` | When background workers detect queued documents | `documentsToProcess`, `totalDocuments` |
| `onDocumentProcessingStarted` | Before processing each document | `source`, `publisher`, `label`, `successful`, `failed`, `queueSize` |
| `onDocumentProcessingCompleted` | After processing succeeds or fails | `success`, `source`, `publisher`, `label`, `successful`, `failed`, `queueSize`, `elapsedMs`, `inputTokens`, `outputTokens`, `totalTokens` |
| `onProcessingRunCompleted` | When all queued documents are processed | `successful`, `failed`, `elapsedMs` |
| `onError` | When errors occur during processing or ingestion | `error`, `context` (with optional `source`, `publisher`, `label`, `ref`) |


## Tag Schemas

If you don't provide a schema, Greptor can initialize one for your topic. However, for better results, provide a custom tag schema.

Here's a comprehensive example for investment research:

```typescript
const greptor = await createGreptor({
  baseDir: './projects/investing',
  topic: 'Investing, stock market, financial, and macroeconomics',
  model: openai("gpt-5-mini"),
  tagSchema: [
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
