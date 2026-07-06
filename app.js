// ── Supabase Auth ─────────────────────────────────────────────────────────────
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://budtkmjungpygsozbivq.supabase.co',
  'sb_publishable_kVhBfRuBKiFZGBBQUrDCUA_qNIHEL0j'
);

// ── App Controller ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  
  // App State
  let currentPaper = null;
  const settings = {
    variables: true,
    citations: true,
    definitions: true
  };

  // DOM Elements
  const toggleVariables = document.getElementById('toggle-variables');
  const toggleCitations = document.getElementById('toggle-citations');
  const toggleDefinitions = document.getElementById('toggle-definitions');

  const dictWord = document.getElementById('dict-word');
  const dictDefinition = document.getElementById('dict-definition');
  
  const apiStatusDot = document.getElementById('api-status-dot');
  const apiStatusText = document.getElementById('api-status-text');
  
  const dashboardView = document.getElementById('dashboard-view');
  const readerView = document.getElementById('reader-view');
  const backBtn = document.getElementById('back-to-dashboard');
  const readerContainer = document.getElementById('reader-container');
  const demoBanner = document.getElementById('demo-banner');
  document.getElementById('demo-banner-close').addEventListener('click', () => {
    demoBanner.style.display = 'none';
  });
  
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const pastPapersGrid = document.getElementById('past-papers-grid');
  
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingMessage = document.getElementById('loading-message');
  const loadingSubmessage = document.getElementById('loading-submessage');

  updateAPIStatus('ready');

  // ── Auth ──────────────────────────────────────────────────────────────────
  const signInBtn   = document.getElementById('sign-in-btn');
  const signOutBtn  = document.getElementById('sign-out-btn');
  const userInfoEl  = document.getElementById('user-info');
  const userAvatarEl = document.getElementById('user-avatar');
  const userNameEl  = document.getElementById('user-name');

  let currentUser = null;

  function setAuthUI(user) {
    currentUser = user;
    if (user) {
      signInBtn.style.display = 'none';
      userInfoEl.style.display = 'flex';
      userNameEl.textContent = user.user_metadata?.full_name || user.email || '';
      const avatar = user.user_metadata?.avatar_url;
      if (avatar) { userAvatarEl.src = avatar; userAvatarEl.style.display = ''; }
      else { userAvatarEl.style.display = 'none'; }
    } else {
      signInBtn.style.display = '';
      userInfoEl.style.display = 'none';
    }
    loadUserPapers();
  }

  signInBtn.addEventListener('click', () => {
    supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  });

  signOutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
  });

  supabaseClient.auth.getSession().then(({ data: { session } }) => setAuthUI(session?.user ?? null));
  supabaseClient.auth.onAuthStateChange((_e, session) => setAuthUI(session?.user ?? null));

  // ── Info Modal ────────────────────────────────────────────────────────────
  const infoBtn     = document.getElementById('info-btn');
  const infoOverlay = document.getElementById('info-modal-overlay');
  const infoClose   = document.getElementById('info-modal-close');

  infoBtn.addEventListener('click', () => infoOverlay.classList.add('open'));
  infoClose.addEventListener('click', () => infoOverlay.classList.remove('open'));
  infoOverlay.addEventListener('click', e => { if (e.target === infoOverlay) infoOverlay.classList.remove('open'); });

  // Bug report modal
  const bugOverlay = document.getElementById('bug-modal-overlay');
  const bugDesc    = document.getElementById('bug-description');
  document.getElementById('bug-report-btn').addEventListener('click', () => {
    bugDesc.value = '';
    bugOverlay.style.display = 'flex';
    bugDesc.focus();
  });
  document.getElementById('bug-modal-close').addEventListener('click', () => bugOverlay.style.display = 'none');
  bugOverlay.addEventListener('click', e => { if (e.target === bugOverlay) bugOverlay.style.display = 'none'; });
  document.getElementById('bug-modal-submit').addEventListener('click', async () => {
    const desc = bugDesc.value.trim();
    if (!desc) return;
    const btn = document.getElementById('bug-modal-submit');
    btn.textContent = 'Sending…';
    btn.disabled = true;
    try {
      await supabaseClient.from('bug_reports').insert({
        description: desc,
        paper: currentPaperFilename || null,
      });
      bugDesc.value = '';
      btn.textContent = 'Sent!';
      setTimeout(() => { bugOverlay.style.display = 'none'; btn.textContent = 'Send report'; btn.disabled = false; }, 1200);
    } catch (err) {
      btn.textContent = 'Send report';
      btn.disabled = false;
      alert('Could not send report: ' + err.message);
    }
  });

  document.querySelectorAll('.info-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.info-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.info-tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).style.display = '';
    });
  });

  // --- Initialize UI Actions ---

  // Sidebar drag to resize logic
  const sidebarEl = document.querySelector('.sidebar');
  const dragHandle = document.getElementById('sidebar-drag-handle');
  let isResizing = false;

  dragHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    dragHandle.classList.add('resizing');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= 250 && newWidth <= 600) {
      sidebarEl.style.width = `${newWidth}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      dragHandle.classList.remove('resizing');
    }
  });

  // Render Past Papers List
  loadUserPapers();

  // Sidebar Toggles
  toggleVariables.addEventListener('change', (e) => {
    settings.variables = e.target.checked;
    if (settings.variables) {
      document.body.classList.remove('hide-variables');
    } else {
      document.body.classList.add('hide-variables');
    }
  });

  toggleCitations.addEventListener('change', (e) => {
    settings.citations = e.target.checked;
    if (settings.citations) {
      document.body.classList.remove('hide-citations');
    } else {
      document.body.classList.add('hide-citations');
    }
  });

  toggleDefinitions.addEventListener('change', (e) => {
    settings.definitions = e.target.checked;
    if (settings.definitions) {
      document.body.classList.remove('hide-definitions');
    } else {
      document.body.classList.add('hide-definitions');
      clearDictionaryHighlight();
      dictWord.innerText = 'No Word Selected';
      dictDefinition.innerText = 'Double-click on any word in the text to look up its definition instantly.';
    }
  });

  // Back to Dashboard Button
  function goHome() {
    readerView.style.display = 'none';
    backBtn.style.display = 'none';
    demoBanner.style.display = 'none';
    dashboardView.style.display = 'flex';
    currentPaper = null;
    loadUserPapers();
  }
  backBtn.addEventListener('click', goHome);
  document.getElementById('brand-home-btn').addEventListener('click', goHome);

  // Demo paper
  document.getElementById('demo-paper-btn').addEventListener('click', async () => {
    showLoading('Loading example paper…');
    try {
      const resp = await fetch('/demo.pdf');
      if (!resp.ok) throw new Error('Could not load demo PDF');
      const arrayBuffer = await resp.arrayBuffer();
      await renderPDFViewer(arrayBuffer, 'demo.pdf');

      // Show first hint message
      demoBanner.querySelector('.demo-banner-text').textContent =
        'Scroll down and look at the variables and citations. Double-click any word for its definition.';
      demoBanner.style.display = 'block';

      // When page 4 scrolls into view, swap to the upload prompt
      const page4 = readerContainer.querySelector('[data-page-num="4"]');
      if (page4) {
        const obs = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting) {
            obs.disconnect();
            demoBanner.querySelector('.demo-banner-text').textContent =
              'Now go back and upload your own paper!';
          }
        }, { root: document.querySelector('.reader-scroll'), threshold: 0.1 });
        obs.observe(page4);
      }

      hideLoading();
    } catch (err) {
      hideLoading();
      alert('Could not load demo: ' + err.message);
    }
  });

  // Drag and Drop Files
  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  // --- UI Functions ---

  function updateAPIStatus(state, detail) {
    if (state === 'loading') {
      apiStatusDot.className = 'status-dot loading';
      apiStatusText.innerText = 'Analyzing…';
    } else if (state === 'error') {
      apiStatusDot.className = 'status-dot offline';
      apiStatusText.innerText = `AI error — ${detail || 'check console'}`;
    } else {
      apiStatusDot.className = 'status-dot';
      apiStatusText.innerText = detail ? `AI Ready — ${detail} definitions` : 'AI Ready';
    }
  }

  async function loadUserPapers() {
    pastPapersGrid.innerHTML = '';

    if (!currentUser) {
      // Not signed in — show nothing (or a sign-in nudge)
      pastPapersGrid.innerHTML = '<p class="papers-empty">Sign in to save and revisit your papers.</p>';
      const demoSection = document.getElementById('demo-section');
      if (demoSection) demoSection.style.display = '';
      return;
    }

    const { data: papers, error } = await supabaseClient
      .from('papers')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(30);

    if (error) { console.error(error); return; }

    if (!papers?.length) {
      pastPapersGrid.innerHTML = '<p class="papers-empty">No papers yet — upload one above.</p>';
      const demoSection = document.getElementById('demo-section');
      if (demoSection) demoSection.style.display = '';
      return;
    }

    // User has their own papers — hide the "Start here" demo section
    const demoSection = document.getElementById('demo-section');
    if (demoSection) demoSection.style.display = 'none';

    papers.forEach(paper => addPaperCard(paper));
  }

  function addPaperCard(paper) {
    const row = document.createElement('div');
    row.className = 'paper-row';

    const displayName = paper.title || paper.filename.replace(/\.pdf$/i, '');
    const date = new Date(paper.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    const card = document.createElement('div');
    card.className = 'sample-card paper-user-card';
    card.innerHTML = `
      <div class="sample-info">
        <h4>${displayName}</h4>
        <p>${date}</p>
      </div>
      <div class="sample-arrow">&rarr;</div>
    `;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'paper-delete-btn';
    deleteBtn.textContent = 'Delete';

    row.appendChild(card);
    row.appendChild(deleteBtn);
    pastPapersGrid.appendChild(row);

    // Open paper on click (only if not in swiped state)
    card.addEventListener('click', () => {
      if (row.classList.contains('swiped')) { row.classList.remove('swiped'); return; }
      openPaperFromStorage(paper);
    });

    // Swipe-left to reveal delete (mouse)
    let startX = 0, dragging = false;
    card.addEventListener('mousedown', e => { startX = e.clientX; dragging = true; e.preventDefault(); });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      if (e.clientX - startX < -40) row.classList.add('swiped');
      else if (e.clientX - startX > 20) row.classList.remove('swiped');
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    // Touch support
    card.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    card.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - startX;
      if (dx < -40) row.classList.add('swiped');
      else if (dx > 20) row.classList.remove('swiped');
    }, { passive: true });

    // Delete
    deleteBtn.addEventListener('click', async e => {
      e.stopPropagation();
      row.style.opacity = '0.4';
      await deleteUserPaper(paper);
      row.remove();
    });
  }

  async function openPaperFromStorage(paper) {
    showLoading('Loading paper…');
    try {
      const { data, error } = await supabaseClient.storage.from('Papers').download(paper.storage_path);
      if (error) throw error;
      const arrayBuffer = await data.arrayBuffer();
      await renderPDFViewer(arrayBuffer, paper.filename);
      hideLoading();
    } catch (err) {
      console.error(err);
      hideLoading();
      alert('Could not load this paper. It may have been removed from storage.');
    }
  }

  async function deleteUserPaper(paper) {
    if (paper.storage_path) {
      await supabaseClient.storage.from('Papers').remove([paper.storage_path]);
    }
    await supabaseClient.from('papers').delete().eq('id', paper.id);
  }

  function loadPaper(paper) {
    currentPaper = paper;
    
    // Hide Dashboard, Show Reader
    dashboardView.style.display = 'none';
    readerView.style.display = 'flex';
    backBtn.style.display = 'block';

    // Render HTML inside Reader View
    let html = `
      <article class="paper-header">
        <h1 class="paper-title">${paper.title}</h1>
        <div class="paper-authors">By ${paper.authors}</div>
      </article>
      
      <div class="paper-abstract">
        <strong>Abstract:</strong> ${paper.abstract}
      </div>
    `;

    paper.sections.forEach(sec => {
      html += `
        <section class="paper-section">
          <h2 class="section-heading">${sec.title}</h2>
          <div class="section-body">${sec.content}</div>
        </section>
      `;
    });

    readerContainer.innerHTML = html;
    
    // Initialize Interactive Event Listeners for new spans
    initializeInteractiveTokens();
  }

  // --- Hover Tooltip System ---
  let tooltipEl = null;

  function showTooltip(target, title, description, tag, type) {
    hideTooltip();
    
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'custom-tooltip';
    
    const tagClass = `tag-${tag}`;
    
    tooltipEl.innerHTML = `
      <div class="tooltip-header">
        <span>${title}</span>
        <span class="tooltip-tag ${tagClass}">#${tag}_${type}</span>
      </div>
      <div class="tooltip-body">${description}</div>
    `;
    
    document.body.appendChild(tooltipEl);
    
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    
    // Center it above the token
    let top = rect.top + window.scrollY - tooltipRect.height - 8;
    let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);
    
    // Bounds check
    if (top < window.scrollY) {
      top = rect.bottom + window.scrollY + 8; // flip below
    }
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  // --- Interactive Token Logic ---

  function initializeInteractiveTokens() {
    // 1. Math Variables Hovering
    const varTokens = readerContainer.querySelectorAll('.variable-token');
    varTokens.forEach(tok => {
      
      tok.addEventListener('mouseenter', (e) => {
        if (!settings.variables) return;
        
        const varId = tok.dataset.varId || tok.getAttribute('data-var-id');

        const info = currentPaper.variables[varId];
        if (info) {
          showTooltip(tok, info.name, info.description, info.tag, "variable");
        }
      });
      
      tok.addEventListener('mouseleave', () => {
        hideTooltip();
      });
    });

    // 2. Citation Hovering
    const citTokens = readerContainer.querySelectorAll('.citation-token');
    citTokens.forEach(tok => {
      
      tok.addEventListener('mouseenter', () => {
        if (!settings.citations) return;
        
        const citId = tok.dataset.citationId || tok.getAttribute('data-citation-id');
        const info = currentPaper.citations[citId];
        if (info) {
          showTooltip(tok, info.citationKey, info.summary, "citation", "citation");
        }
      });
      
      tok.addEventListener('mouseleave', () => {
        hideTooltip();
      });
    });
  }

  // --- Double Click Word Definitions ---
  document.addEventListener('dblclick', async (e) => {
    if (!settings.definitions) return;
    
    // Get text selection
    const selection = window.getSelection();
    const word = selection.toString().trim().replace(/[^a-zA-Z]/g, ""); // strip punctuation
    
    // Only search if it's a single word and double-clicked inside paper content
    if (word && !word.includes(' ') && e.target.closest('.section-body')) {
      
      // Clear previous word highlight
      clearDictionaryHighlight();
      
      // Highlight the selected word in the DOM using a temporary class
      highlightSelectedText(selection);
      
      dictWord.innerText = `Searching: "${word}"...`;
      dictDefinition.innerText = "Fetching details from Dictionary API...";
      
      try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (!response.ok) throw new Error('Word not found');
        const data = await response.json();
        
        const meaning = data[0].meanings[0];
        const definition = meaning.definitions[0].definition;
        const partOfSpeech = meaning.partOfSpeech;
        
        dictWord.innerHTML = `${word} <span style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">(${partOfSpeech})</span>`;
        dictDefinition.innerText = definition;
      } catch (err) {
        dictWord.innerText = word;
        dictDefinition.innerText = "Word definition not found in public dictionary. (This API only supports standard English words, not names or academic jargon).";
      }
    }
  });

  function highlightSelectedText(selection) {
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'word-definition-highlight';
    
    try {
      range.surroundContents(span);
    } catch (e) {
      // In case surroundContents fails (spans multiple block boundaries)
      console.warn("Could not wrap word definition selection", e);
    }
  }

  function clearDictionaryHighlight() {
    const highlights = document.querySelectorAll('.word-definition-highlight');
    highlights.forEach(hl => {
      const parent = hl.parentNode;
      while (hl.firstChild) {
        parent.insertBefore(hl.firstChild, hl);
      }
      hl.remove();
    });
  }

  // --- Processing Real PDFs ---

  function showLoading(msg) {
    loadingMessage.innerText = msg;
    loadingOverlay.style.display = 'flex';
  }

  function hideLoading() {
    loadingOverlay.style.display = 'none';
  }

  function showLowDetectionWarning(count) {
    const existing = document.getElementById('low-detection-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'low-detection-banner';
    banner.className = 'demo-banner';
    banner.style.background = '#8c7b6b';
    banner.innerHTML = `Only ${count || 'no'} variable${count === 1 ? '' : 's'} detected. If this paper has equations, try uploading the arXiv or SSRN preprint instead.
      <button class="demo-banner-close" onclick="this.parentElement.remove()">✕</button>`;
    readerView.insertBefore(banner, readerView.querySelector('.reader-scroll'));
  }

  async function handleFileUpload(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a valid PDF document.');
      return;
    }

    showLoading('Rendering PDF Document...');
    
    try {
      const reader = new FileReader();
      reader.onload = async function() {
        try {
          const arrayBuffer = this.result;
          await renderPDFViewer(arrayBuffer, file.name);
          hideLoading();

          // Save to Supabase if signed in
          if (currentUser) {
            console.log('[Var] uploading to Supabase, user:', currentUser.id);
            const storagePath = `${currentUser.id}/${Date.now()}_${file.name}`;
            const { error: uploadErr } = await supabaseClient.storage
              .from('Papers').upload(storagePath, file, { upsert: false });
            if (uploadErr) {
              console.error('[Var] storage upload failed:', uploadErr.message, uploadErr);
            } else {
              console.log('[Var] storage upload OK, inserting DB record');
              const { error: dbErr } = await supabaseClient.from('papers').insert({
                user_id: currentUser.id,
                filename: file.name,
                title: currentPaperTitle || file.name.replace(/\.pdf$/i, ''),
                storage_path: storagePath,
              });
              if (dbErr) console.error('[Var] DB insert failed:', dbErr.message, dbErr);
              else console.log('[Var] paper saved successfully');
            }
          } else {
            console.log('[Var] not signed in, skipping save');
          }
        } catch (err) {
          console.error(err);
          hideLoading();
          alert(`Analysis failed: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (e) {
      console.error(e);
      hideLoading();
      alert('Error reading PDF file.');
    }
  }


  // ── Context-Aware Variable Detection (Pass 1) ──────────────────────────
  //
  // Real PDFs (LaTeX/Word output) render subscripts and superscripts as
  // separate text items shifted in position and shrunk in font size, not as
  // literal "_" characters. Math symbols are also typeset in a different
  // embedded font resource than the surrounding prose. So detection works by:
  //   1. finding the dominant "body text" font (by character count),
  //   2. treating any single-letter (Latin or Greek) item in a non-body
  //      font as a variable, and
  //   3. greedily attaching immediately-following smaller, lower-baseline
  //      items in a non-body font as that variable's subscript.
  // Superscript-position glyphs are intentionally NOT merged in, since they
  // are geometrically indistinguishable from footnote reference marks.

  let pageTextContents = {}; // Cache: pageNum -> textContent
  let pageRenderTokens = {}; // Cache: pageNum -> [{ type, norm, display, parts }]
  let documentBodyFont = null;
  let referencePageNums = new Set(); // pages at/after the References section
  let variableHints = {};       // norm -> heuristic sentence (for AI context only, never shown)
  let variableDefinitions = {}; // norm -> AI-generated description (clean, shown in tooltip)
  let variableTags = {};        // norm -> category tag (AI), e.g. "dependent variable"
  let acronymDefinitions = {};  // norm -> plain-English expansion (AI)

  function isGreekLetterChar(ch) {
    if (!ch) return false;
    const code = ch.codePointAt(0);
    return (code >= 0x0391 && code <= 0x03A9 && code !== 0x03A2) || (code >= 0x03B1 && code <= 0x03C9);
  }

  function isLatinLetterChar(ch) {
    return /^[A-Za-z]$/.test(ch);
  }

  // Word/Google Docs/MathType equations don't use a separate font resource
  // for math the way LaTeX does — they render variables as actual Unicode
  // "Mathematical Alphanumeric Symbol" code points (e.g. "y" the letter vs.
  // "𝑦" U+1D466, a distinct italic character). That whole block runs
  // U+1D400-U+1D7FF and is letters U+1D400-1D7C9 / digits U+1D7CE-1D7FF.
  // These are outside the Basic Multilingual Plane, so in a JS string they
  // are surrogate pairs (two UTF-16 code units for one character) — care is
  // needed not to split them in half when checking "is this one character".
  function isMathAlphanumericLetter(ch) {
    const code = ch.codePointAt(0);
    return code >= 0x1D400 && code <= 0x1D7C9;
  }

  function isMathAlphanumericDigit(ch) {
    const code = ch.codePointAt(0);
    return code >= 0x1D7CE && code <= 0x1D7FF;
  }

  // A handful of math-italic/script/fraktur/double-struck letters predate
  // the Mathematical Alphanumeric Symbols block and were never duplicated
  // into it — they live as standalone "Letterlike Symbols" instead (e.g.
  // italic h is U+210E PLANCK CONSTANT, not a math-alphanumeric code point).
  // Blackboard-bold ℝ/ℕ/ℤ/ℚ/ℂ are extremely common in quantitative papers,
  // so these are worth recognizing explicitly. Mapped to their plain-letter
  // identity so they also group correctly for color purposes.
  const LETTERLIKE_MATH_LETTERS = {
    'ℎ': 'h', // PLANCK CONSTANT (italic h)
    'ℬ': 'B', 'ℰ': 'E', 'ℱ': 'F', 'ℋ': 'H', 'ℐ': 'I',
    'ℒ': 'L', 'ℳ': 'M', 'ℛ': 'R', // script capitals
    'ℯ': 'e', 'ℊ': 'g', 'ℴ': 'o', // script lowercase
    'ℭ': 'C', 'ℌ': 'H', 'ℑ': 'I', 'ℜ': 'R', 'ℨ': 'Z', // fraktur capitals
    'ℂ': 'C', 'ℍ': 'H', 'ℕ': 'N', 'ℙ': 'P', 'ℚ': 'Q',
    'ℝ': 'R', 'ℤ': 'Z', // double-struck (blackboard bold) capitals
  };

  function isVariableLetterChar(ch) {
    return isLatinLetterChar(ch) || isGreekLetterChar(ch) || isMathAlphanumericLetter(ch) || (ch in LETTERLIKE_MATH_LETTERS);
  }

  function isAttachableChar(ch) {
    if (ch === ',' || ch === '+' || ch === '-' || ch === '−') return true;
    if (/^[0-9]$/.test(ch)) return true;
    return isVariableLetterChar(ch) || isMathAlphanumericDigit(ch);
  }

  // A few PDFs encode subscripts as literal unicode subscript characters
  // glued onto the base letter inside a single text item (e.g. "xᵢ").
  const UNICODE_SUBSCRIPTS = { 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k', 'ₙ': 'n', 'ₜ': 't', '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

  function stripUnicodeSubscriptSuffix(text) {
    const chars = Array.from(text); // codepoint-aware split (surrogate-pair safe)
    if (chars.length < 2) return null;
    const first = chars[0];
    if (!isLatinLetterChar(first) && !isGreekLetterChar(first)) return null;
    let sub = '';
    for (const ch of chars.slice(1)) {
      if (!(ch in UNICODE_SUBSCRIPTS)) return null;
      sub += UNICODE_SUBSCRIPTS[ch];
    }
    return sub ? { base: first, sub } : null;
  }

  function computeBodyFont(pagesItems) {
    const counts = {};
    pagesItems.forEach(items => items.forEach(it => {
      const len = it.str.replace(/\s/g, '').length;
      if (!len) return;
      // Only count multi-character items — single chars are likely math glyphs
      if (it.str.trim().length < 2) return;
      counts[it.fontName] = (counts[it.fontName] || 0) + len;
    }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log('[Var] font counts (top 8):', sorted.slice(0, 8).map(([f, c]) => `${f}: ${c}`).join(' | '));
    return sorted[0]?.[0] ?? null;
  }

  function buildLines(items) {
    const sorted = items.slice().sort((a, b) => b.transform[5] - a.transform[5]);
    const yBuckets = [];
    // Tolerance must clear a subscript's baseline offset (~1.5-3pt) so a
    // base letter and its subscript still land in the same bucket, but
    // stay below genuine line-to-line spacing — which can be as tight as
    // ~10-11pt in a densely-set two-column paper. 12 straddled both and
    // was merging two real, unrelated lines into one (word-interleaved)
    // bucket whenever a paper's line spacing ran on the tighter side.
    const Y_BUCKET_TOLERANCE = 6;
    sorted.forEach(item => {
      if (!item.str.trim()) return;
      const y = item.transform[5];
      let bucket = yBuckets.find(b => Math.abs(b.y - y) < Y_BUCKET_TOLERANCE);
      if (!bucket) { bucket = { y, items: [] }; yBuckets.push(bucket); }
      bucket.items.push(item);
    });

    // A two-column layout puts both columns' text at the same y, so a
    // y-bucket alone isn't a real visual line — it can interleave two
    // unrelated sentences. Split a bucket wherever there's a horizontal
    // gap much wider than normal word spacing (a column gutter).
    const lines = [];
    yBuckets.forEach(bucket => {
      bucket.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let current = { y: bucket.y, items: [bucket.items[0]] };
      for (let i = 1; i < bucket.items.length; i++) {
        const prev = bucket.items[i - 1];
        const item = bucket.items[i];
        const gap = item.transform[4] - (prev.transform[4] + prev.width);
        const refHeight = Math.abs(prev.transform[3]) || 10;
        if (gap > 6 * refHeight) {
          lines.push(current);
          current = { y: bucket.y, items: [] };
        }
        current.items.push(item);
      }
      lines.push(current);
    });

    // Order for natural reading flow. The y-bucket/gap-split above keeps
    // left- and right-column segments from the same row as neighbors in
    // the array, which is wrong for reading order — a left-column line's
    // "next line" would resolve to an unrelated right-column line rather
    // than the next line below it. Cluster into columns by each line's
    // starting x relative to the page's horizontal midpoint, then sort
    // top-to-bottom within each column, columns kept contiguous.
    if (items.length) {
      const xs = items.map(it => it.transform[4]);
      const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
      lines.forEach(line => {
        line.column = line.items[0].transform[4] < midX ? 0 : 1;
      });
      lines.sort((a, b) => a.column - b.column || b.y - a.y);
    }

    return lines;
  }

  function flagExclusionZones(lines, refState) {
    lines.forEach(line => {
      const text = line.items.map(i => i.str).join(' ');
      const upperText = text.toUpperCase();
      let exclusion = false;

      if (text === upperText && text.length > 5 && !/[0-9]/.test(text) && line.items.length < 10) {
        exclusion = true; // ALL-CAPS heading
      }
      if (upperText.includes("REFERENCES") && line.items.length < 4) refState.inReferences = true;
      if (refState.inReferences) exclusion = true;
      if (/^(Table|Figure|Fig\.|Panel)\s*\d+/i.test(text) || upperText.includes("ARTICLE INFO") || upperText.includes("ABSTRACT") || upperText.includes("JEL") || upperText.includes("KEYWORDS")) {
        exclusion = true;
      }

      line.text = text;
      line.exclusion = exclusion;
    });
  }

  // Splits a text item on whitespace, apportioning x/width by character-index
  // ratio. PDF.js sometimes bundles adjacent same-font glyphs (e.g. two
  // distinct one-letter variables "a" and "P") into a single item like "a P".
  // Uses codepoint arrays throughout (not .length/.slice on the raw string)
  // since Mathematical Alphanumeric Symbol characters are surrogate pairs.
  function splitItemIntoSubtokens(item) {
    const chars = Array.from(item.str);
    const L = chars.length;
    if (!L) return [];
    const subtokens = [];
    let i = 0;
    while (i < L) {
      if (/\s/.test(chars[i])) { i++; continue; }
      let j = i;
      while (j < L && !/\s/.test(chars[j])) j++;
      subtokens.push({
        text: chars.slice(i, j).join(''),
        x: item.transform[4] + (i / L) * item.width,
        width: ((j - i) / L) * item.width,
        y: item.transform[5],
        height: Math.abs(item.transform[3]),
        fontName: item.fontName,
      });
      i = j;
    }
    return subtokens;
  }

  function isGreekLetter(ch) {
    const code = ch.codePointAt(0);
    // Greek and Coptic block — unambiguously mathematical when single-char
    return code >= 0x0370 && code <= 0x03FF;
  }

  // Zero-width and invisible Unicode chars that some PDF generators bundle
  // with adjacent glyphs (e.g. "Δ​"), making a visually single character
  // look like a 2-char string. Strip them before counting visible chars.
  function visibleChars(str) {
    return Array.from(str).filter(c => {
      const cp = c.codePointAt(0);
      return cp > 0x0008 && cp !== 0x00AD &&   // soft hyphen
             (cp < 0x200B || cp > 0x200D) &&    // zero-width space/non-joiner/joiner
             cp !== 0x2060 && cp !== 0xFEFF;     // word joiner / BOM
    });
  }

  function isVariableBase(sub, bodyFont, equationLine = false) {
    const chars = visibleChars(sub.text);
    if (chars.length !== 1) return false;
    if (sub.fontName !== bodyFont) {
      return isVariableLetterChar(chars[0]);
    }
    // Same font as body: Greek letters and uppercase Latin are safe.
    // On equation lines, also allow lowercase Latin — many publishers
    // extract Greek/italic vars as ASCII (α→'a', β→'b', γ→'g') in body font,
    // and some (Chicago Press JPE) use italic body font for math variables.
    const ch = chars[0];
    if (isGreekLetter(ch) || isMathAlphanumericLetter(ch) || /^[A-Z]$/.test(ch)) return true;
    if (equationLine && /^[a-z]$/.test(ch)) return true;
    return false;
  }

  // Shared geometry/font/content checks for "small glyph immediately
  // adjacent to a base letter" — true for both subscripts (Y_i) and
  // superscripts (x^T), since they differ only in vertical position.
  function isSmallAdjacentGlyph(sub, base, bodyFont) {
    const chars = visibleChars(sub.text);
    if (chars.length > 5) return false;
    if (!chars.every(isAttachableChar)) return false;
    const ratio = sub.height / base.height;
    // Superscript/footnote markers are already excluded by the vertical
    // position check in isSubscriptAttachable, so the height ratio only
    // needs to separate true subscripts (~0.65–0.80) from same-size
    // adjacent letters (~1.0). Use 0.82 uniformly.
    if (ratio > 0.82) return false;
    const gap = sub.x - (base.x + base.width);
    if (gap > 0.6 * base.height || gap < -0.2 * base.height) return false;
    return true;
  }

  function isSubscriptAttachable(sub, base, bodyFont) {
    if (!isSmallAdjacentGlyph(sub, base, bodyFont)) return false;
    // Must sit meaningfully below the base's baseline (a subscript).
    // Superscript-position glyphs are not merged in as part of the
    // variable's identity: they're geometrically identical to footnote
    // reference marks, so doing so would produce bogus "exponent"
    // variants. They're instead skipped over (see mergeLineIntoTokens)
    // so a real subscript past them — e.g. the "ah" in x^T_ah — still
    // gets found, while the superscript itself (e.g. the "T") is left
    // to be picked up as its own standalone token.
    if (sub.y > base.y - 0.15 * base.height) return false;
    return true;
  }

  function mergeLineIntoTokens(line, bodyFont) {
    let stream = [];
    line.items.forEach(item => {
      const trimmed = item.str.trim();
      const glued = trimmed === item.str ? stripUnicodeSubscriptSuffix(trimmed) : null;
      if (glued) {
        stream.push({
          text: item.str, x: item.transform[4], width: item.width,
          y: item.transform[5], height: Math.abs(item.transform[3]),
          fontName: item.fontName, forcedNorm: `${glued.base}_${glued.sub}`,
        });
      } else {
        stream.push(...splitItemIntoSubtokens(item));
      }
    });
    stream.sort((a, b) => a.x - b.x);

    // A line is an equation line if it looks like math notation:
    // either has a standard operator with ≥3 singles, OR has ≥5 singles
    // regardless (catches publisher PDFs that encode '=' as a non-standard
    // glyph like '5' in a custom font — still produces many lone single chars).
    const mathOpSet = new Set(['=', '+', '−', '–', '-', '±', '<', '>',
                               '≤', '≥', '≡', '≈', '∝', '∈', '∉', '⊂', '∩', '∪']);
    const singles = stream.filter(s => {
      const t = s.text.trim();
      return t.length === 1 || visibleChars(s.text).length === 1;
    });
    const equationLine = singles.length >= 5 ||
      (singles.some(s => mathOpSet.has(s.text.trim())) && singles.length >= 3);

    const consumed = new Array(stream.length).fill(false);
    const tokens = [];
    for (let i = 0; i < stream.length; i++) {
      if (consumed[i]) continue;
      const sub = stream[i];
      if (sub.forcedNorm) {
        tokens.push({ type: 'variable', norm: sub.forcedNorm, display: sub.text, parts: [sub] });
        consumed[i] = true;
      } else if (isVariableBase(sub, bodyFont, equationLine)) {
        const base = sub;
        let norm = base.text;
        let display = base.text;
        const parts = [base];
        consumed[i] = true;

        // A base can carry both a superscript (x^T) and a subscript
        // (x_ah) at once, both positioned right after it. Tolerate
        // superscript-position "obstacles" in between without consuming
        // them — they're left for the outer loop to pick up as their
        // own standalone token (e.g. T gets its own highlight box).
        let j = i + 1;
        while (j < stream.length && !consumed[j] && !stream[j].forcedNorm) {
          if (isSubscriptAttachable(stream[j], base, bodyFont)) {
            norm += '_' + stream[j].text;
            display += stream[j].text;
            parts.push(stream[j]);
            consumed[j] = true;
            j++;
          } else if (isSmallAdjacentGlyph(stream[j], base, bodyFont)) {
            j++; // skip over, but leave unconsumed
          } else {
            break;
          }
        }
        tokens.push({ type: 'variable', norm, display, parts, equationLine });
      } else if (sub.fontName === bodyFont && isCandidateAcronym(sub.text)) {
        tokens.push({ type: 'acronym', norm: sub.text.replace(/s$/, ''), display: sub.text, parts: [sub] });
        consumed[i] = true;
      }
    }
    return tokens;
  }

  // Phrases authors commonly use to introduce notation ("Let y_ah denote...",
  // "where x_ah is a vector...", "u_a represents..."). Cheap, free, no API
  // calls — this is the first line of defense for "what does this variable
  // mean"; an AI fallback only needs to cover whatever this misses.
  const DEFINITION_TRIGGER = /\blet\b|\bdenotes?\b|\brepresents?\b|\bdefined as\b|\bstands for\b|\brefers? to\b|\bwhere\b/i;

  function looksLikeDefinitionText(text) {
    return DEFINITION_TRIGGER.test(text);
  }

  function cleanDefinitionText(text) {
    let s = text.replace(/\s+/g, ' ').trim();
    if (s.length > 240) s = s.slice(0, 240).replace(/\s+\S*$/, '') + '…';
    return s;
  }

  async function analyzeDocumentContext(pdf) {
    pageTextContents = {};
    pageRenderTokens = {};
    variableHints = {};
    variableDefinitions = {};
    variableTags = {};
    acronymDefinitions = {};

    const pagesItems = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      pageTextContents[pageNum] = textContent;
      pagesItems.push(textContent.items);
    }

    documentBodyFont = computeBodyFont(pagesItems);

    const refState = { inReferences: false };
    referencePageNums = new Set();
    const acronymOccurrences = {};
    const perPageTokens = {};

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const lines = buildLines(pagesItems[pageNum - 1]);
      flagExclusionZones(lines, refState);
      if (refState.inReferences) referencePageNums.add(pageNum);

      const tokens = [];
      lines.forEach((line, idx) => {
        if (line.exclusion) return;
        const lineTokens = mergeLineIntoTokens(line, documentBodyFont);
        lineTokens.forEach(t => {
          tokens.push(t);
          if (t.type === 'acronym') acronymOccurrences[t.norm] = (acronymOccurrences[t.norm] || 0) + 1;
        });

        // A defining sentence often wraps onto the next visual line, so
        // check a small window rather than just this one line — but only
        // within the same column, since the next array entry can be the
        // start of the other column instead of a real continuation.
        if (lineTokens.some(t => t.type === 'variable')) {
          const nextLine = lines[idx + 1];
          const sameColumn = nextLine && nextLine.column === line.column;
          const windowText = sameColumn && !nextLine.exclusion ? `${line.text} ${nextLine.text}` : line.text;
          if (looksLikeDefinitionText(windowText)) {
            const candidate = cleanDefinitionText(windowText);
            lineTokens.forEach(t => {
              if (t.type === 'variable' && !variableHints[t.norm]) {
                variableHints[t.norm] = candidate;
              }
            });
          }
        }
      });
      perPageTokens[pageNum] = tokens;
    }

    // Acronyms need corroborating evidence (repetition); variables don't,
    // since the font+geometry signal is already strong on its own.
    const verifiedAcronyms = new Set(Object.keys(acronymOccurrences).filter(a => acronymOccurrences[a] >= 2));

    // Count how many times each norm appears across all pages (for false-positive filter)
    const normTotalCount = {};
    for (let p = 1; p <= pdf.numPages; p++) {
      (perPageTokens[p] || []).forEach(t => {
        if (t.type === 'variable') normTotalCount[t.norm] = (normTotalCount[t.norm] || 0) + 1;
      });
    }

    // Collect all variable norms so we can check for subscript siblings
    const allVarNorms = new Set(
      Object.values(perPageTokens).flat().filter(t => t.type === 'variable').map(t => t.norm)
    );

    // A single lowercase ASCII letter with no subscript siblings is almost certainly
    // a prose article/preposition that got flagged because the abstract is in italic.
    // Keep it only if there are subscripted variants (a_i, a_h, …) in the paper.
    function isFalsePositiveSingleLetter(norm) {
      // Single lowercase letter with no subscript siblings → almost always prose
      if (/^[a-z]$/.test(norm)) {
        const hasSubscriptSibling = [...allVarNorms].some(n => n.startsWith(norm + '_'));
        return !hasSubscriptSibling;
      }
      // Single uppercase letter with no subscript siblings → likely abbreviation
      // Keep it if it has subscript siblings (N_ct, Y_it, …) or appears with
      // a superscript variant (N_NT), otherwise remove.
      if (/^[A-Z]$/.test(norm)) {
        const hasRelatedNorm = [...allVarNorms].some(n => n !== norm && n.startsWith(norm + '_'));
        return !hasRelatedNorm;
      }
      return false;
    }

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      pageRenderTokens[pageNum] = perPageTokens[pageNum].filter(t => {
        if (t.type === 'acronym') return verifiedAcronyms.has(t.norm);
        // Non-body font or equation-line context: skip false-positive filter.
        if (t.parts[0]?.fontName !== documentBodyFont) return true;
        if (t.equationLine) return true;
        return !isFalsePositiveSingleLetter(t.norm);
      });
    }

    // Debug hook — inspect in console: window._varDebug
    window._varDebug = {
      bodyFont: documentBodyFont,
      perPageTokens,
      pageRenderTokens,
      allVarNorms: new Set(Object.values(perPageTokens).flat().filter(t=>t.type==='variable').map(t=>t.norm)),
    };
    const totalRender = Object.values(pageRenderTokens).flat().filter(t=>t.type==='variable').length;
    const totalRaw = Object.values(perPageTokens).flat().filter(t=>t.type==='variable').length;
    console.log(`[Var debug] body font: ${documentBodyFont} | raw tokens: ${totalRaw} | after filter: ${totalRender}`);
    console.log('[Var debug] page render counts:', Object.fromEntries(Object.entries(pageRenderTokens).map(([p,ts])=>[p, ts.filter(t=>t.type==='variable').length]).filter(([,n])=>n>0)));
  }

  // ── AI Definition Resolution (DeepSeek via server proxy) ────────────────────

  // Strip Unicode math chars to plain ASCII so the paper text reads cleanly
  // when sent to the model.
  function cleanHintText(text) {
    return Array.from(text || '').map(ch => {
      const code = ch.codePointAt(0);
      if (code < 128) return ch;
      if (ch in LETTERLIKE_MATH_LETTERS) return LETTERLIKE_MATH_LETTERS[ch];
      if (isMathAlphanumericLetter(ch)) return canonicalLetterChar(ch);
      return ' ';
    }).join('').replace(/\s+/g, ' ').trim();
  }

  // Build a clean readable text string from the first 8 pages.
  // This gives Gemini the full definitional context it needs without
  // sending the entire (often 30+ page) paper.
  function extractEightPageText() {
    const parts = [];
    for (let p = 1; p <= Math.min(8, Object.keys(pageTextContents).length); p++) {
      const tc = pageTextContents[p];
      if (!tc) break;
      const text = cleanHintText(tc.items.map(i => i.str).join(' ')).replace(/\s+/g, ' ').trim();
      if (text) parts.push(`[Page ${p}]\n${text}`);
    }
    // Cap at ~20 000 chars — well under Gemini's context limit and cheap to process
    return parts.join('\n\n').slice(0, 20000);
  }

  // Try to find an acronym's expansion pattern in the raw paper text.
  function findAcronymSnippet(norm) {
    const pageNums = Object.keys(pageTextContents).map(Number).sort((a, b) => a - b);
    for (const pageNum of pageNums) {
      const raw = pageTextContents[pageNum].items.map(i => i.str).join(' ');
      const m = new RegExp(`([A-Z][a-zA-Z -]{2,40})\\s*\\(\\s*${norm}\\s*\\)`, 'g').exec(raw);
      if (m) return `${m[1].trim()} (${norm})`;
    }
    return '';
  }

  // All AI calls go through the local proxy; the key lives in server.js only.
  async function callAI(prompt) {
    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 2048,
        },
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      const e = new Error(`HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      e.status = resp.status;
      throw e;
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('empty response: ' + JSON.stringify(data).slice(0, 200));
    return text;
  }

  async function resolveDefinitionsWithAI() {

    const varNorms = Object.keys(detectedVariables)
      .sort((a, b) => detectedVariables[b].count - detectedVariables[a].count)
      .slice(0, 60);
    const acrNorms = Object.keys(detectedAcronyms)
      .sort((a, b) => detectedAcronyms[b].count - detectedAcronyms[a].count)
      .slice(0, 20);
    if (!varNorms.length && !acrNorms.length) return;

    updateAPIStatus('loading');

    // ID map so AI never has to reproduce Unicode math symbols as keys
    const idMap = [];
    const itemLines = [];

    varNorms.forEach((norm, i) => {
      const id = `v${i}`;
      idMap.push({ id, norm, type: 'variable' });
      const sym = cleanHintText([...detectedVariables[norm].displays][0] || norm);
      itemLines.push(`${id}: ${sym} [var]`);
    });
    acrNorms.forEach((norm, i) => {
      const id = `a${i}`;
      idMap.push({ id, norm, type: 'acronym' });
      const expansion = findAcronymSnippet(norm);
      itemLines.push(`${id}: ${norm}${expansion ? ` — hint: ${expansion}` : ''} [acr]`);
    });

    // Full 8-page text gives Gemini the context it needs to give accurate
    // definitions — far better than the garbled 40-char snippets we used before.
    const paperText = extractEightPageText();

    const prompt = `You are reading the following academic paper (first 8 pages):

${paperText}

---
Based on the paper above, define each symbol listed below.
Write ONE line per item in this exact format:
  ID: plain-English description [tag]

Rules:
- [var]: 3-7 words describing what the variable IS. If it has subscripts, say what they index.
  Tags: dependent variable, exogenous, parameter, error term, estimator, index, density, other
- [acr]: the full spelled-out name only. No tag.

Examples:
v0: log per-capita income for household h in area a [dependent variable]
v1: vector of covariates for household h in area a [exogenous]
a0: Root Mean Squared Error

Symbols to define:
${itemLines.join('\n')}

Output ONLY the definition lines. No headers, no explanation.`;

    try {
      const raw = await callAI(prompt);
      console.log('[Var AI] model output:', raw.slice(0, 600));

      let loaded = 0;
      const idIndex = Object.fromEntries(idMap.map(e => [e.id, e]));
      for (const line of raw.split('\n')) {
        const m = line.match(/^(v\d+|a\d+)\s*:\s*(.+?)(?:\s*\[([^\]]+)\])?\s*$/i);
        if (!m) continue;
        const [, id, desc, tag] = m;
        const entry = idIndex[id];
        if (!entry) continue;
        if (entry.type === 'variable') {
          variableDefinitions[entry.norm] = desc.trim();
          if (tag) variableTags[entry.norm] = tag.trim();
          loaded++;
        } else {
          acronymDefinitions[entry.norm] = desc.trim();
          loaded++;
        }
      }
      console.log(`[Var AI] loaded ${loaded} / ${idMap.length} definitions`);
      applyCustomDefs(); // user edits always override AI
      updateAPIStatus(true, loaded);
    } catch (err) {
      console.error('[Var AI] failed:', err.message);
      updateAPIStatus('error', err.message);
    }
  }

  // Second pass: for variables that first appear after page 8 and got no definition,
  // find their first occurrence via pageRenderTokens (reliable — no Unicode search issues)
  // and ask AI with the surrounding page context.
  async function resolveRemainingVariables() {
    const missing = new Set(
      Object.keys(detectedVariables).filter(norm => !variableDefinitions[norm])
    );
    console.log(`[Var AI] second pass: ${missing.size} undefined —`, [...missing].join(', '));
    if (!missing.size) return;

    updateAPIStatus('loading');

    // Find first page each missing variable actually appears on
    const varFirstPage = {};
    const sortedPages = Object.keys(pageRenderTokens).map(Number).sort((a, b) => a - b);
    for (const pageNum of sortedPages) {
      for (const token of pageRenderTokens[pageNum] || []) {
        if (token.type === 'variable' && missing.has(token.norm) && !varFirstPage[token.norm]) {
          varFirstPage[token.norm] = pageNum;
        }
      }
    }
    console.log(`[Var AI] second pass found on pages:`, varFirstPage);

    const toResolve = Object.entries(varFirstPage).slice(0, 25).map(([norm, foundPage]) => {
      const displays = [...(detectedVariables[norm].displays || [norm])];
      const ctx = [];
      const total = Object.keys(pageTextContents).length;
      for (let p = Math.max(1, foundPage - 1); p <= Math.min(total, foundPage + 1); p++) {
        const tc = pageTextContents[p];
        if (tc) ctx.push(cleanHintText(tc.items.map(i => i.str).join(' ')));
      }
      return { norm, display: cleanHintText(displays[0] || norm), page: foundPage, context: ctx.join('\n\n').slice(0, 2500) };
    });

    if (!toResolve.length) return;

    const idMap = toResolve.map((v, i) => ({ id: `r${i}`, ...v }));
    const itemLines = idMap.map(v => `${v.id}: ${v.display} [var]`).join('\n');
    const contextBlocks = idMap.map(v => `[${v.display} — page ${v.page}]\n${v.context}`).join('\n\n---\n\n').slice(0, 9000);

    const prompt = `Academic paper analysis. Define each symbol using the context provided.
Write ONE line per symbol: ID: plain-English description [tag]
Tags: dependent variable, exogenous, parameter, error term, estimator, index, density, other

Symbols:
${itemLines}

Paper context:
${contextBlocks}

Output ONLY the definition lines.`;

    try {
      const raw = await callAI(prompt);
      const idIndex = Object.fromEntries(idMap.map(e => [e.id, e]));
      let loaded = 0;
      for (const line of raw.split('\n')) {
        const m = line.match(/^(r\d+)\s*:\s*(.+?)(?:\s*\[([^\]]+)\])?\s*$/i);
        if (!m) continue;
        const entry = idIndex[m[1]];
        if (!entry) continue;
        variableDefinitions[entry.norm] = m[2].trim();
        if (m[3]) variableTags[entry.norm] = m[3].trim();
        loaded++;
      }
      if (loaded > 0) {
        applyCustomDefs();
        const prev = parseInt(apiStatusText?.innerText?.match(/(\d+)/)?.[1] || '0');
        updateAPIStatus(true, prev + loaded);
        console.log(`[Var AI] resolved ${loaded} additional variables from later pages`);
      }
    } catch (err) {
      console.error('[Var AI] second pass failed:', err.message);
    }
  }

  // ── Citation Analysis ─────────────────────────────────────────────────────

  // Extract author + year from any citation text format:
  // "Autor et al. (2013)", "Herrendorf et al., 2014", "Rodrik, 2016", etc.
  function parseCitationText(text) {
    const yearMatch = text.match(/\b((?:19|20)\d{2}[a-z]?)\b/);
    const year = yearMatch?.[1] || '';
    const author = text
      .slice(0, yearMatch ? yearMatch.index : text.length)
      .replace(/[,;\(\)\[\]\.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { author, year };
  }

  // Common English words that start with a capital but are never author names.
  const NOT_AUTHOR_WORDS = new Set([
    'For','In','See','With','By','The','An','A','At','From','As','If',
    'When','Where','While','Although','Since','Because','However',
    'Therefore','Thus','Hence','This','These','That','Those',
    'Journal','Proceedings','American','European','International',
    'Review','Economics','Studies','Research','University','Institute',
    'We','Our','Their','Which','Who','Table','Figure','Section',
  ]);

  function isValidAuthor(name) {
    if (!name || name.length < 2) return false;
    const first = name.split(/\s+/)[0];
    return !NOT_AUTHOR_WORDS.has(first);
  }

  // Primary: use PDF annotation bounding boxes as click targets (exact positions,
  // format-agnostic). Look to the LEFT of each annotation on the same line to
  // find the author name, then grab the year from within or near the annotation.
  async function findAnnotationCitations(page, pageNum) {
    const annotations = await page.getAnnotations();
    const items = pageTextContents[pageNum]?.items || [];
    const results = [];
    const seenKeys = new Set();

    for (const ann of annotations) {
      if (ann.subtype !== 'Link') continue;
      const [x1, y1, x2, y2] = ann.rect;
      if (x2 - x1 < 2 || y2 - y1 < 2) continue;
      // Skip non-citation external URLs (journal pages, datasets, etc.)
      if (ann.url && !ann.url.includes('doi.org')) continue;

      const annMidY = (y1 + y2) / 2;
      const lineH = Math.max(y2 - y1, 8);

      // Grab text on the same line within 300pt left of the annotation
      // — wide enough to capture "Author et al." that precedes the "(Year)"
      const nearby = items
        .filter(it => {
          const iy = it.transform[5], ih = Math.abs(it.transform[3]);
          const cx = it.transform[4] + it.width / 2;
          return Math.abs((iy + ih / 2) - annMidY) < lineH * 1.5
              && cx > x1 - 300 && cx < x2 + 80;
        })
        .sort((a, b) => a.transform[4] - b.transform[4]);

      const text = nearby.map(i => i.str).join('').replace(/\s+/g, ' ').trim();
      if (!text || /https?:|www\.|@/.test(text)) continue;

      // Find ALL years in the annotation text — a single annotation can cover
      // a multi-citation group like "(A, 2016; B et al., 2022; C and D, 2023)".
      const yearRe = /\b((?:19|20)\d{2}[a-z]?)\b/g;
      let ym;
      while ((ym = yearRe.exec(text)) !== null) {
        const year = ym[1];
        // Author = last capitalised word-group (Unicode-aware) before this year
        const before = text.slice(0, ym.index).replace(/[()[\],;]/g, ' ').replace(/\s+/g, ' ').trim();
        const authorMatch = before.match(/([A-ZÀ-ÖØ-Þ][a-zA-Zà-öø-ÿ\-]+(?:\s+et\s+al\.|\s+(?:and|&)\s+[A-ZÀ-ÖØ-Þ][a-zA-Zà-öø-ÿ\-]+)?)\s*$/);
        const author = (authorMatch?.[1] || before.split(' ').filter(w => /^[A-ZÀ-ÖØ-Þ]/.test(w)).pop() || '').trim();
        if (!author || !isValidAuthor(author)) continue;
        const key = `${author}_${year}_${x1.toFixed(1)}_${y1.toFixed(1)}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        results.push({ text: `${author} (${year})`, author, year,
                       x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
      }
    }
    return results;
  }

  // Fallback: regex scan for papers whose PDFs lack embedded link annotations.
  // Handles Unicode/accented names (Antrás, Håkanson), hyphenated names
  // (Alfaro-Urena), and multi-citation parentheticals (A, 2020; B et al., 2021).
  function findCitationsOnPage(items) {
    if (!items?.length) return [];
    let fullText = '';
    const charMap = [];
    items.forEach((item, idx) => {
      for (let c = 0; c < item.str.length; c++) {
        charMap.push({ idx, prop: c / Math.max(item.str.length, 1) });
        fullText += item.str[c];
      }
      charMap.push({ idx, prop: 1 });
      fullText += ' ';
    });

    const results = [];
    const seen = new Set();

    // Author name component: capital (including Latin Extended), then letters/accents/hyphens.
    // Covers ASCII, most European scripts, and hyphenated surnames.
    const N = '[A-ZÀ-ÖØ-Þ][a-zA-Zà-öø-ÿ\\-]+';
    const AUTHOR = `${N}(?:\\s+et\\s+al\\.?|(?:\\s+and\\s+|\\s*&\\s*)${N}(?:\\s+${N})?)?`;
    const YEAR   = '\\d{4}[a-z]?';

    function pushResult(author, year, startIdx, len) {
      if (!isValidAuthor(author)) return;
      // Deduplicate by character position only — same citation at different
      // locations in the text gets its own highlight box.
      const posKey = `${startIdx}`;
      if (seen.has(posKey)) return;
      const si = charMap[startIdx];
      const ei = charMap[Math.min(startIdx + len - 1, charMap.length - 1)];
      if (!si || !ei) return;
      const s = items[si.idx], e = items[ei.idx];
      if (!s || !e) return;
      const x1 = s.transform[4] + si.prop * s.width;
      const x2 = e.transform[4] + ei.prop * e.width;
      if (x2 <= x1) return;
      seen.add(posKey);
      results.push({ text: `${author} (${year})`, author, year,
                     x: x1, y: s.transform[5], width: x2 - x1, height: Math.abs(s.transform[3]) });
    }

    // Pattern 1: Narrative — Author (Year) or Author et al. (Year)
    const narrativeRe = new RegExp(`\\b(${AUTHOR})\\s*\\(\\s*(${YEAR})(?=[;,\\s)])`, 'g');
    let m;
    while ((m = narrativeRe.exec(fullText)) !== null) {
      pushResult(m[1].trim(), m[2], m.index, m[0].length);
    }

    // Pattern 2: Parenthetical groups — (A, Year) or (A, Year; B et al., Year; C and D, Year)
    // Parse each semicolon-separated segment individually so multi-citation groups
    // produce one hoverable box per citation.
    const parenRe  = /\(([^)]{2,250})\)/g;
    const segRe    = new RegExp(`^\\s*(${AUTHOR})\\s*,\\s*(${YEAR})\\s*$`);
    while ((m = parenRe.exec(fullText)) !== null) {
      const inner = m[1];
      const base  = m.index + 1; // offset into fullText where inner starts
      let pos = 0;
      for (const seg of inner.split(/;/)) {
        const sm = seg.match(segRe);
        if (sm) {
          const idx = inner.indexOf(seg, pos);
          if (idx >= 0) pushResult(sm[1].trim(), sm[2], base + idx, seg.length);
        }
        pos += seg.length + 1; // +1 for the semicolon
      }
    }

    return results;
  }

  // Fetch the cited paper's metadata from Semantic Scholar, then CrossRef.
  async function fetchCitedAbstract(author, year) {
    try {
      const q = encodeURIComponent(`${author} ${year}`);
      const r = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&fields=title,abstract,year,authors&limit=5`
      );
      if (r.ok) {
        const data = await r.json();
        const hit = data.data?.find(p => String(p.year) === String(year) && p.abstract);
        if (hit) return { title: hit.title, abstract: hit.abstract };
      }
    } catch {}
    try {
      const q = encodeURIComponent(`${author} ${year}`);
      const r = await fetch(
        `https://api.crossref.org/works?query.bibliographic=${q}&rows=3&mailto=var@research.app`
      );
      if (r.ok) {
        const data = await r.json();
        const hit = data.message?.items?.find(p =>
          p['published-print']?.['date-parts']?.[0]?.[0] == year ||
          p['published-online']?.['date-parts']?.[0]?.[0] == year
        );
        if (hit) {
          const title = [].concat(hit.title || [])[0] || '';
          const abstract = (hit.abstract || '').replace(/<[^>]+>/g, '');
          return { title, abstract };
        }
      }
    } catch {}
    return null;
  }

  // Extract the text of ±1 page around where the citation is mentioned.
  function getCitationContext(pageNum) {
    const total = Object.keys(pageTextContents).length;
    const parts = [];
    for (let p = Math.max(1, pageNum - 1); p <= Math.min(total, pageNum + 1); p++) {
      const tc = pageTextContents[p];
      if (!tc) continue;
      parts.push(cleanHintText(tc.items.map(i => i.str).join(' ')));
    }
    return parts.join('\n\n').replace(/\s+/g, ' ').trim().slice(0, 4000);
  }

  // cited = { title, abstract } from fetchCitedAbstract, or null
  async function analyzeCitationRelationship(cite, pageNum, cited) {
    const context = getCitationContext(pageNum);
    const citedText = cited
      ? `Title: ${cited.title}\nAbstract: ${cited.abstract?.slice(0, 600) || '(not available)'}`
      : '(abstract not found)';

    const prompt = `Academic paper analysis. A user hovered over the citation "${cite.text}".

Passage where it appears:
${context}

Cited paper:
${citedText}

Write ONE sentence (max 30 words): what the cited paper showed, and why it is cited in this passage. Be specific and direct.`;

    return callAI(prompt);
  }

  // ── Citation Tooltip (same visual style as variable tooltip) ─────────────

  // Citation cache — persisted to localStorage per paper so analyses survive reloads.
  function citationCacheKey() { return `citation_cache:${currentPaperFilename}`; }
  function loadCitationCache() {
    try { return JSON.parse(localStorage.getItem(citationCacheKey()) || '{}'); }
    catch { return {}; }
  }
  function saveToCitationCache(key, value) {
    const cache = loadCitationCache();
    cache[key] = value;
    localStorage.setItem(citationCacheKey(), JSON.stringify(cache));
  }
  let citationCache = {}; // in-memory mirror, loaded per paper
  let citationHideTimer = null;
  let citationAnalyzing = false; // prevents hide while AI call is in-flight

  const citationTooltip = document.createElement('div');
  citationTooltip.className = 'var-tooltip citation-tooltip';
  citationTooltip.innerHTML = `
    <div class="var-tooltip-symbol citation-ref"></div>
    <div class="var-tooltip-desc citation-desc"></div>
  `;
  document.body.appendChild(citationTooltip);

  citationTooltip.addEventListener('mouseenter', () => clearTimeout(citationHideTimer));
  citationTooltip.addEventListener('mouseleave', () => {
    citationHideTimer = setTimeout(hideCitationTooltip, 150);
  });

  function hideCitationTooltip() {
    if (citationAnalyzing) return;
    citationTooltip.classList.remove('visible');
  }

  async function showCitationTooltip(cite, pageNum, anchorRect) {
    clearTimeout(citationHideTimer);
    // Also hide variable tooltip so they don't overlap
    cancelHideTooltip();
    hideTooltip();

    const refEl  = citationTooltip.querySelector('.citation-ref');
    const descEl = citationTooltip.querySelector('.citation-desc');
    const cacheKey = `${cite.author}_${cite.year}`;

    refEl.textContent = cite.text;

    // Position identically to variable tooltip: centred above the box
    const x = anchorRect.left + anchorRect.width / 2;
    const y = anchorRect.top;
    citationTooltip.style.left = `${x + window.scrollX}px`;
    citationTooltip.style.top  = `${y + window.scrollY}px`;

    if (citationCache[cacheKey]) {
      descEl.textContent = citationCache[cacheKey];
      citationTooltip.classList.add('visible');
      return;
    }

    descEl.textContent = 'give me a second';
    citationTooltip.classList.add('visible');
    citationAnalyzing = true;

    try {
      const cited = await fetchCitedAbstract(cite.author, cite.year);
      descEl.textContent = 'ok maybe two seconds';

      const analysis = await analyzeCitationRelationship(cite, pageNum, cited);
      citationCache[cacheKey] = analysis;
      saveToCitationCache(cacheKey, analysis);
      descEl.textContent = analysis;
    } catch (err) {
      descEl.textContent = `Could not analyze: ${err.message}`;
    } finally {
      citationAnalyzing = false;
    }
  }

  // ── Native PDF Rendering & Overlays (Pass 2) ─────────────────────────────

  let pdfViewerDoc = null;
  let currentPaperFilename = '';
  let currentPaperTitle = '';

  async function extractPaperTitle(pdf) {
    // Try PDF metadata first
    try {
      const meta = await pdf.getMetadata();
      const t = meta?.info?.Title?.trim();
      if (t && t.length > 4) return t;
    } catch {}
    // Fall back: largest-font text near the top of page 1
    const items = pageTextContents[1]?.items || [];
    if (!items.length) return '';
    const maxH = Math.max(...items.map(i => Math.abs(i.transform[3])));
    const topItems = items
      .filter(i => Math.abs(i.transform[3]) >= maxH * 0.72 && i.str.trim().length > 1)
      .sort((a, b) => b.transform[5] - a.transform[5]);
    if (!topItems.length) return '';
    const refY = topItems[0].transform[5];
    const line = topItems.filter(i => Math.abs(i.transform[5] - refY) < 6);
    return line.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  // ── AI-generated definitions cache (persist in localStorage per paper) ───────

  function aiDefsKey() { return `var_ai_defs:${currentPaperFilename}`; }

  function loadAIDefs() {
    try { return JSON.parse(localStorage.getItem(aiDefsKey()) || 'null'); }
    catch { return null; }
  }

  function saveAIDefs() {
    const payload = {
      defs: variableDefinitions,
      tags: variableTags,
      acrs: acronymDefinitions,
    };
    try { localStorage.setItem(aiDefsKey(), JSON.stringify(payload)); } catch {}
  }

  // ── Custom user definitions (persist in localStorage per paper) ────────────

  function customDefsKey() {
    return `var_custom:${currentPaperFilename}`;
  }

  function loadCustomDefs() {
    try { return JSON.parse(localStorage.getItem(customDefsKey()) || '{}'); }
    catch { return {}; }
  }

  function saveCustomDef(norm, desc, isAcr) {
    if (isAcr) acronymDefinitions[norm] = desc;
    else variableDefinitions[norm] = desc;
    const all = loadCustomDefs();
    all[norm] = { desc, isAcr };
    localStorage.setItem(customDefsKey(), JSON.stringify(all));
  }

  // Called after AI finishes — user edits always win over AI-generated text.
  function applyCustomDefs() {
    Object.entries(loadCustomDefs()).forEach(([norm, { desc, isAcr }]) => {
      if (!desc) return;
      if (isAcr) acronymDefinitions[norm] = desc;
      else variableDefinitions[norm] = desc;
    });
  }

  function resetColorState() {
    hueIndex = 0;
    acrHueIndex = 0;
    Object.keys(baseHues).forEach(k => delete baseHues[k]);
    Object.keys(variantCounts).forEach(k => delete variantCounts[k]);
  }

  async function renderPDFViewer(arrayBuffer, filename) {
    currentPaperFilename = filename;
    citationCache = loadCitationCache(); // restore saved analyses for this paper
    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    if (!pdfjsLib) {
      throw new Error('PDF.js library failed to load.');
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    pdfViewerDoc = pdf;

    // Pass 1: Contextual Analysis
    await analyzeDocumentContext(pdf);
    currentPaperTitle = await extractPaperTitle(pdf);

    // Switch UI
    dashboardView.style.display = 'none';
    readerView.style.display = 'flex';
    backBtn.style.display = 'block';

    readerContainer.innerHTML = '';
    detectedVariables = {};
    detectedAcronyms = {};
    dismissedTooltips.clear();
    resetColorState();

    // Pass 2: Rendering
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);

      // Calculate scale to fit container (max-width 900px)
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      // Render at a higher resolution for crispness, CSS will scale it down
      const RENDER_SCALE = 2.0;
      const viewport = page.getViewport({ scale: RENDER_SCALE });

      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page-container';
      pageContainer.setAttribute('data-page-num', pageNum);
      const CSS_SCALE = 1.5;
      const cssViewport = page.getViewport({ scale: CSS_SCALE });
      pageContainer.style.width = `${cssViewport.width}px`;
      pageContainer.style.height = `${cssViewport.height}px`;

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-canvas';
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const highlightLayer = document.createElement('div');
      highlightLayer.className = 'highlight-layer';

      (pageRenderTokens[pageNum] || []).forEach(token => {
        const isAcr = token.type === 'acronym';
        const color = isAcr ? getAcronymColor(token.norm) : getVariableColor(token.norm);
        const store = isAcr ? detectedAcronyms : detectedVariables;
        store[token.norm].count++;
        store[token.norm].displays.add(token.display);

        // For acronyms: group parts that share the same line (within 3pt vertically)
        // and draw one merged box per line-group so letters rendered as separate
        // PDF items don't produce multiple slightly-misaligned boxes.
        const partGroups = [];
        if (isAcr) {
          token.parts.forEach(part => {
            const existing = partGroups.find(g => Math.abs(g.y - part.y) < 3);
            if (existing) {
              existing.x2 = Math.max(existing.x2, part.x + part.width);
              existing.height = Math.max(existing.height, part.height);
            } else {
              partGroups.push({ y: part.y, x: part.x, x2: part.x + part.width, height: part.height });
            }
          });
        } else {
          token.parts.forEach(p => partGroups.push({ y: p.y, x: p.x, x2: p.x + p.width, height: p.height, single: true }));
        }

        partGroups.forEach(group => {
          const pdfYFromTop = unscaledViewport.height - group.y;
          const highlightBox = document.createElement('div');
          highlightBox.className = 'variable-highlight';
          highlightBox.setAttribute('data-norm', token.norm);
          highlightBox.style.backgroundColor = color;

          if (isAcr) {
            const capH = group.height * 0.72;
            highlightBox.style.left   = `${group.x * CSS_SCALE - 1}px`;
            highlightBox.style.top    = `${(pdfYFromTop - capH) * CSS_SCALE - 1}px`;
            highlightBox.style.width  = `${(group.x2 - group.x) * CSS_SCALE + 2}px`;
            highlightBox.style.height = `${capH * CSS_SCALE + 2}px`;
            highlightBox.style.borderBottom = `2px solid rgba(0,0,0,0.2)`;
            highlightBox.style.opacity = '0.6';
          } else {
            const h = group.height;
            highlightBox.style.left   = `${group.x * CSS_SCALE - 2}px`;
            highlightBox.style.top    = `${(pdfYFromTop - h) * CSS_SCALE - 2}px`;
            highlightBox.style.width  = `${(group.x2 - group.x) * CSS_SCALE + 4}px`;
            highlightBox.style.height = `${h * CSS_SCALE + 4}px`;
          }

          highlightBox.addEventListener('mouseenter', () => {
            if (dismissedTooltips.has(token.norm)) return;
            const rect = highlightBox.getBoundingClientRect();
            if (isAcr) {
              const expansion = acronymDefinitions[token.norm];
              const fallback = !expansion ? findAcronymSnippet(token.norm) : null;
              showTooltip(rect.left + rect.width / 2, rect.top, token.display, expansion || fallback || null, token.norm, false);
            } else {
              const desc = variableDefinitions[token.norm] || null;
              const tag  = variableTags[token.norm] ? `#${variableTags[token.norm]}` : null;
              showTooltip(rect.left + rect.width / 2, rect.top, token.display, desc, token.norm, true, tag);
            }
          });

          highlightBox.addEventListener('mouseleave', scheduleHideTooltip);
          highlightLayer.appendChild(highlightBox);
        });
      });

      // Draw citation overlays and make all embedded hyperlinks clickable.
      if (settings.citations && !referencePageNums.has(pageNum)) {
        // Merge annotation-based (precise positions) with regex-based (catches
        // citations that annotation detection misses). Deduplicate by author+year.
        const annCites   = await findAnnotationCitations(page, pageNum);
        const regexCites = findCitationsOnPage(pageTextContents[pageNum]?.items);
        const seen = new Set(annCites.map(c => `${c.author}_${c.year}`));
        const cites = [
          ...annCites,
          ...regexCites.filter(c => !seen.has(`${c.author}_${c.year}`)),
        ];
        cites.forEach(cite => {
          const pdfYFromTop = unscaledViewport.height - cite.y;
          const box = document.createElement('div');
          box.className = 'citation-highlight';
          box.style.left   = `${cite.x * CSS_SCALE - 1}px`;
          box.style.top    = `${(pdfYFromTop - cite.height) * CSS_SCALE - 1}px`;
          box.style.width  = `${cite.width * CSS_SCALE + 2}px`;
          box.style.height = `${cite.height * CSS_SCALE + 2}px`;
          box.title = cite.text;
          box.addEventListener('mouseenter', () => {
            const rect = box.getBoundingClientRect();
            showCitationTooltip(cite, pageNum, rect);
          });
          box.addEventListener('mouseleave', () => {
            citationHideTimer = setTimeout(hideCitationTooltip, 150);
          });
          highlightLayer.appendChild(box);
        });

        // All other URL hyperlinks embedded in the PDF → open in new tab
        const allAnnotations = await page.getAnnotations();
        allAnnotations.forEach(ann => {
          if (ann.subtype !== 'Link' || !ann.url) return;
          const [x1, y1, x2, y2] = ann.rect;
          if (x2 - x1 < 2 || y2 - y1 < 2) return;
          const pdfYFromTop = unscaledViewport.height - y2;
          const link = document.createElement('div');
          link.className = 'pdf-hyperlink';
          link.style.left   = `${x1 * CSS_SCALE}px`;
          link.style.top    = `${pdfYFromTop * CSS_SCALE}px`;
          link.style.width  = `${(x2 - x1) * CSS_SCALE}px`;
          link.style.height = `${(y2 - y1) * CSS_SCALE}px`;
          link.title = ann.url;
          link.addEventListener('click', e => { e.stopPropagation(); window.open(ann.url, '_blank', 'noopener'); });
          highlightLayer.appendChild(link);
        });
      }

      pageContainer.appendChild(canvas);
      pageContainer.appendChild(highlightLayer);
      readerContainer.appendChild(pageContainer);
    }

    // Apply any user-saved custom definitions immediately (before AI runs),
    // so returning users see their edits right away.
    applyCustomDefs();

    // Run both AI passes sequentially (or restore from cache).
    // Demo paper uses a pre-baked JSON so it never hits the AI API.
    (async () => {
      if (currentPaperFilename === 'demo.pdf') {
        try {
          const res = await fetch('/demo-analysis.json');
          const data = await res.json();
          Object.assign(variableDefinitions, data.defs || {});
          Object.assign(variableTags, data.tags || {});
          Object.assign(acronymDefinitions, data.acrs || {});
          applyCustomDefs();
          updateAPIStatus(true, Object.keys(variableDefinitions).length);
        } catch (err) {
          console.error('[Var] failed to load demo analysis:', err);
        }
        return;
      }
      const cached = loadAIDefs();
      if (cached && Object.keys(cached.defs || {}).length >= 3) {
        Object.assign(variableDefinitions, cached.defs || {});
        Object.assign(variableTags, cached.tags || {});
        Object.assign(acronymDefinitions, cached.acrs || {});
        applyCustomDefs();
        updateAPIStatus(true, Object.keys(variableDefinitions).length);
        console.log('[Var AI] definitions restored from cache');
      } else {
        await resolveDefinitionsWithAI();
        await resolveRemainingVariables();
        const defCount = Object.keys(variableDefinitions).length;
        if (defCount >= 3) {
          saveAIDefs();
        } else {
          showLowDetectionWarning(defCount);
        }
      }
    })();
  }

  // HSL hues suitable for pastel highlights
  const BASE_HUES = [
    50,   // Yellow
    25,   // Orange
    120,  // Green
    190,  // Cyan
    240,  // Blue
    300,  // Pink
    210,  // Light Blue
    10    // Red/Salmon
  ];
  let hueIndex = 0;
  
  const baseHues = {}; // baseSymbol -> hue
  const variantCounts = {}; // baseSymbol -> count
  let detectedVariables = {}; // normSymbol -> { color, count, displays: Set, hidden }
  
  function getBaseSymbol(normSymbol) {
    return normSymbol.split(/[_^]/)[0]; // Y_it -> Y, α_i -> α
  }

  // The same logical variable can show up styled inconsistently across a
  // document — e.g. a plain ASCII "e" typed in italic prose vs. the Unicode
  // Mathematical Alphanumeric "𝑒" that Word/MathType insert for an actual
  // equation object. Map Latin Mathematical Alphanumeric letters back to
  // plain ASCII so both stylings land in the same color family. (Greek and
  // accented letters are left alone — those usually denote a genuinely
  // different derived quantity, e.g. ē "e-bar" vs e.)
  const MATH_ALPHANUMERIC_LATIN_START = 0x1D400;
  const MATH_ALPHANUMERIC_LATIN_END = 0x1D6A3;
  function canonicalLetterChar(ch) {
    if (ch in LETTERLIKE_MATH_LETTERS) return LETTERLIKE_MATH_LETTERS[ch];
    const code = ch.codePointAt(0);
    if (code >= MATH_ALPHANUMERIC_LATIN_START && code <= MATH_ALPHANUMERIC_LATIN_END) {
      const offset = (code - MATH_ALPHANUMERIC_LATIN_START) % 52;
      return String.fromCharCode(offset < 26 ? 65 + offset : 97 + (offset - 26));
    }
    return ch;
  }

  // Parse a norm like "𝑦_𝑎ℎ" into { base: "y", sub: "a,h" } for tooltip display.
  function parseNormForDisplay(norm) {
    const under = norm.indexOf('_');
    const rawBase = under === -1 ? norm : norm.slice(0, under);
    const base = Array.from(rawBase).map(canonicalLetterChar).join('');
    if (under === -1) return { base, sub: null };
    const subChars = Array.from(norm.slice(under + 1))
      .map(ch => ch === '_' ? ',' : canonicalLetterChar(ch));
    return { base, sub: subChars.join(',').replace(/,+/g, ',') };
  }

  // Generates an unbounded sequence of well-spread, never-repeating values
  // in [0, 1) — the Van der Corput sequence (bit-reversal of n in base 2).
  // Used so that a base letter with many subscript variants (a paper can
  // easily have σ, σ_i, σ_k, σ_u, σ_ε, σ_1, σ_2, ...) never runs out of
  // distinguishable shades and silently reuses one, the way a fixed-size
  // lookup table of shades would once exhausted.
  function vanDerCorput(n) {
    let q = 0, bk = 0.5;
    while (n > 0) {
      q += (n % 2) * bk;
      n = Math.floor(n / 2);
      bk /= 2;
    }
    return q;
  }

  function getVariableColor(normSymbol) {
    if (!detectedVariables[normSymbol]) {
      const base = canonicalLetterChar(getBaseSymbol(normSymbol));

      if (baseHues[base] === undefined) {
        baseHues[base] = BASE_HUES[hueIndex % BASE_HUES.length];
        hueIndex++;
        variantCounts[base] = 0;
      }

      const h = baseHues[base];
      const variantIdx = variantCounts[base];
      variantCounts[base]++;

      // Same hue for every variant of this base symbol; each distinct
      // subscript variant gets its own shade, light to dark, that never
      // collides with another variant's shade no matter how many exist.
      const MIN_LIGHTNESS = 40, MAX_LIGHTNESS = 88;
      const l = MIN_LIGHTNESS + vanDerCorput(variantIdx + 1) * (MAX_LIGHTNESS - MIN_LIGHTNESS);

      const color = `hsl(${h}, 80%, ${l}%)`;
      
      detectedVariables[normSymbol] = {
        color: color,
        count: 0,
        displays: new Set(),
        hidden: false
      };
    }
    return detectedVariables[normSymbol].color;
  }

  // ── Acronym Logic ────────────────────────────────────────────────────────

  const STOP_WORDS = new Set(["THE", "AND", "BUT", "FOR", "NOR", "NOT", "YET", "SO", "IF", "OR", "BE", "AM", "IS", "ARE", "WAS", "WERE", "BEEN", "BEING", "HAVE", "HAS", "HAD", "DO", "DOES", "DID", "CAN", "COULD", "WILL", "WOULD", "SHALL", "SHOULD", "MAY", "MIGHT", "MUST", "OF", "AT", "BY", "IN", "TO", "ON", "WITH", "AS", "IT", "HE", "SHE", "WE", "THEY", "YOU", "ME", "US", "HIM", "HER", "THEM", "MY", "YOUR", "OUR", "THEIR", "HIS", "ITS", "THIS", "THAT", "THESE", "THOSE", "FROM", "AN", "NO", "A", "I", "FIG", "TABLE"]);

  function isCandidateAcronym(text) {
    const s = text.trim();
    if (s.length < 2 || s.length > 7) return false;
    if (/^[A-Z]{2,7}s?$/.test(s)) {
      const upper = s.replace(/s$/, ''); // remove plural
      if (STOP_WORDS.has(upper)) return false;
      return true;
    }
    return false;
  }

  const ACRONYM_HUES = [ 0, 30, 160, 280, 20 ];
  let acrHueIndex = 0;
  let detectedAcronyms = {}; // normSymbol -> { color, count, displays: Set, hidden }

  function getAcronymColor(norm) {
    if (!detectedAcronyms[norm]) {
      const h = ACRONYM_HUES[acrHueIndex % ACRONYM_HUES.length];
      acrHueIndex++;
      const color = `hsl(${h}, 60%, 80%)`;
      detectedAcronyms[norm] = { color, count: 0, displays: new Set(), hidden: false };
    }
    return detectedAcronyms[norm].color;
  }

  // --- Tooltip Logic ---
  const dismissedTooltips = new Set();
  let activeTooltipNorm = null;
  let activeTooltipIsAcr = false;
  let hideTooltipTimer = null;

  const tooltip = document.createElement('div');
  tooltip.className = 'var-tooltip';
  tooltip.innerHTML = `
    <div class="var-tooltip-header">
      <div class="var-tooltip-symbol"></div>
      <button class="var-tooltip-edit-btn" title="Edit definition">✏ Edit</button>
    </div>
    <div class="var-tooltip-desc"></div>
    <div class="var-tooltip-edit-area">
      <textarea class="var-tooltip-textarea" rows="3" placeholder="Type your definition or notes…"></textarea>
      <div class="var-tooltip-save-row">
        <button class="var-tooltip-save-btn">Save</button>
        <button class="var-tooltip-cancel-btn">Cancel</button>
      </div>
    </div>
    <div class="var-tooltip-tag"></div>
    <label class="var-tooltip-dismiss">
      <input type="checkbox" class="var-tooltip-dismiss-check"> don't show again
    </label>
  `;
  document.body.appendChild(tooltip);

  const editBtn     = tooltip.querySelector('.var-tooltip-edit-btn');
  const editArea    = tooltip.querySelector('.var-tooltip-edit-area');
  const editText    = tooltip.querySelector('.var-tooltip-textarea');
  const saveBtn     = tooltip.querySelector('.var-tooltip-save-btn');
  const cancelBtn   = tooltip.querySelector('.var-tooltip-cancel-btn');
  const descEl      = tooltip.querySelector('.var-tooltip-desc');

  let tooltipPinned = false; // true while the edit box is open

  function openEditArea() {
    cancelHideTooltip();
    tooltipPinned = true;
    editText.value = descEl.textContent;
    descEl.style.display = 'none';
    editArea.style.display = 'flex';
    editBtn.style.display = 'none';
    // Switch to fixed/centered position so it stays visible wherever the cursor goes
    tooltip.classList.add('pinned');
    editText.focus();
  }

  function closeEditArea() {
    tooltipPinned = false;
    tooltip.classList.remove('pinned');
    editArea.style.display = 'none';
    editBtn.style.display = '';
    descEl.style.display = descEl.textContent ? '' : 'none';
  }

  editBtn.addEventListener('click', openEditArea);

  cancelBtn.addEventListener('click', () => {
    closeEditArea();
  });

  saveBtn.addEventListener('click', () => {
    const newDesc = editText.value.trim();
    if (activeTooltipNorm) {
      saveCustomDef(activeTooltipNorm, newDesc, activeTooltipIsAcr);
      descEl.textContent = newDesc;
      // Mark as user-edited
      tooltip.querySelector('.var-tooltip-symbol').classList.toggle('var-tooltip-edited', !!newDesc);
    }
    closeEditArea();
  });

  // Save on Ctrl/Cmd+Enter in the textarea
  editText.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveBtn.click();
    if (e.key === 'Escape') cancelBtn.click();
  });

  tooltip.querySelector('.var-tooltip-dismiss-check').addEventListener('change', () => {
    if (!activeTooltipNorm) return;
    dismissedTooltips.add(activeTooltipNorm);
    const norm = activeTooltipNorm;
    document.querySelectorAll('.variable-highlight').forEach(el => {
      if (el.getAttribute('data-norm') === norm) el.style.display = 'none';
    });
    hideTooltip();
  });

  tooltip.addEventListener('mouseenter', cancelHideTooltip);
  tooltip.addEventListener('mouseleave', scheduleHideTooltip);

  const customDefs = loadCustomDefs(); // cache for edited-indicator check

  function showTooltip(x, y, display, desc, norm, isVar, tag) {
    cancelHideTooltip();
    closeEditArea(); // reset any open editor
    activeTooltipNorm = norm;
    activeTooltipIsAcr = !isVar;

    const symbolEl = tooltip.querySelector('.var-tooltip-symbol');
    if (isVar) {
      const { base, sub } = parseNormForDisplay(norm);
      symbolEl.innerHTML = sub ? `${base}<sub>${sub}</sub>` : base;
    } else {
      symbolEl.textContent = display;
    }
    // Show a small indicator when this definition was user-edited
    symbolEl.classList.toggle('var-tooltip-edited', !!(loadCustomDefs()[norm]?.desc));

    descEl.textContent = desc || '';
    descEl.style.display = desc ? '' : 'none';

    const tagEl = tooltip.querySelector('.var-tooltip-tag');
    tagEl.textContent = tag || '';
    tagEl.style.display = tag ? '' : 'none';

    tooltip.querySelector('.var-tooltip-dismiss-check').checked = false;
    tooltip.style.left = `${x + window.scrollX}px`;
    tooltip.style.top  = `${y  + window.scrollY}px`;
    tooltip.classList.add('visible');
  }

  function hideTooltip() {
    cancelHideTooltip();
    tooltip.classList.remove('visible');
    activeTooltipNorm = null;
  }

  function scheduleHideTooltip() {
    if (tooltipPinned) return; // edit mode — never auto-hide
    hideTooltipTimer = setTimeout(hideTooltip, 120);
  }

  function cancelHideTooltip() {
    if (hideTooltipTimer) { clearTimeout(hideTooltipTimer); hideTooltipTimer = null; }
  }

  // ── Quick Dictionary Double Click ──────────────────────────────────────────

  readerContainer.addEventListener('dblclick', async (e) => {
    const pageContainer = e.target.closest('.pdf-page-container');
    if (!pageContainer) return;
    
    const pageNum = parseInt(pageContainer.getAttribute('data-page-num'));
    if (!pageNum || !pageTextContents[pageNum]) return;
    
    const rect = pageContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const CSS_SCALE = 1.5;
    const pdfX = x / CSS_SCALE;
    const pdfYFromTop = y / CSS_SCALE;
    
    const page = await pdfViewerDoc.getPage(pageNum);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const pdfY = unscaledViewport.height - pdfYFromTop;
    
    const textContent = pageTextContents[pageNum];
    let clickedWord = null;
    let highlightData = null;
    
    textContent.items.forEach(item => {
      const tx = item.transform[4];
      const ty = item.transform[5];
      const textWidth = item.width;
      const textHeight = Math.abs(item.transform[3]);
      
      const padding = 3;
      const isInsideX = pdfX >= tx - padding && pdfX <= tx + textWidth + padding;
      const isInsideY = pdfY >= ty - padding && pdfY <= ty + textHeight + padding;
      
      if (isInsideX && isInsideY) {
        const str = item.str.trim();
        if (!str) return;
        
        let relX = pdfX - tx;
        if (relX < 0) relX = 0;
        if (relX > textWidth) relX = textWidth;
        
        const charRatio = relX / textWidth;
        const charIndex = Math.max(0, Math.min(str.length - 1, Math.floor(charRatio * str.length)));
        
        let left = charIndex;
        while (left > 0 && /[a-zA-Z]/.test(str[left - 1])) left--;
        
        let right = charIndex;
        while (right < str.length - 1 && /[a-zA-Z]/.test(str[right + 1])) right++;
        
        const word = str.substring(left, right + 1).replace(/[^a-zA-Z]/g, '');
        if (word.length >= 2) {
          clickedWord = word.toLowerCase();
          
          const wordWidthRatio = (right - left + 1) / str.length;
          const wordOffsetRatio = left / str.length;
          
          highlightData = {
            left: (tx + (textWidth * wordOffsetRatio)) * CSS_SCALE,
            top: ((unscaledViewport.height - ty) - textHeight) * CSS_SCALE,
            width: (textWidth * wordWidthRatio) * CSS_SCALE,
            height: textHeight * CSS_SCALE,
            pageContainer: pageContainer
          };
        }
      }
    });
    
    if (clickedWord) {
      lookupDictionary(clickedWord, highlightData);
    }
  });

  async function lookupDictionary(word, highlightData) {
    const dictWordEl = document.getElementById('dict-word');
    const dictDefEl = document.getElementById('dict-definition');
    if (!dictWordEl || !dictDefEl) return;
    
    // Manage visual highlights
    document.querySelectorAll('.word-definition-highlight').forEach(el => el.remove());
    if (highlightData) {
      const hlLayer = highlightData.pageContainer.querySelector('.highlight-layer');
      if (hlLayer) {
        const hl = document.createElement('div');
        hl.className = 'word-definition-highlight';
        hl.style.position = 'absolute';
        hl.style.left = `${highlightData.left - 2}px`;
        hl.style.top = `${highlightData.top - 2}px`;
        hl.style.width = `${highlightData.width + 4}px`;
        hl.style.height = `${highlightData.height + 4}px`;
        // Soft yellow highlight color handled by CSS, mix-blend-mode for realism
        hl.style.backgroundColor = '#FEF3C7';
        hl.style.mixBlendMode = 'multiply';
        hl.style.zIndex = '5';
        hl.style.borderRadius = '3px';
        hlLayer.appendChild(hl);
      }
    }
    
    dictWordEl.innerText = word;
    dictDefEl.innerHTML = `<em>Loading definition...</em>`;
    
    const card = document.getElementById('dictionary-card');
    card.style.outline = '2px solid var(--color-primary)';
    setTimeout(() => { card.style.outline = 'none'; }, 600);
    
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (!res.ok) throw new Error('Not found');
      
      const data = await res.json();
      const meaning = data[0].meanings[0];
      const def = meaning.definitions[0].definition;
      
      dictWordEl.innerText = data[0].word;
      dictDefEl.innerHTML = `<strong>${meaning.partOfSpeech}</strong>: ${def}`;
    } catch (err) {
      dictDefEl.innerHTML = `
        <span style="color:#ef4444;">No definition found.</span>
        <br><br>
        <a href="https://www.google.com/search?q=define+${encodeURIComponent(word)}" target="_blank" style="color:var(--color-primary);text-decoration:none;">Search on Google &rarr;</a>
      `;
    }
  }

});
