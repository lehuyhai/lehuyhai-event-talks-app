document.addEventListener('DOMContentLoaded', () => {
    // State management
    let allNotes = [];
    let displayedNotes = [];
    let activeTypeFilter = 'all';
    let searchQuery = '';
    let selectedNote = null;
    let selectedTone = 'standard';

    // DOM Elements
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshIcon = document.getElementById('refreshIcon');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const syncStatusText = document.getElementById('lastFetchedText');
    
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    const filterGroup = document.getElementById('filterGroup');
    
    const notesFeed = document.getElementById('notesFeed');
    const feedLoading = document.getElementById('feedLoading');
    const feedEmpty = document.getElementById('feedEmpty');
    
    const composerUnselected = document.getElementById('composerUnselected');
    const composerActive = document.getElementById('composerActive');
    const composerSummaryText = document.getElementById('composerSummaryText');
    const composerSummaryDate = document.getElementById('composerSummaryDate');
    const selectedBadge = document.getElementById('selectedBadge');
    
    const tweetTextarea = document.getElementById('tweetTextarea');
    const charCount = document.getElementById('charCount');
    const charProgressCircle = document.getElementById('charProgressCircle');
    const charCountLabel = document.getElementById('charCountLabel');
    
    const toneBtns = document.querySelectorAll('.tone-btn');
    const tweetBtn = document.getElementById('tweetBtn');
    const copyBtn = document.getElementById('copyBtn');
    const copyIcon = document.getElementById('copyIcon');
    const copyText = document.getElementById('copyText');
    
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');

    // SVG Progress Ring calculations
    const radius = charProgressCircle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    charProgressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    charProgressCircle.style.strokeDashoffset = circumference;

    // Initialize the application
    fetchNotes(false);

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchNotes(true));
    exportCsvBtn.addEventListener('click', () => exportDisplayedNotesToCSV());
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFilters();
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
        searchInput.focus();
    });
    
    filterGroup.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        activeTypeFilter = chip.dataset.type;
        applyFilters();
    });

    tweetTextarea.addEventListener('input', () => {
        updateCharCounter();
    });

    toneBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toneBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTone = btn.dataset.tone;
            regenerateTweetText();
        });
    });

    tweetBtn.addEventListener('click', () => {
        if (!selectedNote) return;
        const text = tweetTextarea.value;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    });

    copyBtn.addEventListener('click', async () => {
        if (!selectedNote) return;
        const text = tweetTextarea.value;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Tweet copied to clipboard!');
            
            // Visual success feedback on button
            copyIcon.className = 'fa-solid fa-circle-check';
            copyText.textContent = 'Copied!';
            copyBtn.style.borderColor = 'var(--type-feature)';
            copyBtn.style.color = 'var(--type-feature)';
            
            setTimeout(() => {
                copyIcon.className = 'fa-regular fa-copy';
                copyText.textContent = 'Copy Text';
                copyBtn.style.borderColor = '';
                copyBtn.style.color = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy text', true);
        }
    });

    // API Call: Fetch notes
    async function fetchNotes(bypassCache = false) {
        setLoading(true);
        try {
            const url = `/api/release-notes${bypassCache ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === 'success') {
                allNotes = data.entries;
                
                // Update sync status text
                const formattedTime = data.last_fetched_time.split(' ')[1] || data.last_fetched_time;
                syncStatusText.textContent = `Sync: ${formattedTime} (${data.source})`;
                
                // Render
                applyFilters();
                updateFilterBadges();
                showToast(bypassCache ? 'Release notes synchronized!' : 'Release notes loaded');
            } else {
                throw new Error(data.message || 'API returned failure status');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showToast('Sync failed. Using offline cached data.', true);
            
            // Fallback render if we have old data or API failed
            if (allNotes.length === 0) {
                notesFeed.innerHTML = '';
                feedLoading.style.display = 'none';
                feedEmpty.style.display = 'block';
            }
        } finally {
            setLoading(false);
        }
    }

    // Set Loading State
    function setLoading(isLoading) {
        if (isLoading) {
            refreshIcon.classList.add('spinning');
            refreshBtn.disabled = true;
            if (allNotes.length === 0) {
                feedLoading.style.display = 'flex';
                feedEmpty.style.display = 'none';
            }
        } else {
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
            feedLoading.style.display = 'none';
        }
    }

    // Apply Filter & Search logic
    function applyFilters() {
        let filtered = allNotes;
        
        // 1. Filter by Type Badge
        if (activeTypeFilter !== 'all') {
            filtered = filtered.filter(note => note.type.toLowerCase() === activeTypeFilter.toLowerCase());
        }
        
        // 2. Filter by Search Query
        if (searchQuery) {
            filtered = filtered.filter(note => 
                note.raw_text.toLowerCase().includes(searchQuery) ||
                note.type.toLowerCase().includes(searchQuery) ||
                note.date.toLowerCase().includes(searchQuery)
            );
        }
        
        displayedNotes = filtered;
        renderNotes(filtered);
    }

    // Update Filter counts
    function updateFilterBadges() {
        const counts = {
            all: allNotes.length,
            feature: 0,
            change: 0,
            fix: 0,
            deprecation: 0,
            issue: 0
        };
        
        allNotes.forEach(note => {
            const t = note.type.toLowerCase();
            if (t.includes('feature')) counts.feature++;
            else if (t.includes('change')) counts.change++;
            else if (t.includes('fix')) counts.fix++;
            else if (t.includes('deprecation')) counts.deprecation++;
            else if (t.includes('issue')) counts.issue++;
        });
        
        document.getElementById('count-all').textContent = counts.all;
        document.getElementById('count-feature').textContent = counts.feature;
        document.getElementById('count-change').textContent = counts.change;
        document.getElementById('count-fix').textContent = counts.fix;
        document.getElementById('count-deprecation').textContent = counts.deprecation;
        document.getElementById('count-issue').textContent = counts.issue;
    }

    // Render Cards in Feed
    function renderNotes(notes) {
        notesFeed.innerHTML = '';
        
        if (notes.length === 0) {
            feedEmpty.style.display = 'block';
            return;
        }
        
        feedEmpty.style.display = 'none';
        
        notes.forEach((note, index) => {
            const card = document.createElement('div');
            card.className = `note-card fade-in ${selectedNote && selectedNote.id === note.id ? 'selected' : ''}`;
            card.style.animationDelay = `${index * 0.04}s`;
            card.dataset.id = note.id;
            
            // Format type badge class
            const badgeClass = note.type.toLowerCase().replace(/\s+/g, '-');
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-date"><i class="fa-regular fa-calendar-days"></i> ${note.date}</span>
                    <span class="badge-type ${badgeClass}">${note.type}</span>
                </div>
                <div class="card-content">
                    ${note.content}
                </div>
                <div class="card-actions">
                    <a href="${note.link}" target="_blank" rel="noopener noreferrer" class="card-link" onclick="event.stopPropagation()">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Original release notes
                    </a>
                    <div class="card-action-buttons">
                        <button class="card-btn-copy" title="Copy raw update to clipboard" onclick="event.stopPropagation()">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                        <div class="card-tweet-indicator">
                            <i class="fa-brands fa-x-twitter"></i>
                            <span>Select to Tweet</span>
                        </div>
                    </div>
                </div>
            `;
            
            // Attach individual copy button listener
            const copyCardBtn = card.querySelector('.card-btn-copy');
            copyCardBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent selecting card
                try {
                    await navigator.clipboard.writeText(note.raw_text);
                    showToast('Update copied to clipboard!');
                    
                    // Visual feedback
                    const icon = copyCardBtn.querySelector('i');
                    icon.className = 'fa-solid fa-check';
                    copyCardBtn.classList.add('copied');
                    
                    setTimeout(() => {
                        icon.className = 'fa-regular fa-copy';
                        copyCardBtn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy card text:', err);
                    showToast('Failed to copy content', true);
                }
            });
            
            card.addEventListener('click', () => selectNote(note));
            notesFeed.appendChild(card);
        });
    }

    // Select release note
    function selectNote(note) {
        selectedNote = note;
        
        // Highlight active card
        document.querySelectorAll('.note-card').forEach(card => {
            if (card.dataset.id === note.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        
        // Activate composer panel
        composerUnselected.style.display = 'none';
        composerActive.style.display = 'flex';
        
        // Fill selected details
        composerSummaryText.textContent = note.raw_text;
        composerSummaryDate.textContent = note.date;
        selectedBadge.textContent = note.type;
        selectedBadge.className = `selected-badge ${note.type.toLowerCase()}`;
        
        // Generate tweet
        regenerateTweetText();
    }

    // Generate Tweet based on Tone & Selected Note
    function regenerateTweetText() {
        if (!selectedNote) return;
        
        const note = selectedNote;
        const text = note.raw_text;
        const link = note.link;
        const date = note.date;
        const type = note.type;
        
        let emoji = "📢";
        const typeLower = type.toLowerCase();
        if (typeLower.includes("feature")) emoji = "🚀";
        else if (typeLower.includes("deprecation")) emoji = "⚠️";
        else if (typeLower.includes("fix") || typeLower.includes("issue")) emoji = "🔧";
        else if (typeLower.includes("change")) emoji = "⚙️";
        
        let templateFn;
        switch(selectedTone) {
            case 'hype':
                templateFn = (content) => `🔥 Huge BigQuery update! (${date})\n\n${content}\n\nRead more: ${link} #GoogleCloud #BigQuery`;
                break;
            case 'technical':
                templateFn = (content) => `💻 BigQuery Update (${date}):\n\n${content}\n\nDocs: ${link} #SQL #DataEngineering`;
                break;
            case 'short':
                templateFn = (content) => `BigQuery ${type}: ${content} ${link}`;
                break;
            case 'standard':
            default:
                templateFn = (content) => `${emoji} BigQuery ${type} (${date}): ${content} #BigQuery #GoogleCloud ${link}`;
                break;
        }
        
        // X counts links as 23 characters regardless of length.
        // We calculate how much room is left for text content.
        const emptyTweetText = templateFn("");
        // Subtract literal link length and add 23
        const baseLengthWithShortenedLink = emptyTweetText.length - link.length + 23;
        const maxContentLength = 280 - baseLengthWithShortenedLink;
        
        let finalContent = text;
        if (text.length > maxContentLength) {
            finalContent = text.substring(0, maxContentLength - 3) + "...";
        }
        
        tweetTextarea.value = templateFn(finalContent);
        updateCharCounter();
    }

    // Live X-compliant Character Counter
    function updateCharCounter() {
        const text = tweetTextarea.value;
        
        // Twitter link replacement count (counts any http:// or https:// url as 23 characters)
        const urlRegex = /https?:\/\/[^\s]+/g;
        const adjustedText = text.replace(urlRegex, "a".repeat(23));
        const length = adjustedText.length;
        
        charCount.textContent = length;
        
        // Style character counter based on remaining characters
        charCountLabel.className = 'character-count';
        if (length > 280) {
            charCountLabel.classList.add('danger');
            charProgressCircle.style.stroke = 'var(--type-deprecation)';
        } else if (length > 250) {
            charCountLabel.classList.add('warning');
            charProgressCircle.style.stroke = 'var(--type-change)';
        } else {
            charProgressCircle.style.stroke = 'var(--accent-blue)';
        }
        
        // Update circular ring
        const percentage = Math.min((length / 280) * 100, 100);
        const offset = circumference - (percentage / 100) * circumference;
        charProgressCircle.style.strokeDashoffset = offset;
        
        // Enable or disable tweet button based on limit
        tweetBtn.disabled = length === 0 || length > 280;
        tweetBtn.style.opacity = (length === 0 || length > 280) ? '0.5' : '1';
        tweetBtn.style.cursor = (length === 0 || length > 280) ? 'not-allowed' : 'pointer';
    }

    // Toast Notifications
    function showToast(message, isError = false) {
        toastMsg.textContent = message;
        
        if (isError) {
            toast.style.borderColor = 'var(--type-deprecation)';
            toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-exclamation';
            toast.querySelector('.toast-icon').style.color = 'var(--type-deprecation)';
        } else {
            toast.style.borderColor = 'var(--type-feature)';
            toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-check';
            toast.querySelector('.toast-icon').style.color = 'var(--type-feature)';
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // CSV Exporter
    function exportDisplayedNotesToCSV() {
        if (displayedNotes.length === 0) {
            showToast('No notes to export', true);
            return;
        }
        
        const headers = ['Date', 'Type', 'Content', 'Link'];
        const rows = [headers];
        
        displayedNotes.forEach(note => {
            rows.push([
                note.date,
                note.type,
                note.raw_text,
                note.link
            ]);
        });
        
        const csvContent = rows.map(row => 
            row.map(val => {
                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            }).join(',')
        ).join('\r\n');
        
        try {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `bigquery_release_notes_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('CSV export successful!');
        } catch (err) {
            console.error('Failed to export CSV:', err);
            showToast('Export failed', true);
        }
    }
});
