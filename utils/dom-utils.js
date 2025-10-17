export function createElement(tag, attrs = {}, children = []){
  const el = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){
    if(k === 'class') el.className = v; else if(k === 'style') Object.assign(el.style, v); else el.setAttribute(k, v);
  }
  for(const child of children){ el.append(child); }
  return el;
}


