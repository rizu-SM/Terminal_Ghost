<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/License-MIT-00ff41?style=flat-square" />
</p>

<h1 align="center">
  [Terminal<span style="color:#00ff41">Ghost</span>]_
</h1>

<p align="center">
  <strong>A hacker-style personal website for CTF writeups & cybersecurity notes.</strong><br/>
  Built for speed during real competitions. Dark mode. Zero fluff.
</p>

---

## ⚡ Overview

**Terminal Ghost** is a frontend-only static site for publishing CTF writeups, vulnerability research, and quick-reference security cheatsheets. Content is stored as Markdown files — just drop in a `.md` file and it's live.

### Key Features

- 🖥️ **Animated Terminal** — Hero section with a realistic typing effect
- 🔍 **Search** — Filter writeups by title, tags, or keywords
- 🏷️ **Tag/Category System** — Organize by Web, Crypto, Reverse, Pwn, etc.
- 📝 **Markdown Rendering** — Full GFM support with syntax highlighting
- 📋 **Copy-to-Clipboard** — One-click copy for payloads and code blocks
- 📑 **Auto Table of Contents** — Generated from headings
- 🌙 **Dark Mode First** — Hacker-aesthetic, optimized for long reading sessions
- ⚡ **Fast Navigation** — Designed for real-time CTF usage

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Routing | React Router v7 |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Fonts | JetBrains Mono (code) + Inter (body) |
| Styling | Vanilla CSS with custom design tokens |

## 📁 Project Structure

```
Terminal_Ghost/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx          # Glassmorphism nav with terminal logo
│   │   │   ├── Sidebar.tsx         # Category tree for inner pages
│   │   │   └── Layout.tsx          # Shared layout wrapper
│   │   ├── ui/
│   │   │   ├── Tag.tsx             # Tag pill component
│   │   │   └── SearchBar.tsx       # Search input
│   │   └── markdown/
│   │       └── MarkdownRenderer.tsx # Markdown → HTML with syntax highlight
│   ├── pages/
│   │   ├── Home.tsx                # Landing page with terminal animation
│   │   ├── Writeups.tsx            # Writeup list with filtering
│   │   ├── WriteupDetail.tsx       # Single writeup view
│   │   └── Notes.tsx               # Cheatsheets & quick-ref notes
│   ├── content/                    # ← Your Markdown files go here
│   │   ├── writeups/
│   │   │   ├── web/
│   │   │   ├── crypto/
│   │   │   └── reverse/
│   │   └── notes/
│   │       ├── web/
│   │       │   ├── sqlinjection/
│   │       │   └── xss/
│   │       └── crypto/
│   ├── utils/
│   │   ├── loader.ts               # Markdown file loader with frontmatter
│   │   └── markdown.ts             # Markdown utilities
│   ├── types/
│   │   └── writeup.ts              # TypeScript types
│   ├── styles/
│   │   └── global.css              # Component & page styles
│   ├── index.css                   # Design system (tokens, animations)
│   ├── App.tsx                     # Router & layout setup
│   └── main.tsx                    # Entry point
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm or yarn

### Install & Run

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/Terminal_Ghost.git
cd Terminal_Ghost

# Install dependencies
npm install

# Start dev server
npm run dev
```

The site will be live at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview   # Preview the production build
```

## 📝 Adding Content

### Writeups

Create a Markdown file in `src/content/writeups/<category>/`:

```
src/content/writeups/web/picoctf-sqli.md
```

Add frontmatter at the top:

```markdown
---
title: "PicoCTF — SQL Injection Challenge"
date: "2026-04-15"
tags: [sql-injection, web, picoctf]
---

## Challenge Description

Your writeup content here...

```python
# Example payload
payload = "' OR 1=1 --"
`` `
```

### Notes / Cheatsheets

Create a Markdown file in `src/content/notes/<category>/<subcategory>/`:

```
src/content/notes/web/xss/basics.md
```

```markdown
---
title: "XSS Basics"
tags: [xss, web]
---

## Reflected XSS

`` `html
<script>alert(document.cookie)</script>
`` `
```

> **Tip:** Notes are designed for quick-reference during CTF competitions — keep them concise.

## 🎨 Design System

### Color Palette

| Token | Color | Usage |
|-------|-------|-------|
| `--bg-deep` | `#050508` | Page background |
| `--bg-primary` | `#0a0a0f` | Main surfaces |
| `--neon-green` | `#00ff41` | Primary accent, CTAs |
| `--neon-cyan` | `#00d4ff` | Links, tags |
| `--neon-purple` | `#c084fc` | Highlights |
| `--text-primary` | `#e4e4e7` | Body text |
| `--text-secondary` | `#9ca3af` | Secondary text |

### Fonts

- **JetBrains Mono** — Terminal, code blocks, monospace elements
- **Inter** — Headings, body text, UI elements

### Animations

| Animation | Usage |
|-----------|-------|
| `blink` | Terminal cursor |
| `fadeInUp` | Section entrance |
| `glowPulse` | Status indicators |
| `borderGlow` | Badge borders |
| `float` | Decorative elements |

## 📜 License

MIT — use it, fork it, hack it.

---

<p align="center">
  <strong>[Terminal<span>Ghost</span>]_</strong><br/>
  <em>Built for hackers, by a hacker.</em>
</p>
