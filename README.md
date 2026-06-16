# 🚀 BigQuery Release Notes Tracker & Social Composer

A modern web application built using **Python Flask** for the backend and **plain vanilla HTML, CSS, and JavaScript** for the frontend. The application automatically fetches, parses, and caches the official Google Cloud BigQuery release notes Atom feed and provides an interactive social composer to share updates on X (Twitter).

---

## 🌟 Key Features

* **Live Atom Feed Fetcher & Splitter:** Fetches the BigQuery release notes directly from Google's feed. Multiple updates on the same date are intelligently split into separate, distinct cards for easier reading.
* **Premium Glassmorphic Design:** Sleek dark mode dashboard built with vanilla CSS. Styled with radial gradients, glass cards, neon glows, timeline indicators, and smooth animations.
* **Fuzzy Search & Filters:** Instantly search through release notes. Filter by type (Features, Changes, Fixes, Deprecations, Issues) with dynamic count badges.
* **Smart Social Tweet Composer:**
  * **Interactive Tone Switching:** Generate tweets using **Standard**, **Hype**, **Tech**, or **Minimal** templates.
  * **Auto-Truncation:** Automatically truncates the preview description if it exceeds X's character limit.
  * **X-Compliant Link Counting:** Intelligently counts URLs as exactly 23 characters (matching X's t.co shortener) for accurate client-side tracking.
  * **Circular Progress Ring:** Replicates X's character limit progress ring, changing colors as you approach 280 characters.
  * **One-Click Sharing:** Post straight to X via official sharing intents or copy to your clipboard.
* **Robust Cache & Fail-safe Mode:** Implements a 5-minute memory cache to prevent rate-limiting and includes a local offline mock-data fallback.

---

## 🛠️ Technology Stack

* **Backend:** Python, Flask, `xml.etree.ElementTree` (Standard XML parser), `urllib` (Standard HTTP library)
* **Frontend:** Vanilla HTML5, Vanilla CSS3 (custom variables, keyframe animations), Vanilla ES6 JavaScript
* **Assets:** Google Fonts (Outfit, Fira Code), FontAwesome CDN Icons

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/lehuyhai/lehuyhai-event-talks-app.git
cd lehuyhai-event-talks-app
```

### 2. Install dependencies
Flask is the only external dependency.
```bash
pip install flask
```

### 3. Run the application
```bash
python app.py
```

### 4. View in your browser
Open your browser and navigate to:
👉 **`http://127.0.0.1:5000`**
