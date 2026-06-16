import os
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Feed URL
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
feed_cache = {
    "entries": None,
    "last_fetched": 0
}
CACHE_TTL = 300  # 5 minutes cache lifetime

# Mock data in case Google Cloud's RSS feed is down or rate-limiting
MOCK_ENTRIES = [
    {
        "id": "mock_1",
        "date": "June 15, 2026",
        "updated": "2026-06-15T00:00:00-07:00",
        "type": "Feature",
        "content": "<p>Use Gemini Cloud Assist to analyze your SQL queries and receive recommendations to <a href=\"#\">optimize query performance in BigQuery</a>. This feature is available to customers who use BigQuery editions. This feature is in Preview.</p>",
        "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026",
        "raw_text": "Use Gemini Cloud Assist to analyze your SQL queries and receive recommendations to optimize query performance in BigQuery. This feature is available to customers who use BigQuery editions. This feature is in Preview."
    },
    {
        "id": "mock_2",
        "date": "June 15, 2026",
        "updated": "2026-06-15T00:00:00-07:00",
        "type": "Issue",
        "content": "<p>Support for configuring daily token quotas for BigQuery generative AI functions has been temporarily disabled. We are working to restore this feature as soon as possible.</p>",
        "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026",
        "raw_text": "Support for configuring daily token quotas for BigQuery generative AI functions has been temporarily disabled. We are working to restore this feature as soon as possible."
    },
    {
        "id": "mock_3",
        "date": "June 12, 2026",
        "updated": "2026-06-12T00:00:00-07:00",
        "type": "Feature",
        "content": "<p>You can resize the width of table columns in BigQuery Studio for BigQuery listings such as datasets, repositories, job history, and connections. To resize a column, hover over the column divider and drag it to your preferred width.</p>",
        "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_12_2026",
        "raw_text": "You can resize the width of table columns in BigQuery Studio for BigQuery listings such as datasets, repositories, job history, and connections. To resize a column, hover over the column divider and drag it to your preferred width."
    },
    {
        "id": "mock_4",
        "date": "June 08, 2026",
        "updated": "2026-06-08T00:00:00-07:00",
        "type": "Deprecation",
        "content": "<p>Legacy SQL is no longer supported for new queries in BigQuery Studio. Please migrate your legacy SQL queries to GoogleSQL. Standard support for existing scheduled jobs remains active.</p>",
        "link": "https://docs.cloud.google.com/bigquery/docs/release-notes#June_08_2026",
        "raw_text": "Legacy SQL is no longer supported for new queries in BigQuery Studio. Please migrate your legacy SQL queries to GoogleSQL. Standard support for existing scheduled jobs remains active."
    }
]

def clean_html_to_text(html_content):
    """Strips HTML tags and converts common entities to plain text."""
    # Replace line breaks and paragraphs with spaces
    text = re.sub(r'<br\s*/?>', ' ', html_content)
    text = re.sub(r'</p>', ' ', text)
    # Strip remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Resolve HTML entities
    text = text.replace("&nbsp;", " ")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = text.replace("&amp;", "&")
    text = text.replace("&quot;", '"')
    text = text.replace("&#39;", "'")
    # Clean up excess spaces
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def split_entry_by_h3(entry_title, entry_content, entry_link, entry_id, entry_updated):
    """Splits an entry content containing multiple h3 sections into separate items."""
    # Find all h3 tags
    matches = list(re.finditer(r'<h3>(.*?)</h3>', entry_content))
    
    if not matches:
        raw_text = clean_html_to_text(entry_content)
        return [{
            "id": entry_id,
            "date": entry_title,
            "updated": entry_updated,
            "type": "General",
            "content": entry_content,
            "link": entry_link,
            "raw_text": raw_text
        }]
        
    sub_entries = []
    for i, match in enumerate(matches):
        type_name = match.group(1).strip()
        start_idx = match.end()
        end_idx = matches[i+1].start() if i + 1 < len(matches) else len(entry_content)
        
        chunk_content = entry_content[start_idx:end_idx].strip()
        raw_text = clean_html_to_text(chunk_content)
        
        sub_id = f"{entry_id}_{i}"
        
        sub_entries.append({
            "id": sub_id,
            "date": entry_title,
            "updated": entry_updated,
            "type": type_name,
            "content": chunk_content,
            "link": entry_link,
            "raw_text": raw_text
        })
        
    return sub_entries

def fetch_and_parse_feed():
    """Fetches the Google feed and parses the release notes."""
    req = urllib.request.Request(
        FEED_URL,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AntigravityFeedReader/1.0"}
    )
    
    with urllib.request.urlopen(req, timeout=15) as response:
        xml_data = response.read()
        
    root = ET.fromstring(xml_data)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    parsed_entries = []
    for entry in root.findall("atom:entry", ns):
        title = entry.find("atom:title", ns)
        title_text = title.text.strip() if title is not None else "Unknown Date"
        
        updated = entry.find("atom:updated", ns)
        updated_text = updated.text.strip() if updated is not None else ""
        
        id_node = entry.find("atom:id", ns)
        id_text = id_node.text.strip() if id_node is not None else re.sub(r'\s+', '_', title_text)
        
        link = entry.find("atom:link", ns)
        link_href = link.attrib.get("href", "") if link is not None else ""
        if not link_href:
            # Look for alternate links
            for l in entry.findall("atom:link", ns):
                if l.attrib.get("rel") == "alternate" or not l.attrib.get("rel"):
                    link_href = l.attrib.get("href", "")
                    break
        
        content = entry.find("atom:content", ns)
        content_text = content.text if content is not None else ""
        
        # Split the entry into individual updates if there are multiple h3 sections
        sub_items = split_entry_by_h3(title_text, content_text, link_href, id_text, updated_text)
        parsed_entries.extend(sub_items)
        
    return parsed_entries

@app.route("/")
def home():
    """Serves the main dashboard application."""
    return render_template("index.html")

@app.route("/api/release-notes")
def get_release_notes():
    """API endpoint to get parsed release notes with caching."""
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    current_time = time.time()
    
    if (force_refresh or 
        feed_cache["entries"] is None or 
        (current_time - feed_cache["last_fetched"]) > CACHE_TTL):
        
        try:
            entries = fetch_and_parse_feed()
            feed_cache["entries"] = entries
            feed_cache["last_fetched"] = current_time
            source = "network"
        except Exception as e:
            # Fallback to cache if exists, otherwise fallback to mock data
            app.logger.error(f"Failed to fetch feed: {e}")
            if feed_cache["entries"] is not None:
                entries = feed_cache["entries"]
                source = "cache_fallback"
            else:
                entries = MOCK_ENTRIES
                source = "mock_fallback"
        
    else:
        entries = feed_cache["entries"]
        source = "cache"
        
    return jsonify({
        "status": "success",
        "source": source,
        "count": len(entries),
        "last_fetched_time": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(feed_cache["last_fetched"])),
        "entries": entries
    })

if __name__ == "__main__":
    # Standard Flask port
    app.run(host="127.0.0.1", port=5000, debug=True)
