/* global chrome, LanguageModel, Summarizer */

// Lightweight article extraction using Readability when available.
async function extractArticle(){
  try{
    const docClone = document.cloneNode(true);
    // Readability may exist if a site includes it or we ship it; attempt safe access
    if(window.Readability){
      const reader = new window.Readability(docClone);
      const res = reader.parse();
      if(res?.textContent) return { title: res.title || document.title, text: res.textContent };
    }
  }catch(_e){ /* ignore, fall back */ }

  // Fallback: grab main article-ish text
  // Build article content lazily from the main headline and relevant paragraphs only
  const headline = document.querySelector('h1, h1 span')?.textContent?.trim() || document.title;
  const main = document.querySelector('article, main') || document.body;
  const isAdOrNoise = (el)=>{
    const cls = (el.className||'').toString().toLowerCase();
    const id = (el.id||'').toString().toLowerCase();
    const text = el.textContent||'';
    return /\b(ad|ads|advert|sponsored|promo|subscribe|signup|cookie|modal|share|listen)\b/.test(cls+" "+id) || text.length < 30;
  };
  const paras = Array.from(main.querySelectorAll('p'))
    .filter(p=>!isAdOrNoise(p))
    .map(p=>p.innerText.trim())
    .filter(Boolean);
  const text = [headline, ...paras].join('\n');
  const img = (main.querySelector('figure img') || main.querySelector('img'))?.src || null;
  return { title: headline, text, image: img };
}

// Summarizer API (built-in) with graceful fallback
async function summarizeText(text){
  try{
    // UPDATED: Check for global 'Summarizer' and use .availability()
    if('Summarizer' in self){
      const availability = await Summarizer.availability();
      if(availability === 'available'){ // UPDATED: Check for 'available' state
        const s = await Summarizer.create({ type: 'article' }); // UPDATED: Use global Summarizer
        // Request more detailed output
        return await s.summarize(text, { length: 'long' });
      }
    }
  }catch(_e){ }
  // Simple extractive fallback with cleanup
  const cleaned = text
    .replace(/\b(Member-only story|Listen|Share)\b/gi,'')
    .replace(/^\s*\d+\s*$/gm,'')
    .replace(/^\s*[A-Z]$/gm,'');
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(s=>s.length>40);
  return sentences.slice(0,10).join(' ');
}

// Modular topic extraction with stopword filtering
function extractTopics(text){
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/);
  const stopwords = new Set(['the','a','an','and','or','of','to','in','for','on','with','by','is','are','was','were','this','that','as','from','it','be','at']);
  const frequency = new Map();
  for(const word of words){
    if(!word || stopwords.has(word)) continue;
    frequency.set(word, (frequency.get(word)||0)+1);
  }
  // Only keep words longer than 2 characters for relevance
  const topTopics = [...frequency.entries()]
    .filter(([w])=>w.length>2)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,10)
    .map(([w])=>w);
  return topTopics;
}

// Remove common UI debris or site labels from text
function cleanNoise(text){
  return text
    .replace(/\b(Member-only story|Member|Listen|Share)\b/gi,'')
    .replace(/^\s*\d+\s*$/gm,'')
    .replace(/^\s*[A-Z]$/gm,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}

function ensureRoot(){
  let root = document.querySelector('.ilx-root');
  if(root) return root;
  root = document.createElement('div');
  root.className = 'ilx-root';
  document.documentElement.appendChild(root);
  return root;
}

function mountCard(title){
  const root = ensureRoot();
  const card = document.createElement('div');
  card.className = 'ilx-card';
  card.innerHTML = `
    <div class="ilx-header">
      <div class="ilx-title">${title}</div>
      <button class="ilx-close" aria-label="Close">✕</button>
    </div>
    <div class="ilx-body"></div>
  `;
  root.appendChild(card);
  card.querySelector('.ilx-close').addEventListener('click', ()=>{
    // if card is inside a fullscreen overlay, remove the overlay as well
    const overlay = card.closest('.ilx-fullscreen-overlay');
    if(overlay){ overlay.remove(); }
    card.remove();
  });
  // create top-left handle for resizing while keeping bottom-right fixed
  const resizer = document.createElement('div');
  resizer.className = 'ilx-resizer-tl';
  // add a small expand icon inside the resizer for clarity
  resizer.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h6V4H4v8h2V6zm12 12h-6v2h8v-8h-2v6zM6 18h2v-6H4v8h8v-2H6zM18 6v2h2V4h-8v2h6z"></path></svg>';
  card.appendChild(resizer);
  // center title for all cards
  const t = card.querySelector('.ilx-title');
  if(t) t.classList.add('centered');
  (function(){
    let dragging = false, startX=0, startY=0, startW=0, startH=0;
    resizer.addEventListener('mousedown', (e)=>{
      e.preventDefault(); dragging = true;
      startX = e.clientX; startY = e.clientY;
      startW = card.offsetWidth; startH = card.offsetHeight;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    function onMove(e){
      if(!dragging) return;
      // moving left/up should increase size — keep bottom-right fixed
      const dx = startX - e.clientX; // positive when moved left
      const dy = startY - e.clientY; // positive when moved up
      const newW = Math.max(350, startW + dx);
      const newH = Math.max(350, startH + dy);
      card.style.width = newW + 'px';
      card.style.height = newH + 'px';
      // ensure card remains anchored at bottom-right
      card.style.right = '16px';
      card.style.bottom = '16px';
    }
    function onUp(){ dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
  })();
  // return card.querySelector('.ilx-body');
  const body = card.querySelector('.ilx-body');
  installLoader(body);
  return body;
}

function installLoader(body) {
  if (!body || body.querySelector('.ilx-loader')) return;
  const loader = document.createElement('div');
  loader.className = 'ilx-loader hidden';
  loader.innerHTML = `
    <div class="ilx-spinner"></div>
    <div class="ilx-status">Loading…</div>
  `;
  body.appendChild(loader);
}

// 2) ADD loader helpers anywhere below your mount/render utilities
function showLoader(body, text = 'Loading…') {
  const loader = body?.querySelector('.ilx-loader');
  if (!loader) return;
  const status = loader.querySelector('.ilx-status');
  if (status && text) status.textContent = text;
  loader.classList.remove('hidden');
}

function hideLoader(body) {
  const loader = body?.querySelector('.ilx-loader');
  if (!loader) return;
  loader.classList.add('hidden');
}

function renderSummary(summary, image){
  const body = mountCard('Summary');
  const actions = document.createElement('div');
  actions.className = 'ilx-actions';
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  actions.append(copyBtn);
  body.appendChild(actions);
  if(image){
    const img = document.createElement('img');
    img.src = image; img.alt = 'Lead'; img.className = 'ilx-summary-img';
    body.appendChild(img);
  }
  const paraWrap = document.createElement('div');
  // let the card's .ilx-body handle scrolling; avoid a second scrollbar inside the card
  paraWrap.style.maxHeight = 'none';
  paraWrap.style.overflow = 'visible';
  body.appendChild(paraWrap);
  summary.split(/\n+/).forEach(p=>{
    const el = document.createElement('p');
    el.textContent = p;
    paraWrap.appendChild(el);
  });
  copyBtn.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(summary); copyBtn.textContent = 'Copied'; }catch(_){} });
}

// Add fullscreen/minimize buttons into card header when card is created
// We add them lazily so all cards get the controls
(function addHeaderControls(){
  const origMount = mountCard;
  window.mountCard = function(title){
    const body = origMount(title);
    const card = body.closest('.ilx-card');
    if(card && !card.dataset.ilxControls){
      card.dataset.ilxControls = '1';
      const header = card.querySelector('.ilx-header');
      // create a controls wrapper on the right side to hold fullscreen, minimize and close
      let controls = header.querySelector('.ilx-controls');
      if(!controls){
        controls = document.createElement('div');
        controls.className = 'ilx-controls';
        header.appendChild(controls);
      }
      const btnWrap = document.createElement('div');
      btnWrap.style.display = 'flex';
      btnWrap.style.alignItems = 'center';
  const fsBtn = document.createElement('button'); fsBtn.className = 'ilx-btn-small'; fsBtn.title = 'Fullscreen';
  fsBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v2H5v5H3V3zm11 0h7v7h-2V5h-5V3zM3 14h2v5h5v2H3v-7zm19 7h-7v-2h5v-5h2v7z"></path></svg>';
  const minBtn = document.createElement('button'); minBtn.className = 'ilx-btn-small'; minBtn.title = 'Minimize';
  minBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h12v2H6v-2z"></path></svg>';
  // Append button group before the close button
  controls.appendChild(btnWrap);
  btnWrap.appendChild(fsBtn);
  btnWrap.appendChild(minBtn);
  // move existing close button into controls so it stays aligned
  const closeBtn = card.querySelector('.ilx-close');
  if(closeBtn){ controls.appendChild(closeBtn); }

      let overlay = null;
      fsBtn.addEventListener('click', ()=>{
        if(overlay) return;
        overlay = document.createElement('div'); overlay.className = 'ilx-fullscreen-overlay';
        document.documentElement.appendChild(overlay);
        // move card into overlay
        overlay.appendChild(card);
        card.classList.add('ilx-fullscreen');
      });
      minBtn.addEventListener('click', ()=>{
        if(overlay){
          // move card back to root
          const root = ensureRoot();
          root.appendChild(card);
          card.classList.remove('ilx-fullscreen');
          // Force DOM reflow before removing overlay
          overlay.offsetHeight; // Force reflow
          overlay.remove();
          overlay = null;
        } else {
          // if not overlay, just reset size/position
          card.style.width = '';
          card.style.height = '';
          card.style.right = '16px';
          card.style.bottom = '16px';
        }
      });
    }
    return body;
  };
})();

function detectLayout(text){
  const hasYears = /(19|20)\d{2}/.test(text);
  const hasSteps = /(step\s?\d+|first,|second,|then,|finally)/i.test(text);
  if(hasYears) return 'timeline';
  if(hasSteps) return 'process';
  return 'process'; // Default to process
}

function renderMindmap(title, topics, layout) {
  const body = mountCard('Mindmap');
  // make sure the header title reads 'Mindmap' (mountCard centers titles)
  const cardEl = body.closest('.ilx-card');
  if(cardEl){
    const hdrTitle = cardEl.querySelector('.ilx-title');
    if(hdrTitle) hdrTitle.textContent = 'Mindmap';
  }
  const wrap = document.createElement('div');
  wrap.className = 'ilx-mindmap-html';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '16px';

  // Central topic
  const center = document.createElement('div');
  center.className = 'ilx-mindmap-center';
  center.textContent = (title || 'Topic').slice(0, 40);
  center.style.fontWeight = 'bold';
  center.style.background = '#0a2340';
  center.style.color = '#fff';
  center.style.padding = '10px 24px';
  center.style.borderRadius = '24px';
  center.style.fontSize = '1.2em';
  center.style.boxShadow = '0 2px 8px #0002';
  wrap.appendChild(center);

  // Topics row
  const topicsRow = document.createElement('div');
  topicsRow.style.display = 'flex';
  topicsRow.style.flexWrap = 'wrap';
  topicsRow.style.justifyContent = 'center';
  topicsRow.style.gap = '12px';

  topics.forEach((t) => {
    const node = document.createElement('div');
    node.className = 'ilx-mindmap-node';
    node.textContent = t;
    node.style.background = '#17324d';
    node.style.color = '#cfe3ff';
    node.style.padding = '8px 18px';
    node.style.borderRadius = '18px';
    node.style.cursor = 'pointer';
    node.style.boxShadow = '0 1px 4px #0001';
    node.style.transition = 'background 0.2s';
    node.addEventListener('mouseenter', () => {
      node.style.background = '#2c4e70';
    });
    node.addEventListener('mouseleave', () => {
      node.style.background = '#17324d';
    });
    node.title = 'Click to copy topic';
    node.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(t);
        node.textContent = 'Copied!';
        setTimeout(() => { node.textContent = t; }, 900);
      } catch {}
    });
    topicsRow.appendChild(node);
  });
  wrap.appendChild(topicsRow);
  body.appendChild(wrap);
}

function renderStructuredText(layout, items){
  const body = mountCard(layout === 'timeline' ? 'Timeline' : 'Process');
  const list = document.createElement('div');
  list.className = 'ilx-structure';
  items.forEach((it, idx)=>{
    const row = document.createElement('div');
    row.className = 'item';
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = layout === 'timeline' ? (it.date||`Step ${idx+1}`) : `Step ${idx+1}`;
    const labelText = (it.label||it.title||it.topic||it.desc||it.summary||'').toString().trim();
    const sentence = /[.!?]$/.test(labelText) ? labelText : (labelText ? labelText + '.' : '');
    const label = document.createElement('div'); label.className = 'label'; label.textContent = sentence;
    row.append(meta,label); list.appendChild(row);
  });
  body.appendChild(list);
}

function renderQuiz(quiz, sourceText){
  const body = mountCard('Quick Quiz');
  const container = document.createElement('div');
  container.className = 'ilx-quiz';
  let score = 0;
  const questionsWrap = document.createElement('div');
  quiz.forEach((q, idx)=>{
    const qEl = document.createElement('div');
    qEl.innerHTML = `<div class="q">${idx+1}. ${q.question}</div>`;
    q.options.forEach(opt=>{
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="q${idx}" value="${opt}"> ${opt}`;
      qEl.appendChild(label);
    });
    questionsWrap.appendChild(qEl);
  });
  container.appendChild(questionsWrap);
  const controls = document.createElement('div');
  controls.className = 'controls';
  const submitBtn = document.createElement('button');
  submitBtn.className = 'ilx-btn';
  submitBtn.textContent = 'Submit';
  controls.appendChild(submitBtn);
  const resultWrap = document.createElement('div');
  resultWrap.style.marginTop = '8px';
  container.appendChild(controls);
  container.appendChild(resultWrap);
  submitBtn.addEventListener('click', async ()=>{
    score = 0;
    quiz.forEach((q, idx)=>{
      const sel = container.querySelector(`input[name="q${idx}"]:checked`);
      if(sel && sel.value === q.answer) score += 1;
      // highlight correct option
      const labels = Array.from(container.querySelectorAll(`label input[name="q${idx}"]`)).map(i=>i.parentElement);
      labels.forEach(l=>{ const input = l.querySelector('input'); if(input && input.value === q.answer){ l.classList.add('correct'); } });
      // highlight incorrect selection
      if(sel && sel.value !== q.answer){
        const selLabel = sel.parentElement;
        selLabel.classList.add('incorrect');
      }
    });
    const percent = Math.round((score/quiz.length)*100);
    resultWrap.innerHTML = `Result: <strong>${score}</strong> / ${quiz.length} (${percent}%)`;
    submitBtn.disabled = true;
    const resetBtn = document.createElement('button');
    resetBtn.className = 'ilx-btn';
    resetBtn.textContent = 'New Questions';
    resetBtn.addEventListener('click', async ()=>{
      // Clear the card content first
      body.innerHTML = '';
      // Now show the loader in the empty card
      installLoader(body);
      showLoader(body, 'Loading Quiz Questions...');
      
      const newQuiz = await buildQuiz(sourceText);
      const card = body.closest('.ilx-card');
      if(card) card.remove();

      renderQuiz(newQuiz, sourceText);
    });
    controls.appendChild(resetBtn);
  });
  body.appendChild(container);
}

function pick(arr, n){
  const copy = [...arr];
  const out = [];
  while(out.length<n && copy.length){
    out.push(copy.splice(Math.floor(Math.random()*copy.length),1)[0]);
  }
  return out;
}

function uniqueOptions(correct, pool){
  const options = new Set([correct]);
  for(const p of pool){ if(options.size>=4) break; if(p!==correct) options.add(p); }
  return Array.from(options).sort(()=>Math.random()-0.5);
}


// ========================================
// COMPLETE WORKING QUIZ SYSTEM WITH DEBUG
// ========================================
function cleanAIResponse(raw) {
  return raw
    // Remove leading code fence like ``````json
    .replace(/^\s*(`{3,})\s*(json)?\s*\n?/i, '')
    // Remove trailing code fence
    .replace(/\n?\s*(`{3,})\s*$/i, '')
    .trim();
}

/**
 * Main entry point - Universal quiz generation
 */
async function buildQuiz(text) {
    console.log('🎯 buildQuiz called with text length:', text?.length || 0);

    if (!text || text.length < 100) {
        console.error('❌ Text too short or empty');
        return [];
    }

    // Try Chrome AI first
    try {
        // UPDATED: Check for global 'LanguageModel'
        if ('LanguageModel' in self) {
            console.log('🔍 Checking Chrome AI availability...');
            // UPDATED: Use .availability()
            const availability = await LanguageModel.availability();
            console.log('📊 AI availability:', availability);

            // UPDATED: Check for 'available' state
            if (availability === 'available') {
                console.log('✅ Using Chrome AI for quiz generation');
                const aiQuiz = await buildQuizWithAI_Universal(text);
                if (aiQuiz && aiQuiz.length > 0) {
                    console.log(`✅ AI generated ${aiQuiz.length} questions`);
                    return aiQuiz;
                }
                console.log('⚠️ AI returned empty, falling back');
            }
        } else {
            console.log('ℹ️ Chrome AI not available (LanguageModel global not found)');
        }
    } catch (e) {
        console.log('⚠️ Chrome AI error:', e.message);
    }

    // Fallback to content-aware generation
    console.log('📚 Using content-aware fallback');
    const fallbackQuiz = await buildQuizContentAware(text);
    console.log(`📊 Fallback generated ${fallbackQuiz?.length || 0} questions`);
    return fallbackQuiz || [];
}

/**
 * Chrome AI powered quiz generation
 */
async function buildQuizWithAI_Universal(text) {
    try {
        console.log('🤖 Creating AI session...');
        // UPDATED: Use global LanguageModel.create()
        const session = await LanguageModel.create({
            temperature: 0.4,
            topK: 25,
            systemPrompt: 'You create quiz questions based ONLY on provided content.'
        });

        const preparedText = cleanNoise(text);
        console.log('📝 Prepared text length:', preparedText.length);

        const prompt = `Create 5 multiple-choice questions from this content.

        STRICT RULES:
        1. All 4 options must be THE SAME SEMANTIC TYPE. If the correct answer is a list of proper nouns (e.g., "A, B, and C"), all three distractors must be **plausible, similarly structured lists** of proper nouns from the content (e.g., "X, Y, and Z"). If the answer is a single entity name (e.g., "Google"), all distractors must be single entity names (e.g., "Apple", "Microsoft"). **Absolutely no mixing of named entities with generic roles or groups.**
        2. All options must fit grammatically when replacing _____
        3. NO garbage words (Updated, Posted, Share, Subscribe, Views, Comments)
        4. Use fill-in-blank format with _____
        5. Base questions ONLY on information in the text
        6. Answer must be one of the options

        It Should not have 
        1. Missing required fields
        2. Invalid options array (should have exactly 4 options)
        3. Invalid option format
        4. Duplicate options
        5. Answer not in options
        6. No blank in question
        7. Garbage words or None of the above or All of the above

        Example good question:
        {"question": "World War II ended in _____.", "options": ["1943", "1944", "1945", "1946"], "answer": "1945"}

        Content:
        ${preparedText}

        Output ONLY valid JSON array in this exact format where answer should be one of the options:
        [{"question": "Complete sentence with _____?", "options": ["opt1", "opt2", "opt3", "opt4"], "answer": "correct_option"}]`;
        console.log('🔄 Streaming AI response...');
        let fullResponse = '';
        const stream = session.promptStreaming(prompt);

        for await (const chunk of stream) {
            fullResponse += chunk;
        }

        console.log('📥 AI response length:', fullResponse.length);
        console.log('📄 AI response preview:', fullResponse);

        // NEW: Clean the response more aggressively and safely
        console.log('🧼 Cleaning AI response...');
        let cleanedResponse = cleanAIResponse(fullResponse);
        console.log('🧹 Cleaned AI response:', cleanedResponse);

      // Try to extract JSON array - be more lenient
      let jsonMatch = cleanedResponse.match(/\[\s*{[\s\S]*}\s*\]/);
      console.log('🔍 JSON match found:', !!jsonMatch);

      // If no match, try to find JSON starting with [ and ending with ]
      if (!jsonMatch) {
          const startIdx = cleanedResponse.indexOf('[');
          const endIdx = cleanedResponse.lastIndexOf(']');
          if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
              cleanedResponse = cleanedResponse.substring(startIdx, endIdx + 1);
              jsonMatch = [cleanedResponse];
          }
      }


    if (!jsonMatch) {
        console.error('❌ No JSON found in AI response (after cleaning)');
        console.error('Response preview:', cleanedResponse);
        throw new Error('No valid JSON');
    }

    console.log('✅ JSON extracted, parsing...');
    console.log('JSON to parse:', jsonMatch[0] + '...');

    let questions;
    try {
        // Fix common JSON errors before parsing
        let jsonStr = jsonMatch[0]
            .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
            .replace(/'/g, '"')              // Replace single quotes with double quotes
            .replace(/(\w+):/g, '"$1":');    // Add quotes to unquoted keys
        console.log('🔧 Fixed JSON string:', jsonStr);
        // Remove a leading " and a trailing " if present
        if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
          jsonStr = jsonStr.slice(1, -1);
        }
        questions = JSON.parse(jsonStr);
    } catch (parseError) {
        console.error('❌ JSON parse error:', parseError.message);
        console.error('Problematic JSON:', jsonMatch[0]);
        throw new Error('Invalid JSON format: ' + parseError.message);
    }

        console.log(`📊 Parsed ${questions.length} questions from AI`);

        // Validate each question
        const validated = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const validObj = {
                    question: q.question.trim(),
                    options: q.options.map(o => o.trim()),
                    answer: q.answer.trim()
                }
            console.log(`🔍 valid question ${i + 1}:`, JSON.stringify(validObj));


            if (validateQuestionUniversal(q, preparedText)) {
                validated.push(validObj);
                console.log(`   ✅ Question ${i + 1} valid`);
            } else {
                console.log(`   ❌ Question ${i + 1} rejected`);
            }
        }

        console.log(`✅ Validated ${validated.length} questions`);
        session.destroy();

        if (validated.length >= 3) {
            return validated.slice(0, 5);
        }

        console.log('⚠️ Not enough valid questions from AI');
        throw new Error('Insufficient quality');

    } catch (e) {
        console.error('❌ AI quiz generation failed:', e);
        return null;
    }
}

/**
 * Validate question with logging
 */
function validateQuestionUniversal(q, text) {
    if (!q || !q.question || !q.options || !q.answer) {
        console.log('   ❌ Missing required fields');
        return false;
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
        console.log('   ❌ Invalid options array:', q.options?.length);
        return false;
    }

    if (!q.options.every(o => typeof o === 'string' && o.length > 0)) {
        console.log('   ❌ Invalid option format');
        return false;
    }

    const unique = new Set(q.options.map(o => o.toLowerCase().trim()));
    if (unique.size !== 4) {
        console.log('   ❌ Duplicate options:', q.options);
        return false;
    }

    if (!q.options.includes(q.answer)) {
        console.log('   ❌ Answer not in options:', q.answer);
        return false;
    } 

    // Check for garbage words
    const garbage = ['updated', 'posted', 'share', 'subscribe', 'follow', 'views', 'comments'];
    for (const opt of q.options) {
        const lower = opt.toLowerCase().trim();
        if (garbage.includes(lower)) {
            console.log('   ❌ Garbage word detected:', opt);
            return false;
        }
        if (opt.length < 2) {
            console.log('   ❌ Option too short:', opt);
            return false;
        }
    }

    // Check type consistency
    const types = q.options.map(opt => detectType(opt));
    const uniqueTypes = new Set(types);
    if (uniqueTypes.size > 1) {
        console.log('   ❌ Type mismatch:', types.join(', '));
        return false;
    }

    return true;
}

/**
 * Detect type of option
 */
function detectType(opt) {
    const trimmed = opt.trim();
    // if lowercase(option) is empty or none of the above or all of the above then invalid 
    if (!trimmed || /^(none|all) of the above$/i.test(trimmed)) {
        return 'invalid';
    }
    // Number
    if (/^\d+[.,]?\d*\s*(million|billion|thousand|%|percent)?$/i.test(trimmed)) {
        return 'number';
    }

    // Proper noun (capitalized)
    if (/^[A-Z]/.test(trimmed)) {
        return 'string';
    }
    return 'unknown';
}

/**
 * Content-aware fallback quiz generation
 */
async function buildQuizContentAware(text) {
    console.log('📚 Starting content-aware fallback');

    try {
        const cleaned = cleanNoise(text);
        console.log('🧹 Cleaned text length:', cleaned.length);

        // Split into sentences
        const sentences = cleaned
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => {
                const words = s.split(/\s+/).length;
                return words >= 8 && words <= 40 && s.length >= 40 && s.length <= 300;
            })
            .slice(0, 30);

        console.log(`📊 Found ${sentences.length} candidate sentences`);

        if (sentences.length === 0) {
            console.log('❌ No valid sentences found');
            return [];
        }

        const candidates = [];

        // Extract entities from each sentence
        sentences.forEach((sentence, idx) => {
            // Find capitalized entities
            const entityPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g;
            const entities = sentence.match(entityPattern) || [];

            // Filter out common words
            const validEntities = entities.filter(e => 
                e.length > 2 && 
                !['The', 'A', 'An', 'In', 'On', 'At', 'For', 'With', 'By'].includes(e)
            );

            if (validEntities.length === 0) return;

            // Use first valid entity
            const entity = validEntities[0];

            // Create question by replacing entity with blank
            const question = sentence.replace(entity, '_____');
            if (!question.includes('_____')) return;

            const finalQuestion = question.endsWith('?') ? question : question + '?';

            // Find other entities from entire text for options
            const allEntities = [...new Set(cleaned.match(entityPattern) || [])];
            const validAllEntities = allEntities.filter(e => 
                e.length > 2 && 
                e !== entity &&
                !['The', 'A', 'An', 'In', 'On', 'At', 'For', 'With', 'By'].includes(e)
            );

            // Build options: correct answer + 3 others
            const options = [entity];
            for (const other of validAllEntities) {
                if (options.length >= 4) break;
                if (!options.includes(other)) {
                    options.push(other);
                }
            }

            // Only add if we have exactly 4 options
            if (options.length === 4) {
                // Shuffle options
                const shuffled = options.sort(() => Math.random() - 0.5);

                const candidate = {
                    question: finalQuestion,
                    options: shuffled,
                    answer: entity
                };

                // Validate before adding
                if (validateQuestionUniversal(candidate, cleaned)) {
                    candidates.push(candidate);
                    console.log(`   ✅ Created question ${candidates.length} from sentence ${idx + 1}`);
                }
            }
        });

        console.log(`✅ Generated ${candidates.length} candidate questions`);

        // Return top 5
        const final = candidates.slice(0, 5);
        console.log(`📊 Returning ${final.length} questions`);

        return final;

    } catch (e) {
        console.error('❌ Fallback generation error:', e);
        return [];
    }
}



// 3) UPDATE your onAction to display a temporary loading card
//    during async work, then remove it and render the final UI.
async function onAction(action) {
  const { title, text, image } = await extractArticle();
  if (!text) return;

  if (action === 'simplify') {
    const tempBody = mountCard('Summary');
    showLoader(tempBody, 'Summarizing…');
    try {
      const summary = await summarizeText(text);
      tempBody.closest('.ilx-card')?.remove();
      renderSummary(summary, image);
    } catch (e) {
      tempBody.closest('.ilx-card')?.remove();
      const body = mountCard('Summary');
      body.innerHTML = `<p>Failed to summarize. Please try again.</p>`;
    }
  } else if (action === 'mindmap') {
    const tempBody = mountCard('Mindmap');
    showLoader(tempBody, 'Analyzing…');
    let layout = detectLayout(text);
    let structuredItems = null;

    try {
      // Optional: adaptive layout via LanguageModel if available
      if ('LanguageModel' in self) {
        const availability = await LanguageModel.availability();
        if (availability === 'available') {
          const session = await LanguageModel.create();
          const ask = `Analyze the passage and choose one visualization (timeline, process).
If timeline or process, return JSON ONLY with { "layout": "timeline"|"process", "items": [{ "date"?: string, "label": string, "desc"?: string }] }.
Passage: ${text.slice(0, 2500)}`;
          const res = await session.prompt(ask);
          const jsonStart = res.indexOf('{');
          const data = JSON.parse(res.slice(jsonStart));
          if (data?.layout) layout = data.layout;
          if (data?.items) structuredItems = data.items;
          if (data?.topics) structuredItems = data.topics;
        }
      }
    } catch (_) {
      // proceed with defaults
    }
    tempBody.closest('.ilx-card')?.remove();
    if (layout === 'map') {
      const topics = Array.isArray(structuredItems) ? structuredItems : extractTopics(text);
      renderMindmap(title, topics, 'map');
    } else {
      // Render textual timeline/process when LM provided structure; otherwise, derive simple steps from paragraphs
      if(!Array.isArray(structuredItems)){
        const sentences = text.split(/(?<=[.!?])\s+/).filter(s=>s.length>60).slice(0,8);
        structuredItems = sentences.map((s,i)=>({ label: s }));
      }
      renderStructuredText(layout, structuredItems);
    }
  } else if (action === 'quiz') {
    const tempBody = mountCard('Quick Quiz');
    showLoader(tempBody, 'Generating questions…');
    try {
      const quiz = await buildQuiz(text);
      tempBody.closest('.ilx-card')?.remove();
      renderQuiz(quiz, text);
    } catch (e) {
      tempBody.closest('.ilx-card')?.remove();
      const body = mountCard('Quick Quiz');
      body.innerHTML = `<p>Failed to generate quiz. Please try again.</p>`;
    }
  }
}

chrome.runtime.onMessage.addListener((msg)=>{
  if(msg?.type === 'ilx-action'){
    onAction(msg.action);
  }
});

// Floating Action Button with 3-item menu
function ensureFab(){
  if(document.querySelector('.ilx-fab')) return;
  const fab = document.createElement('button');
  fab.className = 'ilx-fab';
  fab.title = 'Interactive Learning';
  const img = document.createElement('img');
  img.alt = 'Interactive Learning';
  img.src = chrome.runtime.getURL('quickstartLogo.png');
  fab.appendChild(img);
  document.documentElement.appendChild(fab);
  const menu = document.createElement('div');
  menu.className = 'ilx-menu';
  const mk = (label, action)=>{
    const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', ()=>{ menu.classList.remove('ilx-open'); onAction(action); }); return b;
  };
  menu.append(
    mk('Simplify Article','simplify'),
    mk('Build Mindmap','mindmap'),
    mk('Test Knowledge','quiz')
  );
  document.documentElement.appendChild(menu);
  fab.addEventListener('click', ()=> menu.classList.toggle('ilx-open'));
}

ensureFab();