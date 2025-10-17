/* global chrome */

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
    if('ai' in self && ai.summarizer){
      const cap = await ai.summarizer.capabilities();
      if(cap.available === 'readily'){ 
        const s = await ai.summarizer.create({ type: 'article' });
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
  card.querySelector('.ilx-close').addEventListener('click', ()=> card.remove());
  return card.querySelector('.ilx-body');
}

function renderSummary(summary, image){
  const body = mountCard('Summary');
  const actions = document.createElement('div');
  actions.className = 'ilx-actions';
  const expandBtn = document.createElement('button');
  expandBtn.textContent = 'Expand';
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  actions.append(expandBtn, copyBtn);
  body.appendChild(actions);
  if(image){
    const img = document.createElement('img');
    img.src = image; img.alt = 'Lead'; img.className = 'ilx-summary-img';
    body.appendChild(img);
  }
  const paraWrap = document.createElement('div');
  paraWrap.style.maxHeight = '38vh';
  paraWrap.style.overflow = 'auto';
  body.appendChild(paraWrap);
  summary.split(/\n+/).forEach(p=>{
    const el = document.createElement('p');
    el.textContent = p;
    paraWrap.appendChild(el);
  });
  expandBtn.addEventListener('click', ()=>{ paraWrap.style.maxHeight = 'none'; });
  copyBtn.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(summary); copyBtn.textContent = 'Copied'; }catch(_){} });
}

function detectLayout(text){
  const hasYears = /(19|20)\d{2}/.test(text);
  const hasSteps = /(step\s?\d+|first,|second,|then,|finally)/i.test(text);
  if(hasYears) return 'timeline';
  if(hasSteps) return 'process';
  return 'map';
}

function renderMindmap(title, topics, layout){
  const body = mountCard('Mindmap');
  const w = 520, h = 320, cx = w/2, cy = h/2, r = 120;
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.innerHTML = `<defs><style>
    text{fill:#cfe3ff;font:12px system-ui}
    .node{fill:#17324d;stroke:#2c4e70;stroke-width:1}
    .center{fill:#0a2340;stroke:#3b6ea8}
    .link{stroke:#385b82;stroke-width:1}
  </style></defs>`;
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  svg.appendChild(g);
  // center
  const center = document.createElementNS('http://www.w3.org/2000/svg','circle');
  center.setAttribute('class','center');
  center.setAttribute('cx', String(cx));
  center.setAttribute('cy', String(cy));
  center.setAttribute('r','34');
  g.appendChild(center);
  const cText = document.createElementNS('http://www.w3.org/2000/svg','text');
  cText.setAttribute('x', String(cx));
  cText.setAttribute('y', String(cy+4));
  cText.setAttribute('text-anchor','middle');
  cText.textContent = (title||'Topic').slice(0,20);
  g.appendChild(cText);
  // satellites by layout
  topics.forEach((t, i)=>{
    let x, y;
    if(layout === 'timeline'){
      x = 40 + (i * ((w-80)/Math.max(1, topics.length-1)));
      y = h/2 + ((i%2===0)? -60 : 60);
    } else if(layout === 'process'){
      x = 80 + (i * ((w-160)/Math.max(1, topics.length-1)));
      y = h/2;
    } else { // map
      const angle = (i / topics.length) * Math.PI * 2;
      x = cx + r * Math.cos(angle);
      y = cy + r * Math.sin(angle);
    }
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('class','link');
    line.setAttribute('x1', String(cx));
    line.setAttribute('y1', String(cy));
    line.setAttribute('x2', String(x));
    line.setAttribute('y2', String(y));
    g.appendChild(line);
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('class','node');
    c.setAttribute('cx', String(x));
    c.setAttribute('cy', String(y));
    c.setAttribute('r','20');
    g.appendChild(c);
    const text = document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y+4));
    text.setAttribute('text-anchor','middle');
    text.textContent = t.slice(0,14);
    g.appendChild(text);
  });
  const wrap = document.createElement('div');
  wrap.className = 'ilx-mindmap';
  wrap.appendChild(svg);
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
    });
    const percent = Math.round((score/quiz.length)*100);
    resultWrap.innerHTML = `Result: <strong>${score}</strong> / ${quiz.length} (${percent}%)`;
    submitBtn.disabled = true;
    const resetBtn = document.createElement('button');
    resetBtn.className = 'ilx-btn';
    resetBtn.textContent = 'New Questions';
    resetBtn.addEventListener('click', async ()=>{
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

async function buildQuiz(text){
  // Prefer Prompt API if present
  try{
    if('ai' in self && ai.languageModel){
      const cap = await ai.languageModel.capabilities();
      if(cap.available === 'readily'){
        const session = await ai.languageModel.create();
        const prompt = `Create 5 multiple‑choice questions by masking key facts from the passage. Each question should be phrased as: \\"Fill in the blank: <sentence with one word/phrase replaced by ____>\\". Provide 4 distinct options with exactly one correct answer. Return ONLY strict JSON array: [{\\"question\\":string,\\"options\\":[string,string,string,string],\\"answer\\":string}]. Avoid UI debris like 'Member-only story', 'Listen', 'Share'. Passage:\n\n${text.slice(0,3000)}`;
        const res = await session.prompt(prompt);
        const jsonStart = res.indexOf('[');
        const json = JSON.parse(res.slice(jsonStart));
        return json;
      }
    }
  }catch(_e){ }
  // Fallback: entity-mask questions from sentences
  function splitSentences(t){ return cleanNoise(t).split(/(?<=[.!?])\s+/).filter(s=>s.trim().length>40).slice(0,40); }
  // naive entity extraction
  function extractEntitiesFromSentence(s){
    const dates = (s.match(/\b(\d{4}|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi)||[]);
    const caps = (s.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g)||[]).filter(w=>!['The','A','An','In','On','At','For','With','And','Of','To'].includes(w));
    const nums = (s.match(/\b\d+[\w-]*\b/g)||[]);
    return { dates, caps, nums };
  }
  function makeQuestionFromSentence(s, pool){
    const ents = extractEntitiesFromSentence(s);
    if(ents.dates.length){
      const ans = ents.dates[0];
      const q = s.replace(ans,'____');
      return { question: `${q}`, answer: ans, options: uniqueOptions(ans, pool.dates.filter(x=>x!==ans)) };
    }
    if(ents.caps.length){
      const ans = ents.caps[0];
      const q = s.replace(ans,'____');
      return { question: `${q}`, answer: ans, options: uniqueOptions(ans, pool.caps.filter(x=>x!==ans)) };
    }
    if(ents.nums.length){
      const ans = ents.nums[0];
      const q = s.replace(ans,'____');
      return { question: `${q}`, answer: ans, options: uniqueOptions(ans, pool.nums.filter(x=>x!==ans)) };
    }
    // fallback to topic term
    const topics = extractTopics(s);
    const ans = topics[0]||'concept';
    const base = cleanNoise(s).slice(0,160);
    return { question: `${base} …`, answer: ans, options: uniqueOptions(ans, extractTopics(text)) };
  }
  const sentences = splitSentences(text);
  const pool = sentences.reduce((acc,s)=>{
    const e = extractEntitiesFromSentence(s);
    acc.dates.push(...e.dates); acc.caps.push(...e.caps); acc.nums.push(...e.nums); return acc;
  }, { dates:[], caps:[], nums:[] });
  const selected = pick(sentences, 5);
  const qs = selected.map(s=>makeQuestionFromSentence(s, pool));
  // normalize to shape
  return qs.map(q=>({ question: q.question, options: q.options.slice(0,4), answer: q.answer }));
}

async function onAction(action){
  const { title, text, image } = await extractArticle();
  if(!text) return;
  if(action === 'simplify'){
    const summary = await summarizeText(text);
    renderSummary(summary, image);
  } else if(action === 'mindmap'){
    let layout = detectLayout(text);
    let structuredItems = null;
    // Ask on-device LM to choose layout and optionally emit structured JSON
    try{
      if('ai' in self && ai.languageModel){
        const cap = await ai.languageModel.capabilities();
        if(cap.available === 'readily'){
          const session = await ai.languageModel.create();
          const ask = `Analyze the passage and choose one visualization: timeline, process, or map. If timeline or process, return JSON ONLY with {layout:"timeline|process", items:[{date?:string, label:string, desc?:string}]}. If map, return JSON ONLY with {layout:"map", topics:[string]}. Passage:\n\n${text.slice(0,2500)}`;
          const res = await session.prompt(ask);
          const jsonStart = res.indexOf('{');
          const data = JSON.parse(res.slice(jsonStart));
          if(data?.layout){ layout = data.layout; }
          if(data?.items) structuredItems = data.items;
          if(data?.topics) structuredItems = data.topics;
        }
      }
    }catch(_e){ }
    if(layout === 'map'){
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
  } else if(action === 'quiz'){
    const quiz = await buildQuiz(text);
    renderQuiz(quiz, text);
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


