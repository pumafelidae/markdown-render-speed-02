// parse.js — a dependency-free CommonMark 0.31.2 + GFM renderer whose output
// matches marked 18.1.3 with default options (gfm on, breaks off) byte for byte.
// Written from the CommonMark spec and the kit's spec examples; no marked code.

// ---------- named HTML entities (the HTML5 names the spec examples and the
// generated documents can use; anything else after '&' stays literal) ----------
const ENT = {
  Tab: '\t', NewLine: '\n', nbsp: ' ', iexcl: '¡', cent: '¢', pound: '£',
  curren: '¤', yen: '¥', brvbar: '¦', sect: '§', uml: '¨', copy: '©',
  ordf: 'ª', laquo: '«', not: '¬', shy: '­', reg: '®', macr: '¯',
  deg: '°', plusmn: '±', sup2: '²', sup3: '³', acute: '´', micro: 'µ',
  para: '¶', middot: '·', cedil: '¸', sup1: '¹', ordm: 'º', raquo: '»',
  frac14: '¼', frac12: '½', frac34: '¾', iquest: '¿', Agrave: 'À',
  Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å', AElig: 'Æ',
  Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë', Igrave: 'Ì',
  Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï', ETH: 'Ð', Ntilde: 'Ñ', Ograve: 'Ò',
  Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', times: '×', Oslash: 'Ø',
  Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü', Yacute: 'Ý', THORN: 'Þ',
  szlig: 'ß', agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä',
  aring: 'å', aelig: 'æ', ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê',
  euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', eth: 'ð',
  ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö',
  divide: '÷', oslash: 'ø', ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü',
  yacute: 'ý', thorn: 'þ', yuml: 'ÿ', OElig: 'Œ', oelig: 'œ', Scaron: 'Š',
  scaron: 'š', Yuml: 'Ÿ', fnof: 'ƒ', circ: 'ˆ', tilde: '˜', Alpha: 'Α',
  Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Epsilon: 'Ε', Zeta: 'Ζ', Eta: 'Η',
  Theta: 'Θ', Iota: 'Ι', Kappa: 'Κ', Lambda: 'Λ', Mu: 'Μ', Nu: 'Ν',
  Xi: 'Ξ', Omicron: 'Ο', Pi: 'Π', Rho: 'Ρ', Sigma: 'Σ', Tau: 'Τ',
  Upsilon: 'Υ', Phi: 'Φ', Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω', alpha: 'α',
  beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ', sigmaf: 'ς', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  thetasym: 'ϑ', upsih: 'ϒ', piv: 'ϖ', ensp: ' ', emsp: ' ',
  thinsp: ' ', zwnj: '‌', zwj: '‍', lrm: '‎', rlm: '‏', ndash: '–',
  mdash: '—', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”',
  bdquo: '„', dagger: '†', Dagger: '‡', bull: '•', hellip: '…', permil: '‰',
  prime: '′', Prime: '″', lsaquo: '‹', rsaquo: '›', oline: '‾', frasl: '⁄',
  euro: '€', image: 'ℑ', weierp: '℘', real: 'ℜ', trade: '™', alefsym: 'ℵ',
  larr: '←', uarr: '↑', rarr: '→', darr: '↓', harr: '↔', crarr: '↵',
  lArr: '⇐', uArr: '⇑', rArr: '⇒', dArr: '⇓', hArr: '⇔', forall: '∀',
  part: '∂', exist: '∃', empty: '∅', nabla: '∇', isin: '∈', notin: '∉',
  ni: '∋', prod: '∏', sum: '∑', minus: '−', lowast: '∗', radic: '√',
  prop: '∝', infin: '∞', ang: '∠', and: '∧', or: '∨', cap: '∩', cup: '∪',
  int: '∫', there4: '∴', sim: '∼', cong: '≅', asymp: '≈', ne: '≠',
  equiv: '≡', le: '≤', ge: '≥', sub: '⊂', sup: '⊃', nsub: '⊄', sube: '⊆',
  supe: '⊇', oplus: '⊕', otimes: '⊗', perp: '⊥', sdot: '⋅', lceil: '⌈',
  rceil: '⌉', lfloor: '⌊', rfloor: '⌋', lang: '⟨', rang: '⟩', loz: '◊',
  spades: '♠', clubs: '♣', hearts: '♥', diams: '♦', Dcaron: 'Ď',
  dcaron: 'ď', HilbertSpace: 'ℋ', DifferentialD: 'ⅆ',
  ClockwiseContourIntegral: '∲', ngE: '≧̸', amp: '&', lt: '<', gt: '>',
  quot: '"', apos: "'",
};

// Block-level HTML tags (CommonMark HTML block type 6).
const BLOCK_TAGS = new Set(('address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul').split(' '));

// ASCII punctuation (for backslash escapes and flanking rules).
function isPunct(c) {
  return (c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126);
}
function isSpace(c) {
  return c === 32 || c === 9 || c === 10 || c === 11 || c === 12 || c === 13;
}
function isWhitespace(s, i) {
  const c = s.charCodeAt(i);
  return c === 32 || c === 9 || c === 10 || c === 11 || c === 12 || c === 13;
}
// Unicode whitespace test for flanking (fast path: ASCII; slow path: regex).
const WS_RE = /\s/;
function isUniSpace(ch) {
  const c = ch.charCodeAt(0);
  return c < 128 ? isSpace(c) : WS_RE.test(ch);
}
const PUNCT_RE = /[!-\/:-@\[-`{-~]/;
const UNI_PUNCT_RE = /^[\p{P}\p{S}]$/u;
const ALNUM_RE = /^[\p{L}\p{N}]$/u;
function isUniPunct(ch) {
  const c = ch.charCodeAt(0);
  return c < 128 ? isPunct(c) : UNI_PUNCT_RE.test(ch);
}

// Escape text content: & < > " ' (marked escapes " and ' in text).
function escText(s) {
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let rep = null;
    if (c === 38) rep = '&amp;';
    else if (c === 60) rep = '&lt;';
    else if (c === 62) rep = '&gt;';
    else if (c === 34) rep = '&quot;';
    else if (c === 39) rep = '&#39;';
    if (rep !== null) {
      if (start < i) out += s.slice(start, i);
      out += rep;
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// Escape attribute values: < > " and & unless it starts a valid entity reference.
const ENT_START_RE = /&(#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/;
function escAttr(s) {
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    let rep = null;
    if (c === 38) {
      // keep & when it begins a valid entity reference
      if (!ENT_START_RE.test(s.slice(i, i + 40))) rep = '&amp;';
    } else if (c === 60) rep = '&lt;';
    else if (c === 62) rep = '&gt;';
    else if (c === 34) rep = '&quot;';
    if (rep !== null) {
      if (start < i) out += s.slice(start, i);
      out += rep;
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// marked's entity rule for text: a named reference &name; is passed through
// literally (never decoded); a numeric reference is decoded to the code
// point (0 / surrogates -> U+FFFD); an out-of-range numeric (> 0x10FFFF),
// a missing ';', or no digits is not a reference at all.
// Returns {raw, decoded, next} or null. `decoded` is null for named refs
// (keep `raw` literally) and a string for numeric refs.
function entityRef(s, i) {
  const n = s.length;
  if (i + 1 >= n) return null;
  const c1 = s.charCodeAt(i + 1);
  if (c1 === 35) { // # numeric
    let j = i + 2;
    let hex = false;
    if (j < n && (s.charCodeAt(j) === 120 || s.charCodeAt(j) === 88)) { hex = true; j++; }
    const ds = j;
    while (j < n) {
      const d = s.charCodeAt(j);
      if (hex ? (d >= 48 && d <= 57) || (d >= 65 && d <= 70) || (d >= 97 && d <= 102)
              : (d >= 48 && d <= 57)) j++;
      else break;
    }
    if (j === ds || j >= n || s.charCodeAt(j) !== 59) return null;
    const cp = parseInt(s.slice(ds, j), hex ? 16 : 10);
    if (cp > 0x10FFFF) return null;
    const ch = (cp === 0 || (cp >= 0xD800 && cp <= 0xDFFF)) ? '\uFFFD' : String.fromCodePoint(cp);
    return { raw: s.slice(i, j + 1), decoded: ch, next: j + 1 };
  }
  // named: letters/digits, must end with ';'
  let j = i + 1;
  while (j < n) {
    const d = s.charCodeAt(j);
    if ((d >= 48 && d <= 57) || (d >= 65 && d <= 90) || (d >= 97 && d <= 122)) j++;
    else break;
  }
  if (j >= n || s.charCodeAt(j) !== 59 || j === i + 1) return null;
  return { raw: s.slice(i, j + 1), decoded: null, next: j + 1 };
}

// Decode one entity reference starting at s[i] === '&'. Returns [decoded, nextIndex]
// or null when it is not a valid reference.
function scanEntity(s, i) {
  const n = s.length;
  if (i + 1 >= n) return null;
  const c1 = s.charCodeAt(i + 1);
  if (c1 === 35) { // # numeric
    let j = i + 2;
    let hex = false;
    if (j < n && (s.charCodeAt(j) === 120 || s.charCodeAt(j) === 88)) { hex = true; j++; }
    const ds = j;
    while (j < n) {
      const d = s.charCodeAt(j);
      if (hex ? (d >= 48 && d <= 57) || (d >= 65 && d <= 70) || (d >= 97 && d <= 102)
              : (d >= 48 && d <= 57)) j++;
      else break;
    }
    if (j === ds || j >= n || s.charCodeAt(j) !== 59) return null;
    let cp = parseInt(s.slice(ds, j), hex ? 16 : 10);
    if (cp === 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) cp = 0xFFFD;
    return [String.fromCodePoint(cp), j + 1];
  }
  // named: letters/digits, must end with ';'
  let j = i + 1;
  while (j < n) {
    const d = s.charCodeAt(j);
    if ((d >= 48 && d <= 57) || (d >= 65 && d <= 90) || (d >= 97 && d <= 122)) j++;
    else break;
  }
  if (j >= n || s.charCodeAt(j) !== 59 || j === i + 1) return null;
  const name = s.slice(i + 1, j);
  const v = ENT[name];
  return v === undefined ? null : [v, j + 1];
}

// Decode entities in a whole string (text context).
function decodeEntities(s) {
  if (s.indexOf('&') < 0) return s;
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 38) {
      const r = scanEntity(s, i);
      if (r) {
        if (start < i) out += s.slice(start, i);
        out += r[0];
        i = r[1] - 1;
        start = r[1];
      }
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// Decode backslash escapes (\ + ASCII punctuation -> the punctuation).
function decodeEscapes(s) {
  if (s.indexOf('\\') < 0) return s;
  let out = '';
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 92 && i + 1 < s.length && isPunct(s.charCodeAt(i + 1))) {
      if (start < i) out += s.slice(start, i);
      out += s[i + 1];
      i++;
      start = i + 1;
    }
  }
  return start === 0 ? s : out + s.slice(start);
}

// Unicode case folding expansions that toLowerCase() does not perform.
const FOLD_EXPAND = { '\u00DF': 'ss', '\u1E9E': 'ss', '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl', '\uFB03': 'ffi', '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st' };
// Normalize a link reference label: collapse whitespace, case-fold.
function normalizeLabel(s) {
  let t = s.replace(/\s+/g, ' ').trim().toLowerCase();
  if (/[\u00DF\u1E9E\uFB00-\uFB06]/.test(t)) {
    t = t.replace(/[\u00DF\u1E9E\uFB00-\uFB06]/g, (ch) => FOLD_EXPAND[ch]);
  }
  return t;
}

// marked's URL cleaning: encodeURI, then restore literal '%' (encodeURI turns
// '%' into '%25'; marked undoes that so '%' and already-encoded sequences stay).
function cleanUrl(href) {
  try {
    return encodeURI(href).replace(/%25/g, '%');
  } catch {
    return null;
  }
}

// ---------- inline parsing ----------

// Find the index of the ']' matching the '[' at `start`. A label cannot
// contain an unescaped '['; a ']' inside a code span or an HTML tag /
// autolink does not close the label. Returns -1 when there is none.
function findLabelEnd(s, start, allowNested) {
  // With allowNested (link text), nested brackets are counted: the label
  // ends at the ']' that returns the depth to 0. Without it (reference
  // labels), an unescaped '[' makes the label invalid.
  let depth = 1;
  for (let i = start + 1; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 92) { i++; continue; } // backslash escapes the next char
    if (c === 91) {
      if (!allowNested) return -1;
      depth++;
      continue;
    }
    if (c === 93) {
      depth--;
      if (depth === 0) return i;
      continue;
    }
    if (c === 96) { // backtick run: skip a code span if it closes
      let j = i;
      while (j < s.length && s.charCodeAt(j) === 96) j++;
      // marked's label regex closes a code span at the NEXT backtick run
      // of ANY length (`` `+(?!`)[^`]*?`+(?!`) `` — runs need not match:
      // `` ``url` `` is a code span in a label), BUT only if that run
      // comes before the ']' that would end the label. The same-length
      // search got doc-09 wrong (a later `` `` `` swallowed the label
      // end); the unbounded any-length search got doc-33 wrong (the
      // final `` `` `` of `` ``a ` b`` `` swallowed it the other way).
      // Scan ahead tracking bracket depth from the current depth; stop
      // at the next backtick run (code span closes there) or at the ']'
      // that would end the label (the run is literal then).
      let k = j;
      let d = depth;
      let found = -1;
      let foundLen = 0;
      while (k < s.length) {
        const ch = s.charCodeAt(k);
        if (ch === 92) { k += 2; continue; }
        if (ch === 91) { d++; k++; continue; }
        if (ch === 93) {
          d--;
          if (d === 0) break; // label-ending ']' first: run is literal
          k++; continue;
        }
        if (ch === 96) {
          let m = k;
          while (m < s.length && s.charCodeAt(m) === 96) m++;
          found = k; foundLen = m - k; break;
        }
        k++;
      }
      if (found >= 0) { i = found + foundLen - 1; continue; }
      // no closing run before the label end: backticks are literal
      i = j - 1;
      continue;
    }
    if (c === 60) { // '<': skip an HTML tag or an autolink
      const h = parseHtmlTag(s, i);
      if (h) { i = h.next - 1; continue; }
      // autolink <scheme:...> or <email>: no space or '<' before the '>'
      let j = i + 1;
      let ok = false;
      while (j < s.length) {
        const d = s.charCodeAt(j);
        if (d === 32 || d === 10 || d === 60) break;
        if (d === 62) { ok = true; break; }
        j++;
      }
      if (ok) { i = j; continue; }
    }
  }
  return -1;
}

// Parse a link destination starting at s[i] (after '(' or after ':' in a ref def).
// Returns {dest, next} or null. `next` is the index after the destination.
function parseDest(s, i) {
  const n = s.length;
  if (i >= n) return null;
  if (s.charCodeAt(i) === 60) { // <...>
    let j = i + 1;
    while (j < n) {
      const c = s.charCodeAt(j);
      if (c === 92) { j += 2; continue; }
      if (c === 60 || c === 10) return null;
      if (c === 62) return { dest: s.slice(i + 1, j), next: j + 1 };
      j++;
    }
    return null;
  }
  // bare destination: no spaces/control chars, balanced parens
  let j = i;
  let depth = 0;
  while (j < n) {
    const c = s.charCodeAt(j);
    if (c === 92) { j += 2; continue; }
    if (c <= 32) break;
    if (c === 40) depth++;
    else if (c === 41) {
      if (depth === 0) break;
      depth--;
    }
    j++;
  }
  // an empty destination is allowed for inline links (callers that need a
  // non-empty destination check dest.length themselves)
  return { dest: s.slice(i, j), next: j };
}

// Skip spaces/tabs/newlines. Returns the new index.
function skipWS(s, i) {
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13) i++;
    else break;
  }
  return i;
}

// Parse a link title starting at s[i] ('"' or '\'' or '('). Returns {title, next} or null.
function parseTitle(s, i) {
  const n = s.length;
  if (i >= n) return null;
  const q = s.charCodeAt(i);
  if (q === 34 || q === 39) { // "..." or '...'
    let j = i + 1;
    while (j < n) {
      const c = s.charCodeAt(j);
      if (c === 92) { j += 2; continue; }
      if (c === q) return { title: s.slice(i + 1, j), next: j + 1 };
      j++;
    }
    return null;
  }
  if (q === 40) { // (...)
    let j = i + 1;
    while (j < n) {
      const c = s.charCodeAt(j);
      if (c === 92) { j += 2; continue; }
      if (c === 40) return null; // unescaped '(' is not allowed in a paren title
      if (c === 41) return { title: s.slice(i + 1, j), next: j + 1 };
      j++;
    }
    return null;
  }
  return null;
}

// Parse "destination, optional title" starting at s[i]. Returns {dest, title, next} or null.
// Used for inline links and reference definitions.
function parseDestTitle(s, i) {
  i = skipWS(s, i);
  const d = parseDest(s, i);
  if (!d) return null;
  let j = skipWS(s, d.next);
  let title = null;
  if (j < s.length) {
    const c = s.charCodeAt(j);
    if (c === 34 || c === 39 || c === 40) {
      // a title must be separated from the destination by whitespace
      if (j === d.next) return null;
      const t = parseTitle(s, j);
      if (!t) return null;
      title = t.title;
      j = skipWS(s, t.next);
    }
  }
  return { dest: d.dest, title, next: j };
}

// Try to parse a link/image starting at the '[' at s[i] (i points at '[').
// `isImage` distinguishes ![...] from [...]. Returns {href, title, childrenHtml, altText, next}
// or null when this is not a link. `out` (optional) receives
// out.suppress = [labelStart, labelEnd] when the link fails only because
// the label has an odd number of backtick runs AND a complete (...) group
// follows: marked then also suppresses emphasis inside the label.
function parseLink(s, i, refs, isImage, out) {
  const n = s.length;
  const labelEnd = findLabelEnd(s, i, true); // link text allows nested brackets
  if (labelEnd < 0) return null;
  const label = s.slice(i + 1, labelEnd);
  if (label.length > 999) return null;
  // marked's link label only matches backtick runs in pairs: a label
  // with an ODD number of backtick runs does not form a link at all —
  // UNLESS the label ends with a backtick run of length >= 2 (docs
  // 20/23: `` `` a ` b `` `` at the end of a label DOES form a link,
  // while `` `a ` b` `` / `x `` a ` b `` y` do not). Escaped backticks
  // do not count as runs.
  {
    let runs = 0;
    let lastRunLen = 0;
    let lastRunEnd = -1;
    for (let q = 0; q < label.length; q++) {
      const c = label.charCodeAt(q);
      if (c === 92) { q++; continue; }
      if (c === 96) {
        runs++;
        let len = 1;
        while (q + 1 < label.length && label.charCodeAt(q + 1) === 96) { q++; len++; }
        lastRunLen = len;
        lastRunEnd = q;
      }
    }
    if (runs % 2 === 1 && !(lastRunEnd === label.length - 1 && lastRunLen >= 2)) {
      // a complete (...) group after the label means marked attempted an
      // inline link and failed on the label: emphasis inside the label
      // is suppressed too (the whole label, docs 16/20/23). A bare
      // [label], a [label][ref], or an unclosed '(' does not suppress it.
      const j2 = labelEnd + 1;
      if (out && j2 < n && s.charCodeAt(j2) === 40) {
        const r = parseDestTitle(s, j2 + 1);
        if (r && r.next < n && s.charCodeAt(r.next) === 41) out.suppress = [i + 1, labelEnd];
      }
      return null;
    }
  }
  let j = labelEnd + 1;
  let dest = null;
  let title = null;
  if (j < n && s.charCodeAt(j) === 40) { // inline: (dest "title")
    const r = parseDestTitle(s, j + 1);
    if (r) {
      const k = r.next;
      if (k < n && s.charCodeAt(k) === 41) {
        dest = r.dest;
        title = r.title;
        j = k + 1;
      }
    }
    // a failed inline attempt falls through to the reference forms below
  }
  if (dest === null) {
    // full reference [text][label]: the second '[' must follow immediately.
    // If a '[' follows but the label is not defined, the link does not
    // form at all — it does NOT fall back to the shortcut form.
    if (j < n && s.charCodeAt(j) === 91) { // [label]
      const le = findLabelEnd(s, j);
      if (le >= 0) {
        const rl = s.slice(j + 1, le);
        const key = normalizeLabel(rl.length === 0 ? label : rl);
        if (key !== '') {
          const def = refs.get(key);
          if (def) {
            dest = def.dest;
            title = def.title;
            j = le + 1;
          }
        }
      }
      if (dest === null) return null;
    } else {
      // shortcut: the label is the link text (an empty label is not a reference)
      const key = normalizeLabel(label);
      if (key === '') return null;
      const def = refs.get(key);
      if (!def) return null;
      dest = def.dest;
      title = def.title;
      j = labelEnd + 1;
    }
  }
  const href = cleanUrl(decodeEscapes(dest));
  if (href === null) return null;
  // parse the label's inline content once. A LINK cannot contain a link
  // inside it, but it may contain an image; an IMAGE may contain anything
  // (its label becomes plain-text alt). Return the nodes so plainText can
  // walk into nested links/images for alt text.
  const { nodes } = tokenizeInline(label, refs, true);
  if (!isImage) {
    for (const nd of nodes) {
      if (nd.t === 'link' && !nd.auto) return null;
    }
  }
  processEmphasis(nodes);
  const childrenHtml = renderNodes(nodes);
  const altText = isImage ? plainText(label, refs) : null;
  return { href, title: title === null ? null : decodeEscapes(title), childrenHtml, altText, children: nodes, next: j };
}

// Render a label's inline content as plain text (for image alt attributes).
function plainText(s, refs) {
  const { nodes } = tokenizeInline(s, refs);
  processEmphasis(nodes);
  let out = '';
  const walk = (ns) => {
    if (!ns) return;
    for (const nd of ns) {
      if (nd.t === 'text' || nd.t === 'code' || nd.t === 'entity') out += nd.s;
      else if (nd.t === 'delim') out += nd.ch.repeat(nd.len);
      else if (nd.t === 'br') out += '\n';
      else if (nd.t === 'link' || nd.t === 'image') walk(nd.children);
      else if (nd.t === 'em' || nd.t === 'strong' || nd.t === 'del') walk(nd.children);
      // html nodes contribute nothing to alt text
    }
  };
  walk(nodes);
  return out;
}

// Try to parse an autolink <...> or raw HTML starting at s[i] === '<'.
// Returns {node, next} or null.
function parseAngle(s, i) {
  const n = s.length;
  // autolink: <scheme:...> or <email>
  if (i + 1 < n) {
    // scheme
    const m = /^[A-Za-z][A-Za-z0-9+.-]{1,31}:/.exec(s.slice(i + 1, i + 35));
    if (m) {
      let j = i + 1 + m[0].length;
      while (j < n) {
        const c = s.charCodeAt(j);
        if (c === 32 || c === 60) return null;
        if (c === 62) {
          const dest = s.slice(i + 1, j);
          return { node: { t: 'link', href: cleanUrl(dest), title: null, childrenHtml: escText(dest), altText: null, auto: true, children: [{ t: 'text', s: dest }] }, next: j + 1 };
        }
        j++;
      }
      return null;
    }
    // email in angles
    const em = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+>/.exec(s.slice(i + 1));
    if (em) {
      const dest = em[0].slice(0, -1);
      return { node: { t: 'link', href: cleanUrl('mailto:' + dest), title: null, childrenHtml: escText(dest), altText: null, auto: true, children: [{ t: 'text', s: dest }] }, next: i + 1 + em[0].length };
    }
  }
  // raw HTML
  const h = parseHtmlTag(s, i);
  if (h) return { node: { t: 'html', s: h.text }, next: h.next };
  return null;
}

// Try to parse an inline HTML tag / comment / PI / declaration / CDATA at s[i] === '<'.
// Returns {text, next} or null.
function parseHtmlTag(s, i) {
  const n = s.length;
  let j = i + 1;
  if (j >= n) return null;
  // comment <!-- ... --> : content may not start with '>' or '->', and
  // may not end with '-'. '<!-->' and '<!--->' are abrupt-closing empty
  // comments. '--' inside the content is accepted (marked is lenient).
  if (s.startsWith('!--', j)) {
    // abrupt closing: <!--> or <!---> 
    if (j + 3 < n && s.charCodeAt(j + 3) === 62) return { text: s.slice(i, j + 4), next: j + 4 };
    if (j + 4 < n && s.charCodeAt(j + 3) === 45 && s.charCodeAt(j + 4) === 62) return { text: s.slice(i, j + 5), next: j + 5 };
    const end = s.indexOf('-->', j + 3);
    if (end < 0) return null;
    const content = s.slice(j + 3, end);
    if (content.startsWith('>') || content.startsWith('->') || content.endsWith('-')) return null;
    return { text: s.slice(i, end + 3), next: end + 3 };
  }
  // processing instruction <? ... ?>
  if (s.charCodeAt(j) === 63) {
    const end = s.indexOf('?>', j + 1);
    if (end < 0) return null;
    return { text: s.slice(i, end + 2), next: end + 2 };
  }
  // declaration <!A...>
  if (s.charCodeAt(j) === 33) {
    if (j + 1 < n && s.charCodeAt(j + 1) === 91 && s.startsWith('[CDATA[', j + 1)) {
      const end = s.indexOf(']]>', j + 7);
      if (end < 0) return null;
      return { text: s.slice(i, end + 3), next: end + 3 };
    }
    if (j + 1 < n && s.charCodeAt(j + 1) >= 65 && s.charCodeAt(j + 1) <= 90) {
      const end = s.indexOf('>', j + 1);
      if (end < 0) return null;
      return { text: s.slice(i, end + 1), next: end + 1 };
    }
    return null;
  }
  // closing tag </name ...>
  let closing = false;
  if (s.charCodeAt(j) === 47) { closing = true; j++; }
  // tag name: letter, then alnum or '-'
  if (j >= n) return null;
  const c0 = s.charCodeAt(j);
  if (!((c0 >= 65 && c0 <= 90) || (c0 >= 97 && c0 <= 122))) return null;
  j++;
  while (j < n) {
    const c = s.charCodeAt(j);
    if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45) j++;
    else break;
  }
  // attributes (each must be preceded by whitespace)
  while (true) {
    // skip whitespace
    let k = j;
    while (k < n && isWhitespace(s, k)) k++;
    if (k >= n) return null;
    const c = s.charCodeAt(k);
    if (c === 62) return { text: s.slice(i, k + 1), next: k + 1 }; // >
    if (c === 47 && k + 1 < n && s.charCodeAt(k + 1) === 62) return { text: s.slice(i, k + 2), next: k + 2 }; // />
    if (c === 47) return null; // stray /
    if (k === j) return null; // an attribute must be preceded by whitespace
    // attribute name
    const ac = s.charCodeAt(k);
    if (!((ac >= 65 && ac <= 90) || (ac >= 97 && ac <= 122) || ac === 95 || ac === 58)) return null;
    j = k + 1;
    while (j < n) {
      const d = s.charCodeAt(j);
      if ((d >= 48 && d <= 57) || (d >= 65 && d <= 90) || (d >= 97 && d <= 122) || d === 95 || d === 58 || d === 46 || d === 45) j++;
      else break;
    }
    // optional = value
    const nameEnd = j;
    k = j;
    while (k < n && isWhitespace(s, k)) k++;
    if (k < n && s.charCodeAt(k) === 61) {
      k++;
      while (k < n && isWhitespace(s, k)) k++;
      if (k >= n) return null;
      const q = s.charCodeAt(k);
      if (q === 34 || q === 39) {
        const end = s.indexOf(String.fromCharCode(q), k + 1);
        if (end < 0) return null;
        j = end + 1;
      } else {
        j = k;
        while (j < n) {
          const d = s.charCodeAt(j);
          if (isWhitespace(s, j) || d === 34 || d === 39 || d === 61 || d === 60 || d === 62 || d === 96) break;
          j++;
        }
        if (j === k) return null; // empty unquoted value
      }
    } else {
      j = nameEnd; // boolean attribute: leave the whitespace for the next round
    }
    if (closing) return null; // closing tags take no attributes
  }
}

// Document-level inLink state, leaked across blocks the way marked 18.1.3
// leaks it: an inline `<a ` open tag (literal space after the name —
// `<a/>` and bare `<a>` do NOT open, doc-04 proves it) sets it, and only
// a literal `</a>` clears it. While set, GFM bare autolinks are
// suppressed. Reset once per document in parse().
let inLinkDoc = false;
function trackLinkTag(text) {
  // marked's tag rule: /^<a /i opens inLink, /^<\/a>/i closes it.
  const c1 = text.charCodeAt(1);
  if (c1 === 47) { // '</a>'
    const c2 = text.charCodeAt(2);
    if ((c2 === 97 || c2 === 65) && text.charCodeAt(3) === 62) inLinkDoc = false;
    return;
  }
  if ((c1 === 97 || c1 === 65) && text.charCodeAt(2) === 32) inLinkDoc = true;
}

// GFM extended autolink: www. or bare email at s[i]. Returns {node, next} or null.
// `prev` is the char before i ('' at start). `inStrong` is true while an
// open __ strong span is in effect in the current inline string.
function parseGfmAutolink(s, i, prev, inStrong) {
  const n = s.length;
  // an unclosed inline <a> suppresses every later GFM bare autolink
  // until a literal </a> (docs 03/06/33)
  if (inLinkDoc) return null;
  // a GFM autolink must be preceded by start-of-line, whitespace, or
  // punctuation (per the GFM spec)
  const prevOk = prev === '' || isSpace(prev.charCodeAt(0)) || isUniPunct(prev);
  if (!prevOk) return null;
  // scheme autolink: [a-zA-Z][a-zA-Z0-9+.-]{1,31}: + content (checked first,
  // so mailto:foo@bar.baz links the whole thing, not just the email)
  {
    const m = /^[A-Za-z][A-Za-z0-9+.-]{1,31}:/.exec(s.slice(i, i + 34));
    if (m) {
      let end = i + m[0].length;
      while (end < n) {
        const c = s.charCodeAt(end);
        if (c <= 32 || c === 60) break;
        // a backslash escaping a newline is a hard break, not URL content —
        // except when the URL ends in dots: marked keeps the dots and the
        // backslash in the link (docs 37/40: https://img.shields.io.\)
        if (c === 92 && end + 1 < n && s.charCodeAt(end + 1) === 10) {
          if (end > i + m[0].length && s.charCodeAt(end - 1) === 46) end++;
          break;
        }
        end++;
      }
      // path rules by scheme: mailto takes an email only (no path);
      // http/https/ftp take a full path but must have '://' plus a
      // non-empty host (marked links only these three schemes: 'http:foo',
      // 'config://foo.bar' and 'ssh://example.com' stay literal).
      // Any other scheme is not a GFM autolink in marked.
      const scheme = m[0].slice(0, -1).toLowerCase();
      if (scheme === 'mailto') {
        // truncate at the first '/' after the email
        const slash = s.indexOf('/', i + m[0].length);
        if (slash >= 0 && slash < end) end = slash;
        // validate the email domain: it may not end with '-', and a '_'
        // right after the domain invalidates the whole address
        const at = s.indexOf('@', i + m[0].length);
        if (at >= 0 && at < end) {
          // find the domain end (alnum / '-' / '.' only)
          let k = at + 1;
          while (k < end) {
            const c = s.charCodeAt(k);
            if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45 || c === 46) k++;
            else break;
          }
          const domEnd = k;
          if (domEnd > at + 1 && s.charCodeAt(domEnd - 1) === 45) return null;
          if (domEnd < end && s.charCodeAt(domEnd) === 95) {
            const after = domEnd + 1 < end ? s.charCodeAt(domEnd + 1) : 0;
            if (after === 0 || (after >= 48 && after <= 57) || (after >= 65 && after <= 90) || (after >= 97 && after <= 122) || after === 95 || after === 45 || after === 46) return null;
          }
          // the domain must contain a '.' to be a valid email domain
          if (!s.slice(at + 1, domEnd).includes('.')) return null;
          end = domEnd;
          end = stripAutolinkTail(s, i, end);
        }
      } else if (scheme === 'http' || scheme === 'https' || scheme === 'ftp') {
        // must be '//' plus a non-empty host (m[0] already includes the
        // ':', so the '://' is ':' + '//'): 'http:foo', 'http:/foo',
        // 'http:///foo' and 'http://' are not autolinks. 'sftp://' is not
        // a scheme in marked either — it links only the 'ftp://' part.
        const afterScheme = i + m[0].length;
        if (s.slice(afterScheme, afterScheme + 2) !== '//') return null;
        const hostStart = afterScheme + 2;
        if (hostStart >= end || s.charCodeAt(hostStart) === 47) return null;
      } else if (scheme === 'xmpp') {
        // xmpp takes an email address (foo@bar.baz, domain must contain
        // a '.') plus at most one path segment: 'xmpp:foo@bar.baz/txt'
        // links, 'xmpp:foo@bar.baz/txt/bin' links only up to '/txt',
        // 'xmpp:foo@bar' (no dot) does not link. The only non-mailto
        // scheme marked links with email-like content (gfm-634/635).
        const at = s.indexOf('@', i + m[0].length);
        if (at < 0 || at >= end) return null;
        let k = at + 1;
        while (k < end) {
          const c = s.charCodeAt(k);
          if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45 || c === 46) k++;
          else break;
        }
        if (!s.slice(at + 1, k).includes('.')) return null;
        // at most one path segment: truncate at the second '/' after the scheme
        const firstSlash = s.indexOf('/', i + m[0].length);
        if (firstSlash >= 0 && firstSlash < end) {
          const secondSlash = s.indexOf('/', firstSlash + 1);
          if (secondSlash >= 0 && secondSlash < end) end = secondSlash;
        }
      } else {
        // any other scheme (config, ssh, git, tel, file, ...) is not a
        // GFM autolink in marked — but only when it actually has content
        // after the colon. A bare 'scheme:' with no content (e.g. the
        // trailing ':' of 'www.grain.com:') falls through to the www./
        // email branches below, which is how 'www.grain.com:' links.
        if (end > i + m[0].length) return null;
      }
      end = truncateUnclosedParen(s, i, end);
      end = stripAutolinkTail(s, i, end);
      if (end > i + m[0].length) {
        const dest = s.slice(i, end);
        return { node: { t: 'link', href: cleanUrl(dest), title: null, childrenHtml: escText(dest), altText: null, auto: true, children: [{ t: 'text', s: dest }] }, next: end };
      }
      // a bare scheme with no content is not an autolink; fall through
    }
  }
  // www. — requires the prev check (a letter before 'www.' prevents it:
  // 'awww.example.com' stays literal); enforced by the top-level prevOk
  if (s.startsWith('www.', i)) {
    let j = i + 4;
    // domain: labels of [A-Za-z0-9-]+ separated by '.', must contain a '.'
    // — the dot in 'www.' itself counts, so 'www.foo' (one label after
    // 'www.') is a valid domain and links; 'www.' alone does not (the
    // domainEnd check below still rejects it)
    let hasDot = true;
    let lastLabelStart = j;
    let domainEnd = j; // end of the last complete label
    while (j < n) {
      const c = s.charCodeAt(j);
      if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45) { j++; continue; }
      if (c === 46) {
        if (j === lastLabelStart) break; // empty label
        hasDot = true;
        domainEnd = j;
        j++;
        lastLabelStart = j;
        continue;
      }
      break;
    }
    if (!hasDot) return null;
    if (j > lastLabelStart) domainEnd = j; // the last label completed
    if (domainEnd <= i + 4) return null;
    // optional path/query/fragment: /... (no spaces, no <)
    let end = domainEnd;
    while (end < n) {
      const c = s.charCodeAt(end);
      if (c <= 32 || c === 60) break;
      end++;
    }
    // strip trailing punctuation
    end = truncateUnclosedParen(s, i, end);
    end = stripAutolinkTail(s, i, end);
    if (end <= i + 4) return null;
    const dest = s.slice(i, end);
    return { node: { t: 'link', href: cleanUrl('http://' + dest), title: null, childrenHtml: escText(dest), altText: null, auto: true, children: [{ t: 'text', s: dest }] }, next: end };
  }
  // bare email: local@domain — find '@' ahead within local-part chars
  {
    let j = i;
    while (j < n) {
      const c = s.charCodeAt(j);
      if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
          c === 46 || c === 33 || c === 35 || c === 36 || c === 37 || c === 38 || c === 39 ||
          c === 42 || c === 43 || c === 47 || c === 61 || c === 63 || c === 94 || c === 95 ||
          c === 96 || c === 123 || c === 124 || c === 125 || c === 126 || c === 45) { j++; continue; }
      break;
    }
    if (j > i && j < n && s.charCodeAt(j) === 64) {
      // domain part
      let k = j + 1;
      const dstart = k;
      let hasDot = false;
      let lastLabelStart = k;
      let domainEnd = k;
      while (k < n) {
        const c = s.charCodeAt(k);
        if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45) { k++; continue; }
        if (c === 46) {
          if (k === lastLabelStart) break;
          hasDot = true;
          domainEnd = k;
          k++;
          lastLabelStart = k;
          continue;
        }
        break;
      }
      if (hasDot) {
        if (k > lastLabelStart) domainEnd = k;
        // a domain label may not end with '-'; a '_' right after the
        // domain means the token continues and the email is invalid —
        // but only when the '_' itself continues a word (followed by a
        // word char); a '_' that is a closing emphasis delimiter
        // (followed by space/punctuation/end) does not invalidate it
        if (domainEnd > dstart && s.charCodeAt(domainEnd - 1) === 45) return null;
        if (domainEnd < n && s.charCodeAt(domainEnd) === 95) {
          const after = domainEnd + 1 < n ? s.charCodeAt(domainEnd + 1) : 0;
          // a '_' that continues a word, or sits at end-of-text, kills
          // the email (gfm-632/633); a '_' followed by space/punct is a
          // closing emphasis delimiter and does not (doc-31)
          if (after === 95) {
            // '__' after the domain: a closing strong delimiter only
            // when a __ strong is open (inStrong) and the second '_'
            // is itself followed by space/punct/end (docs 04/25).
            // A bare email__ has different marked behaviour (truncated
            // link), so without an open strong the email stays killed.
            const after2 = domainEnd + 2 < n ? s.charCodeAt(domainEnd + 2) : 0;
            const closerLike = after2 === 0 || !((after2 >= 48 && after2 <= 57) || (after2 >= 65 && after2 <= 90) || (after2 >= 97 && after2 <= 122) || after2 === 95 || after2 === 45 || after2 === 46);
            if (!(inStrong && closerLike)) return null;
          } else if (after === 0 || (after >= 48 && after <= 57) || (after >= 65 && after <= 90) || (after >= 97 && after <= 122) || after === 45 || after === 46) return null;
        }
        let end = stripAutolinkTail(s, i, domainEnd);
        if (end > i) {
          const dest = s.slice(i, end);
          return { node: { t: 'link', href: cleanUrl('mailto:' + dest), title: null, childrenHtml: escText(dest), altText: null, auto: true, children: [{ t: 'text', s: dest }] }, next: end };
        }
      }
    }
  }
  return null;
}

// Strip trailing punctuation from a www-autolink candidate [start, end).
// A '(' in a bare URL must be followed by a ')' somewhere later in the
// candidate; the first '(' with no later ')' ends the URL (marked:
// 'https://example.com/a](https://b.com/c d)' links only 'a]', while
// 'a(b(c)d' keeps the whole thing because a ')' follows the '(').
function truncateUnclosedParen(s, start, end) {
  let lastClose = -1;
  for (let k = start; k < end; k++) if (s.charCodeAt(k) === 41) lastClose = k;
  for (let k = start; k < end; k++) {
    if (s.charCodeAt(k) === 40 && k > lastClose) return k;
  }
  return end;
}

function stripAutolinkTail(s, start, end) {
  let e = end;
  while (e > start) {
    const c = s.charCodeAt(e - 1);
    if (c === 63 || c === 33 || c === 46 || c === 44 || c === 58 || c === 42 || c === 95 || c === 126) { e--; continue; }
    if (c === 39 || c === 34) { e--; continue; }
    if (c === 41) { // keep ')' only when an unmatched '(' precedes it
      let depth = 0;
      for (let k = start; k < e - 1; k++) {
        if (s.charCodeAt(k) === 40) depth++;
        else if (s.charCodeAt(k) === 41 && depth > 0) depth--;
      }
      if (depth > 0) break; // the ')' balances an earlier '('; keep it
      e--;
      continue;
    }
    if (c === 59) { // ';': strip a trailing entity-like '&name;' entirely
      let k = e - 2;
      while (k >= start && /[A-Za-z0-9#]/.test(s[k])) k--;
      if (k >= start && s.charCodeAt(k) === 38) { e = k; continue; }
      e--;
      continue;
    }
    break;
  }
  return e;
}

// Replicate marked 18.1.3's inline masking (its `#n` step) to find the
// ranges of `s` that marked hides from emphasis: the masking runs before
// emphasis, and a link label with MISMATCHED backtick runs (`` ``url` ``)
// plus a later backtick run makes its Ot code-span alternative span across
// the paragraph (its content `[^`][\s\S]*?[^`]` allows backticks inside,
// and the closer only needs a run of the opener's length), swallowing the
// text between them; the blockSkip step then masks that whole span, so any
// emphasis delimiter inside it is invisible to marked's closer search
// (`fe` lastPossibleCloser = -1) and stays literal (docs 09, 16, 28, 35).
// Returns the masked intervals [start, end) in `s` coordinates (both steps
// preserve length, so coordinates align with the original string).
const _maskLinkAlt = /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\s\\(\)]|\((?:\\[\s\S]|[^\s\\(\)])*?\))*?\)/.source;
const _maskCodeAlt = /(?<!`)(?<b>`+)[^`]+\k<b>(?!`)/.source;
const _maskHtmlAlt = /<(?! )[^<>]*?>/.source;
const _maskBlockSkip = new RegExp(_maskLinkAlt + '|' + _maskCodeAlt + '|' + _maskHtmlAlt, 'g');
const _maskOt = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu;
function maskedEmphasisRanges(s) {
  let t = s.replace(_maskOt, (n, o, r) => r ? '+'.repeat(n.length) : o ? o + n.slice(o.length, -o.length).replace(/`/g, '+') + o : n);
  const ranges = [];
  let m;
  _maskBlockSkip.lastIndex = 0;
  while ((m = _maskBlockSkip.exec(t)) !== null) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

// Tokenize inline content into a flat node list.
// Node types: text, code, link, image, html, br, delim, tag.
// Delim nodes carry the emphasis/strikethrough delimiter state.
function tokenizeInline(s, refs, noGfm) {
  const nodes = [];
  // ranges of this string that marked's masking hides from emphasis
  const maskedRanges = maskedEmphasisRanges(s);
  const n = s.length;
  let i = 0;
  let textStart = 0;
  // depth of open __ strong spans in this inline string: a '__' after an
  // email is a closing delimiter only while a strong is open (Fix B)
  let strongDepth = 0;
  // ranges [start, end) in this string where emphasis delimiters are
  // literal text: failed inline-link labels with odd backtick runs
  // (set by parseLink via the out param; docs 16/20/23)
  const suppressRanges = [];
  const pushText = (a, b) => {
    if (b <= a) return;
    const last = nodes[nodes.length - 1];
    if (last && last.t === 'text') last.s += s.slice(a, b);
    else nodes.push({ t: 'text', s: s.slice(a, b) });
  };
  const pushNode = (nd) => { nodes.push(nd); };
  const flushTo = (end) => { pushText(textStart, end); };

  while (i < n) {
    const c = s.charCodeAt(i);
    // backslash escape / hard break
    if (c === 92) {
      if (i + 1 < n) {
        const d = s.charCodeAt(i + 1);
        if (d === 10) {
          flushTo(i);
          pushNode({ t: 'br' });
          i += 2;
          // a hard break strips the next line's leading spaces/tabs
          while (i < n && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
          textStart = i;
          continue;
        }
        if (isPunct(d)) { flushTo(i); pushText(i + 1, i + 2); i += 2; textStart = i; continue; }
      }
      i++;
      continue;
    }
    // code span
    if (c === 96) {
      let j = i;
      while (j < n && s.charCodeAt(j) === 96) j++;
      const run = j - i;
      // find a later run of exactly `run` backticks
      let k = j;
      let found = -1;
      while (k < n) {
        if (s.charCodeAt(k) === 96) {
          let m = k;
          while (m < n && s.charCodeAt(m) === 96) m++;
          if (m - k === run) { found = k; break; }
          k = m;
        } else k++;
      }
      if (found < 0) { i = j; continue; } // literal backticks, keep scanning
      flushTo(i);
      let content = s.slice(j, found);
      content = content.replace(/\n/g, ' ');
      if (content.length >= 2 && content.charCodeAt(0) === 32 && content.charCodeAt(content.length - 1) === 32 && /[^ ]/.test(content)) {
        content = content.slice(1, -1);
      }
      pushNode({ t: 'code', s: content });
      i = found + run;
      textStart = i;
      continue;
    }
    // emphasis / strikethrough delimiter runs
    if (c === 42 || c === 95 || c === 126) {
      let j = i;
      while (j < n && s.charCodeAt(j) === c) j++;
      const run = j - i;
      // delimiters inside a region marked's masking hides (mismatched
      // backtick runs swallowing the phrase) are literal text (docs 09,
      // 16, 28, 35) — marked's closer search never sees them
      if (maskedRanges.some(([a, b]) => i >= a && i < b)) { i = j; continue; }
      // delimiters inside a failed inline-link label (odd backtick runs
      // in the label + a complete (...) group) are literal text in
      // marked — the whole label, not just the code-span part
      if (suppressRanges.some(([a, b]) => i >= a && i < b)) { i = j; continue; }
      if (c === 126 && run >= 3) { i = j; continue; } // ~~~+ is literal text
      // flanking
      const before = i > 0 ? s[i - 1] : '';
      const after = j < n ? s[j] : '';
      const beforeWs = before === '' || isUniSpace(before);
      const afterWs = after === '' || isUniSpace(after);
      const beforePunct = before !== '' && isUniPunct(before);
      const afterPunct = after !== '' && isUniPunct(after);
      const leftFlanking = !afterWs && (!afterPunct || beforeWs || beforePunct);
      const rightFlanking = !beforeWs && (!beforePunct || afterWs || afterPunct);
      let canOpen, canClose;
      if (c === 42 || c === 126) { canOpen = leftFlanking; canClose = rightFlanking; }
      else { // _ : stricter
        canOpen = leftFlanking && (!rightFlanking || beforePunct);
        canClose = rightFlanking && (!leftFlanking || afterPunct);
      }
      flushTo(i);
      pushNode({ t: 'delim', ch: String.fromCharCode(c), len: run, orig: run, canOpen, canClose });
      // track open __ strong depth (only unambiguous open/close runs)
      if (c === 95 && run >= 2) {
        if (canOpen && !canClose) strongDepth++;
        else if (canClose && !canOpen) strongDepth = Math.max(0, strongDepth - 1);
      }
      i = j;
      textStart = i;
      continue;
    }
    // image / link
    if (c === 33 && i + 1 < n && s.charCodeAt(i + 1) === 91) {
      const out = {};
      const r = parseLink(s, i + 1, refs, true, out);
      if (out.suppress) suppressRanges.push(out.suppress);
      if (r) {
        flushTo(i);
        pushNode({ t: 'image', href: r.href, title: r.title, alt: r.altText, children: r.children });
        i = r.next;
        textStart = i;
        continue;
      }
      i++; // literal '!', the '[' is handled next round
      continue;
    }
    if (c === 91) {
      const out = {};
      const r = parseLink(s, i, refs, false, out);
      if (out.suppress) suppressRanges.push(out.suppress);
      if (r) {
        flushTo(i);
        pushNode({ t: 'link', href: r.href, title: r.title, childrenHtml: r.childrenHtml, altText: null, children: r.children });
        i = r.next;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    // autolink / raw HTML
    if (c === 60) {
      const r = parseAngle(s, i);
      if (r) {
        flushTo(i);
        pushNode(r.node);
        if (r.node.t === 'html') trackLinkTag(r.node.s);
        i = r.next;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    // entity
    if (c === 38) {
      const r = entityRef(s, i);
      if (r) {
        flushTo(i);
        if (r.decoded === null) nodes.push({ t: 'entity', s: r.raw });
        else nodes.push({ t: 'text', s: r.decoded });
        i = r.next;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    // newline: hard break (2+ spaces before) or soft break
    if (c === 10) {
      // count spaces before the newline in the current text run
      let sp = 0;
      let k = i - 1;
      while (k >= textStart && s.charCodeAt(k) === 32) { sp++; k--; }
      if (sp >= 2) {
        flushTo(i - sp);
        pushNode({ t: 'br' });
        i++;
        // a hard break strips the next line's leading spaces/tabs
        while (i < n && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i++;
        textStart = i;
        continue;
      }
      flushTo(i);
      pushNode({ t: 'text', s: '\n' });
      i++;
      textStart = i;
      continue;
    }
    // GFM extended autolinks: www. / bare email (only at word starts).
    // Disabled inside link labels: a bare www/email/scheme URL in a label
    // stays plain text, while an angle-bracket autolink still forms.
    if (!noGfm && c === 119 && s.startsWith('www.', i)) { // 'w'
      const prev = i > 0 ? s[i - 1] : '';
      const r = parseGfmAutolink(s, i, prev, strongDepth > 0);
      if (r) {
        flushTo(i);
        pushNode(r.node);
        i = r.next;
        textStart = i;
        continue;
      }
      i++;
      continue;
    }
    if (!noGfm && ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57))) {
      // possible bare email: scan ahead for '@' within local-part chars
      const prev = i > 0 ? s[i - 1] : '';
      const prevOk = prev === '' || isSpace(prev.charCodeAt(0)) || isUniPunct(prev);
      if (prevOk) {
        const r = parseGfmAutolink(s, i, prev, strongDepth > 0);
        if (r) {
          flushTo(i);
          pushNode(r.node);
          i = r.next;
          textStart = i;
          continue;
        }
      }
      i++;
      continue;
    }
    i++;
  }
  flushTo(n);
  return { nodes };
}

// Resolve emphasis / strong / strikethrough over a tokenized node list.
// True if the node range (fromIdx, toIdx) contains a complete inner
// emphasis span that would block an outer span of delimiter `ch` whose
// compared length is `cmpLen` (the opener's original run length when
// deciding whether a pairing may form, the span's `use` when deciding
// where a leftover closer run renders). An inner span only blocks when
// no other delimiter of the same char sits between its close tag and
// the outer closer — but that dangling-delimiter exemption applies
// only when the outer span is a strong (use 2, doc-01); for an em
// pairing the dangling delimiter does not break the block (doc-11).
function hasBlockingInner(nodes, fromIdx, toIdx, ch, cmpLen, use) {
  for (let n = fromIdx + 1; n < toIdx; n++) {
    const nd = nodes[n];
    if (nd.t !== 'tag') continue;
    let innerLen = 0;
    if (nd.s === '</em>') innerLen = 1;
    else if (nd.s === '</strong>') innerLen = 2;
    else continue;
    if (innerLen === cmpLen) continue;
    if (nd.ch !== ch) continue;
    if (!nd.ach || !ALNUM_RE.test(nd.ach)) continue;
    if (nd.bch && ALNUM_RE.test(nd.bch)) continue;
    // a same-char delimiter between the inner close tag and the outer
    // closer breaks the block, but only for a strong pairing (doc-01:
    // the dangling '*' after 'other'); for an em pairing it does not
    // (doc-11: the dangling '*' after 'parse').
    if (use === 2) {
      let dangling = false;
      for (let m = n + 1; m < toIdx; m++) {
        const md = nodes[m];
        if (md.t === 'delim' && md.ch === ch && md.len > 0) { dangling = true; break; }
      }
      if (dangling) continue;
    }
    return true;
  }
  return false;
}

// Delimiter nodes are replaced in place by tag nodes (or kept with reduced length).
function processEmphasis(nodes) {
  // collect delim nodes in order
  const delims = [];
  for (const nd of nodes) if (nd.t === 'delim') delims.push(nd);
  if (delims.length === 0) return;
  // for each closer (left to right), find the nearest matching opener
  for (let ci = 0; ci < delims.length; ci++) {
    const closer = delims[ci];
    if (!closer.canClose || closer.len === 0) continue;
    while (closer.len > 0) {
      let opener = null;
      let oi = -1;
      const closerNodeIdx = nodes.indexOf(closer);
      for (let k = ci - 1; k >= 0; k--) {
        const o = delims[k];
        if (o.ch !== closer.ch || !o.canOpen || o.len === 0) continue;
        // skip an opener that sits inside an already-formed emphasis:
        // scan the nodes between it and the closer; an unmatched close
        // tag means the opener is nested inside <em>/<strong>/<del>
        const oiNode = nodes.indexOf(o);
        let depth = 0;
        let inside = false;
        for (let n = closerNodeIdx - 1; n > oiNode; n--) {
          const nd = nodes[n];
          if (nd.t === 'tag') {
            if (nd.s === '</em>' || nd.s === '</strong>' || nd.s === '</del>') depth++;
            else if (nd.s === '<em>' || nd.s === '<strong>' || nd.s === '<del>') depth--;
          }
        }
        if (depth > 0) inside = true;
        if (inside) continue;
        // Rule 9 (odd-match): when either delimiter can both open and
        // close, the sum of the two runs must not be a multiple of 3
        // (unless both runs are multiples of 3); skip this opener
        const openerAmbi = o.canOpen && o.canClose;
        const closerAmbi = closer.canOpen && closer.canClose;
        if ((openerAmbi || closerAmbi) && (o.len + closer.len) % 3 === 0 &&
            !((o.len % 3 === 0) && (closer.len % 3 === 0))) {
          continue;
        }
        // Intraword inner span blocks the outer span (marked): if the
        // span would contain a complete inner emphasis span that uses
        // the SAME delimiter char but a DIFFERENT delimiter length
        // (em inside strong, or strong inside em), whose closing
        // delimiter is immediately followed by a letter or digit AND
        // whose opening delimiter is NOT preceded by a letter or
        // digit, the outer span does not form.
        // (Same-length nesting, cross-char nesting, <del>, an inner
        // span that starts mid-word, and an outer closer run of
        // length >= 3 are all unaffected. The run length is the
        // ORIGINAL run length in the source, not the remaining length
        // after the run already closed another span.)
        if ((closer.orig || closer.len) < 3) {
          const oOrig = o.orig || o.len;
          let useP = 1;
          if (o.len >= 2 && closer.len >= 2) useP = 2;
          if (closer.ch === '~') useP = Math.min(o.len, closer.len, 2);
          // The inner span must match BOTH the opener's original run
          // length and the span's use to let the pairing form (doc-01:
          // opener ** vs inner * blocks an em pairing; doc-11: use 1
          // vs inner ** blocks an em pairing against a ** opener).
          if (hasBlockingInner(nodes, oiNode, closerNodeIdx, closer.ch, oOrig, useP) ||
              hasBlockingInner(nodes, oiNode, closerNodeIdx, closer.ch, useP, useP)) continue;
        }
        opener = o;
        oi = k;
        break;
      }
      if (!opener) break;
      let use = 1;
      if (opener.len >= 2 && closer.len >= 2) use = 2;
      if (closer.ch === '~') use = Math.min(opener.len, closer.len, 2);
      const openTag = closer.ch === '~' ? '<del>' : (use === 2 ? '<strong>' : '<em>');
      const closeTag = closer.ch === '~' ? '</del>' : (use === 2 ? '</strong>' : '</em>');
      // replace the opener node: keep remainder (if any), then the open tag
      const oiNode = nodes.indexOf(opener);
      const ciNodePre = nodes.indexOf(closer);
      // Boundary chars around the span, for the intraword-inner-span
      // rule below: last char before the opener, first char after the
      // closer ('' when the neighbour is not plain text).
      let bch = '';
      const prevNode = oiNode > 0 ? nodes[oiNode - 1] : null;
      if (prevNode && prevNode.t === 'text' && prevNode.s.length > 0) {
        bch = prevNode.s.slice(-1);
      }
      let ach = '';
      const nextNode = ciNodePre + 1 < nodes.length ? nodes[ciNodePre + 1] : null;
      if (nextNode && nextNode.t === 'text' && nextNode.s.length > 0) {
        ach = nextNode.s[0];
      }
      const spanInfo = { ch: closer.ch, bch: bch, ach: ach };
      // Whether the span contains a blocking-type inner span: if so, a
      // leftover closer run renders INSIDE the span (before the close
      // tag); otherwise it renders outside (after the close tag).
      const blockingInner = hasBlockingInner(nodes, oiNode, ciNodePre, closer.ch, use, use);
      opener.len -= use;
      if (opener.len === 0) {
        nodes[oiNode] = { t: 'tag', s: openTag, ...spanInfo };
      } else {
        nodes.splice(oiNode + 1, 0, { t: 'tag', s: openTag, ...spanInfo });
      }
      // replace the closer node: the close tag, then remainder (if any)
      const ciNode = nodes.indexOf(closer);
      closer.len -= use;
      if (closer.len === 0) {
        nodes[ciNode] = { t: 'tag', s: closeTag, ...spanInfo };
      } else if (blockingInner) {
        // Blocking-type inner span: the leftover delimiters render
        // inside the span, before the close tag.
        nodes.splice(ciNode + 1, 0, { t: 'tag', s: closeTag, ...spanInfo });
      } else {
        nodes.splice(ciNode, 0, { t: 'tag', s: closeTag, ...spanInfo });
      }
      // the closer may match another opener with its remaining length
    }
  }
}

// Render a processed node list to HTML.
function renderNodes(nodes) {
  let out = '';
  for (const nd of nodes) {
    if (nd.t === 'text') out += escText(nd.s);
    else if (nd.t === 'entity') out += nd.s;
    else if (nd.t === 'code') out += '<code>' + escText(nd.s) + '</code>';
    else if (nd.t === 'br') out += '<br>';
    else if (nd.t === 'tag') out += nd.s;
    else if (nd.t === 'html') out += nd.s;
    else if (nd.t === 'delim') out += escText(nd.ch.repeat(nd.len));
    else if (nd.t === 'link') {
      out += '<a href="' + escAttr(nd.href) + '"';
      if (nd.title !== null) out += ' title="' + escAttr(nd.title) + '"';
      out += '>' + nd.childrenHtml + '</a>';
    } else if (nd.t === 'image') {
      out += '<img src="' + escAttr(nd.href) + '" alt="' + escAttr(nd.alt) + '"';
      if (nd.title !== null) out += ' title="' + escAttr(nd.title) + '"';
      out += '>';
    }
  }
  return out;
}

function parseInline(s, refs) {
  if (s === '') return '';
  const { nodes } = tokenizeInline(s, refs);
  processEmphasis(nodes);
  return renderNodes(nodes);
}

// ---------- block parsing ----------

// Line cursor: position in one source line, tab-aware columns.
// `tab` = remaining columns of a partially consumed tab (renders as spaces).
function curPeek(c) {
  if (c.tab > 0) return ' ';
  if (c.i >= c.s.length) return '';
  return c.s[c.i] === '\t' ? ' ' : c.s[c.i];
}
function curAdv(c) {
  if (c.tab > 0) { c.tab--; c.col++; return ' '; }
  const ch = c.s[c.i++];
  if (ch === '\t') {
    const w = 4 - (c.col % 4);
    c.tab = w - 1;
    c.col += 1;
    return ' ';
  }
  c.col++;
  return ch;
}
// Skip up to n columns of spaces. Returns columns skipped.
function curSkipSpaces(c, n) {
  let k = 0;
  while (k < n && curPeek(c) === ' ') { curAdv(c); k++; }
  return k;
}
// Skip the whitespace after a '>' marker the way marked 18.1.3 does.
// Marked expands the whole whitespace run after the marker from the
// marker's column in the current re-lexed string (markerCol + 1), then
// the marker strip removes '>' + one space, leaving the rest of the
// expansion as literal spaces. Expanding the tab later, from the
// accumulated original column, is wrong: '> > \tfoo' must give two
// spaces (tab at re-lexed col 1 -> 3 spaces, minus the stripped one),
// not four (tab at original col 4). With no tab in the run this is
// exactly curSkipSpaces(cur, 1).
function skipQuoteSpace(c, markerCol) {
  let j = c.i;
  let hasTab = false;
  while (j < c.s.length && (c.s[j] === ' ' || c.s[j] === '\t')) {
    if (c.s[j] === '\t') hasTab = true;
    j++;
  }
  if (!hasTab) { curSkipSpaces(c, 1); return; }
  // J-expand the run from re-lexed col (markerCol + 1)
  let col = markerCol + 1;
  let expanded = 0;
  for (let k = c.i; k < j; k++) {
    if (c.s[k] === '\t') { const w = 4 - (col % 4); expanded += w; col += w; }
    else { expanded += 1; col += 1; }
  }
  // the marker strip removes one space; the rest stays as literal spaces
  const remain = expanded - 1;
  // Advance past the run's characters, but move the column by only one
  // space-equivalent, as the old strip did: the item strip and the
  // fence-indent strip downstream work in the ORIGINAL column frame
  // (contentIndent - cur.col), and they must still see the run as one
  // consumed space, while the J-expanded remainder rides in cur.tab
  // where curRest renders it as spaces (doc-02: 6 remain, item takes
  // 2, fenced code keeps 4; doc-05: 2 remain, no item, keeps 2).
  c.i = j;
  c.col += 1;
  c.tab = remain;
}
// Skip up to n columns of the opening fence's indent from a fenced-code
// content line. A tab met while indent is still owed counts as exactly
// one column and is consumed entirely (marked strips it, leaving no
// partially-consumed remainder): '\tindented' with fence indent 2
// renders 'indented', and '\t  indented' with indent 2 renders
// ' indented'. A tab met after the indent is fully stripped is left
// alone. A partially-consumed tab from container stripping (c.tab > 0)
// contributes its remaining columns as ordinary spaces.
function curSkipFenceIndent(c, n) {
  let k = 0;
  while (k < n) {
    if (c.tab > 0) { c.tab--; c.col++; k++; continue; }
    if (c.i >= c.s.length) break;
    const ch = c.s[c.i];
    if (ch === ' ') { c.i++; c.col++; k++; }
    else if (ch === '\t') { const w = 4 - (c.col % 4); c.i++; c.col += w; k++; }
    else break;
  }
  return k;
}
// Remaining content from the cursor (partial tab becomes spaces).
function curRest(c) {
  return (c.tab > 0 ? ' '.repeat(c.tab) : '') + c.s.slice(c.i);
}
// Expand a leading tab in paragraph content to spaces (next multiple of
// 4 from `col`) when the line sits inside a container (col > 0): a tab
// at the start of a paragraph line in a blockquote/list expands by its
// source column ('> \tfoo' -> '  foo', '  > \tfoo' -> '    foo'), while
// a top-level tab stays literal ('a\n\tfoo' keeps the tab) and a
// mid-line tab is never expanded. Only the first tab is expanded.
function expandParaLeadingTab(text, col) {
  if (col <= 0 || text.charCodeAt(0) !== 9) return text;
  return ' '.repeat(4 - (col % 4)) + text.slice(1);
}
// Is the rest of the line blank (only spaces/tabs)?
function curBlank(c) {
  for (let j = c.i; j < c.s.length; j++) {
    const ch = c.s[j];
    if (ch !== ' ' && ch !== '\t') return false;
  }
  return true;
}
// Columns of leading whitespace (spaces/tabs) from the cursor, including
// any partially consumed tab's remaining columns.
function curIndentCols(c) {
  let cols = c.tab;
  let col = c.col + c.tab;
  for (let j = c.i; j < c.s.length; j++) {
    const ch = c.s[j];
    if (ch === ' ') { cols++; col++; }
    else if (ch === '\t') { const w = 4 - (col % 4); cols += w; col += w; }
    else break;
  }
  return cols;
}

// Match an HTML block start at the cursor (after <=3 spaces indent).
// Returns {type, tag} or null. Types: 1 script/pre/style/textarea, 2 comment,
// 3 PI, 4 declaration, 5 CDATA, 6 block tag, 7 a lone non-block tag.
// Type 7 requires a single complete tag and nothing else on the line.
function htmlBlockStart(c) {
  if (curPeek(c) !== '<') return null;
  const rest = curRest(c);
  const m1 = /^<(script|pre|style|textarea)(?:[ \t>]|$)/i.exec(rest);
  if (m1) return { type: 1, tag: m1[1].toLowerCase() };
  // a complete comment / PI / declaration / CDATA section on one line is
  // a type-7 block (its trailing newline is stripped); a multi-line one
  // is type 2-5
  const h7 = parseHtmlTag(c.s, c.i);
  if (h7) {
    let k = h7.next;
    while (k < c.s.length && (c.s[k] === ' ' || c.s[k] === '\t')) k++;
    if (k === c.s.length && (rest.startsWith('<!--') || rest.startsWith('<?') || rest.startsWith('<![CDATA[') || /^<![A-Z]/.test(rest))) {
      return { type: 7, tag: null };
    }
  }
  if (rest.startsWith('<!--')) return { type: 2, tag: null };
  if (rest.startsWith('<?')) return { type: 3, tag: null };
  if (/^<![A-Z]/.test(rest)) return { type: 4, tag: null };
  if (rest.startsWith('<![CDATA[')) return { type: 5, tag: null };
  const m6 = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:[ \t\/>]|$)/.exec(rest);
  if (m6) {
    if (BLOCK_TAGS.has(m6[1].toLowerCase())) return { type: 6, tag: m6[1].toLowerCase() };
    // type 7: a single complete (non-block) tag and nothing else on the line
    const h = parseHtmlTag(c.s, c.i);
    if (h) {
      let k = h.next;
      while (k < c.s.length && (c.s[k] === ' ' || c.s[k] === '\t')) k++;
      if (k === c.s.length) return { type: 7, tag: m6[1].toLowerCase() };
    }
    return null;
  }
  return null;
}

// Is the line at the cursor a thematic break? (3+ of one of * - _, spaces only)
function isThematicBreak(c) {
  const s = c.s;
  let i = c.i;
  // skip leading spaces (already limited to <=3 by caller, but be safe)
  let ch = '';
  let count = 0;
  for (; i < s.length; i++) {
    const d = s[i];
    if (d === ' ' || d === '\t') continue;
    if (ch === '') { ch = d; if (ch !== '*' && ch !== '-' && ch !== '_') return false; count = 1; continue; }
    if (d === ch) { count++; continue; }
    return false;
  }
  return ch !== '' && count >= 3;
}

// Is the line at the cursor a setext underline? Returns 1 (=), 2 (-) or 0.
// The line must be a run of '=' or '-' with only leading/trailing spaces.
function setextLevel(c) {
  const s = c.s;
  let i = c.i;
  // skip a partial tab's remaining spaces, then up to 3 spaces of indent
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
  if (i >= s.length) return 0;
  const ch = s[i];
  if (ch !== '=' && ch !== '-') return 0;
  let j = i;
  while (j < s.length && s[j] === ch) j++;
  while (j < s.length && (s[j] === ' ' || s[j] === '\t')) j++;
  if (j !== s.length) return 0;
  return ch === '=' ? 1 : 2;
}

// Try to parse a list marker at the cursor. Returns null or
// {ordered, bullet, start, markerWidth, contentIndent, next} where `next`
// is a cursor state positioned at the item's content start.
function parseListMarker(c) {
  const s = c.s;
  const startI = c.i, startCol = c.col, startTab = c.tab;
  let ordered = false;
  let bullet = '';
  let startNum = 1;
  let mw = 0;
  const c0 = s.charCodeAt(c.i);
  if (c0 === 45 || c0 === 43 || c0 === 42) { // - + *
    bullet = s[c.i];
    mw = 1;
  } else if (c0 >= 48 && c0 <= 57) {
    let j = c.i;
    while (j < s.length && s.charCodeAt(j) >= 48 && s.charCodeAt(j) <= 57) j++;
    if (j - c.i > 9) return null;
    const d = s.charCodeAt(j);
    if (d !== 46 && d !== 41) return null;
    bullet = String.fromCharCode(d);
    startNum = parseInt(s.slice(c.i, j), 10);
    ordered = true;
    mw = (j - c.i) + 1;
  } else return null;
  // the char after the marker must be space/tab/EOL
  const afterIdx = c.i + mw;
  if (afterIdx < s.length) {
    const a = s[afterIdx];
    if (a !== ' ' && a !== '\t') return null;
  }
  // advance the cursor past the marker, then count the following spaces
  const cur = { s, i: startI, col: startCol, tab: startTab };
  for (let k = 0; k < mw; k++) curAdv(cur);
  let spaces = 0;
  let spacesEnd = { i: cur.i, col: cur.col, tab: cur.tab };
  while (curPeek(cur) === ' ' && spaces < 5) { curAdv(cur); spaces++; spacesEnd = { i: cur.i, col: cur.col, tab: cur.tab }; }
  let contentIndent;
  // the item is empty when only whitespace follows the marker (after the
  // spaces); an empty item's content indent is marker + 1
  const afterSpaces = { s, i: cur.i, col: cur.col, tab: cur.tab };
  const restBlank = curRest(afterSpaces).trim() === '';
  if (restBlank) {
    contentIndent = startCol + mw + 1;
    const cur2 = { s, i: startI, col: startCol, tab: startTab };
    for (let k = 0; k < mw; k++) curAdv(cur2);
    curAdv(cur2);
    return { ordered, bullet, start: startNum, markerWidth: mw, contentIndent, startCol, next: cur2, empty: true };
  }
  if (spaces >= 5) {
    // 5+ spaces: content indent is marker + 1 (relative to the marker)
    contentIndent = startCol + mw + 1;
    // cursor goes to marker + 1 column
    const cur2 = { s, i: startI, col: startCol, tab: startTab };
    for (let k = 0; k < mw; k++) curAdv(cur2);
    curAdv(cur2);
    return { ordered, bullet, start: startNum, markerWidth: mw, contentIndent, startCol, next: cur2, empty: false };
  }
  contentIndent = spacesEnd.col;
  return { ordered, bullet, start: startNum, markerWidth: mw, contentIndent, startCol, next: { i: spacesEnd.i, col: spacesEnd.col, tab: spacesEnd.tab }, empty: false };
}

// Split a table row line into cells. `\|` is an escaped pipe (literal '|');
// `\\` is an escaped backslash; any other backslash is kept for inline parsing.
function splitTableRow(line) {
  let cells = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < line.length) {
      const nx = line[i + 1];
      if (nx === '|') { cur += '|'; i++; continue; }
      if (nx === '\\') { cur += '\\'; i++; continue; }
      cur += ch;
      continue;
    }
    if (ch === '|') { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  // drop the empty cells from a leading / trailing pipe
  if (cells.length > 0 && cells[0].trim() === '') cells = cells.slice(1);
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells = cells.slice(0, -1);
  return cells.map((x) => x.trim());
}

// Is `line` a table delimiter row? Returns the alignment array or null.
function parseDelimiterRow(line) {
  let t = line;
  // strip up to 3 leading spaces
  let k = 0;
  while (k < t.length && t[k] === ' ' && k < 3) k++;
  t = t.slice(k);
  if (!t.includes('|') && !t.includes(':')) return null;
  const cells = splitTableRow(t);
  if (cells.length === 0) return null;
  const aligns = [];
  for (const cell of cells) {
    const m = /^\s*(:?)-+(:?)\s*$/.exec(cell);
    if (!m) return null;
    aligns.push(m[1] && m[2] ? 'center' : m[1] ? 'left' : m[2] ? 'right' : null);
  }
  return aligns;
}

// Parse link reference definitions from the start of a paragraph's lines.
// `lines` are the paragraph's raw content lines. Returns {defs, rest} where
// defs is an array of {label, dest, title} and rest is the remaining lines.
// A title must be separated from the destination by whitespace; if a title
// is present but junk follows it, the definition is taken without the title.
function parseRefDefs(lines) {
  const defs = [];
  let li = 0;
  while (li < lines.length) {
    const text = lines.slice(li).join('\n');
    // a definition starts at a line start with <= 3 spaces indent
    let p = 0;
    let cols = 0;
    while (p < text.length && text[p] === ' ') { p++; cols++; }
    if (text[p] === '\t') { p++; cols += 4; }
    if (cols >= 4 || p >= text.length || text[p] !== '[') break;
    const labelEnd = findLabelEnd(text, p);
    if (labelEnd < 0) break;
    const label = text.slice(p + 1, labelEnd);
    if (label.length === 0 || label.length > 999) break;
    // a whitespace-only label normalizes to empty and is not a definition
    if (normalizeLabel(label) === '') break;
    let q = labelEnd + 1;
    if (q >= text.length || text[q] !== ':') break;
    q++;
    q = skipWS(text, q);
    const d = parseDest(text, q);
    // a destination must be present: an empty <> counts (it consumed input),
    // but no characters consumed means there is no destination
    if (!d || d.next === q) break;
    // try an optional title (must be separated by whitespace)
    let title = null;
    let contentEnd = d.next;
    let r = skipWS(text, d.next);
    if (r < text.length) {
      const c = text.charCodeAt(r);
      if ((c === 34 || c === 39 || c === 40) && r !== d.next) {
        const t = parseTitle(text, r);
        if (!t) break; // a malformed title invalidates the definition
        // the title is only part of the definition if only spaces/tabs
        // follow it on its line; otherwise the definition stands without it
        let r2 = t.next;
        while (r2 < text.length && (text[r2] === ' ' || text[r2] === '\t')) r2++;
        if (r2 >= text.length || text[r2] === '\n') {
          title = t.title;
          contentEnd = t.next;
        }
      }
    }
    // after the destination (and title, if taken) only spaces/tabs may follow
    // on the line
    let r3 = contentEnd;
    while (r3 < text.length && (text[r3] === ' ' || text[r3] === '\t')) r3++;
    if (r3 < text.length && text[r3] !== '\n') break;
    // lines consumed: from li through the line holding contentEnd
    let nl = 0;
    for (let k = 0; k < contentEnd; k++) if (text[k] === '\n') nl++;
    defs.push({ label, dest: d.dest, title });
    li = li + nl + 1;
  }
  return { defs, rest: lines.slice(li) };
}

// ---------- the block parser ----------

function parseBlocks(src, refs) {
  src = src.replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  // a trailing newline does not create a final empty line
  if (lines.length > 0 && lines[lines.length - 1] === '' && src.endsWith('\n')) lines.pop();
  const doc = { t: 'doc', children: [] };
  const containers = [doc];
  let leaf = null; // open leaf: para | fcode | icode | html
  // tight/loose tracking: a blank line is "seen" until a new block or item
  // consumes it. A list is loose when a new item starts in it after a blank
  // line, or when a new block is added to an item that already has a child
  // after a blank line.
  let blankSeen = false;
  let blankItem = null; // deepest item open when the blank line was seen

  const deepest = () => containers[containers.length - 1];

  function finalizeLeaf() {
    if (!leaf) return;
    if (leaf.t === 'para') {
      const { defs, rest } = parseRefDefs(leaf.lines);
      for (const d of defs) {
        const key = normalizeLabel(d.label);
        if (!refs.has(key)) refs.set(key, { dest: d.dest, title: d.title });
      }
      if (rest.length === 0) {
        // paragraph held only reference definitions: drop it
        const ch = deepest().children;
        const idx = ch.indexOf(leaf);
        if (idx >= 0) ch.splice(idx, 1);
      } else if (rest.length >= 2) {
        const aligns = parseDelimiterRow(rest[1]);
        const header = splitTableRow(rest[0]);
        if (aligns && aligns.length === header.length) {
          const rows = [];
          for (let k = 2; k < rest.length; k++) {
            const cells = splitTableRow(rest[k]);
            while (cells.length < header.length) cells.push('');
            rows.push(cells.slice(0, header.length));
          }
          while (header.length < aligns.length) header.push('');
          leaf.t = 'table';
          leaf.aligns = aligns.slice(0, header.length);
          leaf.header = header.slice(0, aligns.length);
          leaf.rows = rows;
          delete leaf.lines;
        } else {
          leaf.lines = rest;
        }
      } else {
        leaf.lines = rest;
      }
    } else if (leaf.t === 'icode') {
      // strip trailing blank lines
      while (leaf.lines.length > 0) {
        const last = leaf.lines[leaf.lines.length - 1];
        if (last === '' || last === '\n') leaf.lines.pop();
        else break;
      }
    } else if (leaf.t === 'html') {
      // a block ending at a blank line strips its trailing newline (all
      // types); types 6-7 also strip when ending at a marker; types 1-5
      // keep the newline when ending at a marker (type 1's marker-alone
      // case is handled by the deferred htmlPendingEnd path; a type-2
      // comment keeps its newline even when --> is alone — doc-15)
      const strip = leaf.htmlEnded === 'blank' || (leaf.hb >= 6 && leaf.htmlEnded !== 'eof');
      if (strip && leaf.lines.length > 0) {
        const last = leaf.lines[leaf.lines.length - 1];
        if (last.endsWith('\n')) leaf.lines[leaf.lines.length - 1] = last.slice(0, -1);
      }
    }
    leaf = null;
  }

  // Close containers down to `depth` (containers.length becomes depth).
  function closeTo(depth) {
    finalizeLeaf();
    while (containers.length > depth) containers.pop();
  }

  // Consume a seen blank line: if the deepest container is an item that
  // already has a child, its list becomes loose. When the deepest container
  // is a list (a new item may follow), the blank line is left for
  // openListItem to consume.
  function consumeBlank() {
    if (!blankSeen) return;
    // the blank line makes a list loose when a new block is added to an
    // item that already has a child. The deepest container may be the
    // item itself, or a list left behind after its last item was popped
    // (in which case the relevant item is the list's parent). When the
    // deepest container IS a list, the next block may be a new item in
    // that list: do NOT consume the blank here — openListItem marks the
    // list loose itself when it joins after a blank line. Only the
    // parent-item case (a non-item block in the list's parent) is
    // handled here, and the blank is left for openListItem to see.
    let d = deepest();
    if (d.t === 'list') {
      // a new item may join this list after the blank (openListItem
      // marks it loose itself); a non-item block in the list's parent
      // is handled when that block is created — do not consume the
      // blank here or the parent list is over-marked (doc-02)
      return;
    }
    if (d.t === 'item') {
      if (d.children.length >= 1 && d.list) d.list.tight = false;
      blankSeen = false;
      blankItem = null;
    }
  }

  // Mark lists loose: any list in `blankLists` still in the container stack.
  function markLoose() {
    consumeBlank();
  }

  // A non-item, non-paragraph block created after a blank line inside
  // an item that already has a child makes the item's list loose (the
  // blank separates two blocks directly inside the item). The paragraph
  // branch and openListItem do this themselves; the other block types
  // (icode, heading, fcode, html, hr, quote) need it here. Called after
  // closeList(), when deepest() is the new block's parent (doc-12/28:
  // a blank + blockquote/fenced code/heading after a nested list left
  // the parent list tight because consumeBlank's list branch just
  // returns and the block never checked blankSeen).
  function looseForBlock() {
    if (!blankSeen) return;
    const d = deepest();
    if (d && d.t === 'item' && d.children.length >= 1 && d.list) d.list.tight = false;
    blankSeen = false;
    blankItem = null;
  }

  // A leaf must never be a direct child of a list: close a list that is
  // the deepest container before creating a leaf.
  function closeList() {
    if (deepest().t === 'list') containers.pop();
  }

  // Open a blockquote container at the cursor (cursor is at '>' after <=3 indent).
  function openQuote(cur, markerCol) {
    // a blockquote must never be a direct child of a list (a list's
    // children are items): close a list that is the deepest container
    // first, so the quote becomes the list's sibling (doc-31, cm-238)
    closeList();
    looseForBlock();
    const q = { t: 'quote', children: [] };
    deepest().children.push(q);
    containers.push(q);
    curAdv(cur); // consume '>'
    // the '>' sits at re-lexed col markerCol (the indent skipped before
    // it): a tab in the whitespace after it expands from that column
    skipQuoteSpace(cur, markerCol);
  }

  // Open (or join) a list and an item for `marker` at the cursor.
  // Returns the item node.
  function openListItem(marker, baseCol) {
    let parent = deepest();
    let isNewList = false;
    // a brand-new list nested inside a list item after a blank line is
    // loose (doc-12/28): the blank inside the parent item makes the
    // parent loose, and the nested list starts in that loose context
    const nestedInItem = parent.t === 'item';
    if (parent.t === 'list' && parent.ordered === marker.ordered && parent.bullet === marker.bullet) {
      // join the existing list
    } else {
      if (parent.t === 'list') {
        // different marker type: close the old list
        containers.pop();
        parent = deepest();
      }
      const list = { t: 'list', ordered: marker.ordered, bullet: marker.bullet, start: marker.start, tight: true, children: [] };
      parent.children.push(list);
      containers.push(list);
      parent = list;
      isNewList = true;
    }
    // contentIndentRel is the item's content column measured from the
    // container content start (baseCol): container prefixes vary in
    // length between lines (e.g. '>' vs '> '), so an absolute column
    // misaligns; a relative indent stays correct across lines
    const item = { t: 'item', contentIndent: marker.contentIndent, contentIndentRel: marker.contentIndent - baseCol, children: [], list: parent };
    parent.children.push(item);
    containers.push(item);
    // a new item starting after a blank line makes its list loose, but
    // only when joining an existing list (a brand-new top-level list
    // starts tight); a brand-new list nested in an item after a blank
    // is loose (doc-12/28)
    if (blankSeen && (!isNewList || nestedInItem)) parent.tight = false;
    blankSeen = false;
    blankItem = null;
    return item;
  }

  // Try to start blocks on the (non-blank) line at `cur`. The cursor is
  // positioned after container matching. `hadNL` is true when the line ends
  // with a newline in the source. Returns nothing; opens containers
  // and/or a leaf as needed.
  function startBlocks(cur, hadNL) {
    for (;;) {
      const ind = curIndentCols(cur);
      // a paragraph keeps the line's leading spaces: remember the cursor
      // before the indent skip
      const paraCur = { s: cur.s, i: cur.i, col: cur.col, tab: cur.tab };
      if (ind >= 4) {
        // indented code block
        closeList();
        looseForBlock();
        const code = { t: 'icode', lines: [] };
        deepest().children.push(code);
        leaf = code;
        // consume 4 columns, then take the rest as the first content line
        for (let k = 0; k < 4; k++) curAdv(cur);
        code.lines.push(curRest(cur) + '\n');
        return;
      }
      // skip the (<=3) indent
      curSkipSpaces(cur, ind);
      // ATX heading
      if (curPeek(cur) === '#') {
        let j = cur.i;
        let level = 0;
        while (j < cur.s.length && cur.s[j] === '#' && level < 7) { j++; level++; }
        if (level >= 1 && level <= 6 && (j >= cur.s.length || cur.s[j] === ' ' || cur.s[j] === '\t')) {
          let content = cur.s.slice(j);
          content = content.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
          // a content of only '#'s is a closing sequence (empty heading)
          if (/^#+$/.test(content)) content = '';
          else content = content.replace(/[ \t]+#+$/, '');
          closeList();
          looseForBlock();
          const h = { t: 'heading', level, lines: [content] };
          deepest().children.push(h);
          return;
        }
      }
      // fenced code
      {
        const ch = curPeek(cur);
        if (ch === '`' || ch === '~') {
          let j = cur.i;
          while (j < cur.s.length && cur.s[j] === ch) j++;
          const len = j - cur.i;
          if (len >= 3) {
            let info = cur.s.slice(j);
            if (ch === '`' && info.includes('`')) {
              // not a fence: fall through to paragraph
            } else {
              info = decodeEscapes(info.trim());
              closeList();
              looseForBlock();
              // marked strips the opening fence's indent from content
              // lines ONLY for backtick fences: its indent compensation
              // regex is /^(\s+)(?:```)/, so a tilde fence's content
              // keeps its full indent (a 3-space-indented ~~~ fence
              // leaves '   foo', a ``` fence leaves 'foo')
              const code = { t: 'fcode', fence: ch, len, info, fenceIndent: ch === '~' ? 0 : ind, lines: [] };
              deepest().children.push(code);
              leaf = code;
              return;
            }
          }
        }
      }
      // HTML block
      {
        const hb = htmlBlockStart(cur);
        if (hb) {
          // the first line keeps its <=3 leading spaces (use the pre-indent
          // cursor)
          const first = curRest(paraCur);
          closeList();
          looseForBlock();
          const block = { t: 'html', hb: hb.type, tag: hb.tag, lines: [first + (hadNL ? '\n' : '')] };
          deepest().children.push(block);
          // the block may end on the very first line
          let closed = false;
          if (hb.type === 1) {
            // type 1 ends when the first line contains its closing tag
            const m = new RegExp('</' + hb.tag + '(?:[ \\t>]|$)', 'i').exec(first);
            if (m) closed = true;
          } else if (hb.type === 2 && first.includes('-->')) closed = true;
          else if (hb.type === 3 && first.includes('?>')) closed = true;
          else if (hb.type === 4 && first.includes('>')) closed = true;
          else if (hb.type === 5 && first.includes(']]>')) closed = true;
          if (closed) {
            // a block closed on its very first line still defers the
            // trailing-newline decision to the next line (strip iff the
            // next line is truly empty, keep iff content follows —
            // marked strips for ALL types 1-5 when a blank line follows:
            // <!-- c --> / <pre> / <div> / <?php / <!DOCTYPE / <![CDATA[);
            // without this the block is never a leaf and its newline is
            // always kept (doc-37)
            block.htmlEnded = 'marker';
            block.htmlPendingEnd = true;
            leaf = block;
          } else leaf = block;
          return;
        }
      }
      // thematic break
      if (isThematicBreak(cur)) {
        closeList();
        looseForBlock();
        deepest().children.push({ t: 'hr' });
        return;
      }
      // blockquote
      if (curPeek(cur) === '>') {
        openQuote(cur, ind);
        continue;
      }
      // list item
      {
        const save = { i: cur.i, col: cur.col, tab: cur.tab };
        const marker = parseListMarker(cur);
        if (marker) {
          openListItem(marker, paraCur.col);
          cur.i = marker.next.i; cur.col = marker.next.col; cur.tab = marker.next.tab;
          if (marker.empty) return;
          continue;
        }
        cur.i = save.i; cur.col = save.col; cur.tab = save.tab;
      }
      // paragraph: it keeps the line's leading spaces, so use the cursor
      // from before the indent skip. If the remainder is blank (only
      // container markers + whitespace), no paragraph is created.
      const restText = expandParaLeadingTab(curRest(paraCur), paraCur.col);
      if (restText.trim() === '') return;
      closeList();
      const para = { t: 'para', lines: [restText] };
      const parent = deepest();
      // a paragraph starting after a blank line in an item is a new
      // block separated by a blank line: the item's list is loose
      // (cm-325: 'baz' after the inner list makes the outer list loose;
      // the blank was left unconsumed by consumeBlank because the
      // deepest container was the inner list)
      if (blankSeen && parent.t === 'item' && parent.children.length >= 1 && parent.list) {
        parent.list.tight = false;
        blankSeen = false;
        blankItem = null;
      }
      parent.children.push(para);
      leaf = para;
      return;
    }
  }

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const hadNL = li < lines.length - 1 || src.endsWith('\n');
    const cur = { s: line, i: 0, col: 0, tab: 0 };
    const blank = curBlank(cur);
    // ---- match open containers ----
    let depth = 0;
    let savepoint = { i: 0, col: 0, tab: 0 };
    for (depth = 0; depth < containers.length; depth++) {
      const cont = containers[depth];
      if (cont.t === 'doc' || cont.t === 'list') continue;
      if (cont.t === 'quote') {
        // a quote always tries to match '>'; a blank line without the
        // marker closes it
        const save = { i: cur.i, col: cur.col, tab: cur.tab };
        const skipped = curSkipSpaces(cur, 3);
        if (curPeek(cur) === '>') {
          curAdv(cur);
          // the '>' sits at re-lexed col `skipped` (the cursor is at the
          // start of the current re-lexed line): a tab in the whitespace
          // after it expands from that column, marked-style
          skipQuoteSpace(cur, skipped);
          savepoint = { i: cur.i, col: cur.col, tab: cur.tab };
          continue;
        }
        cur.i = save.i; cur.col = save.col; cur.tab = save.tab;
        break;
      }
      if (cont.t === 'item') {
        if (blank) { savepoint = { i: cur.i, col: cur.col, tab: cur.tab }; continue; }
        // a fenced code block's content lines belong to the block even
        // when they are not indented to the item's contentIndent (the
        // fence already established the block); keep the item open and
        // advance by however many indent spaces are present (cm-263: a
        // 4-space-indented 'bar' still loses its indent; doc-02: a
        // col-0 line is taken as-is). But only once the block already
        // has content: an empty block's first line, if under-indented,
        // is outside the item and the block closes empty (doc-17).
        // EXCEPTION to the exception: when the fenced block sits inside
        // a blockquote that is deeper in the stack than this item, the
        // line must carry that quote's '>' marker to be fcode content —
        // a line without it is outside the quote and the fence, so the
        // item must not match here (doc-36: a `*` marker at col 6 below
        // the item's content indent is a new list item in the parent
        // list, not content of the `~~~~` fence inside the quote).
        if (leaf && leaf.t === 'fcode' && leaf.lines.length > 0) {
          let inFcode = true;
          const quoteIdx = containers.findIndex((cc, ix) => ix > depth && cc.t === 'quote');
          if (quoteIdx > 0) {
            // simulate the quote match from the current cursor: skip the
            // item's remaining indent, then up to 3 spaces, look for '>'
            const qcur = { s: cur.s, i: cur.i, col: cur.col, tab: cur.tab };
            const needQ = cont.contentIndent - qcur.col;
            if (needQ > 0) curSkipSpaces(qcur, needQ);
            curSkipSpaces(qcur, 3);
            if (curPeek(qcur) !== '>') inFcode = false;
          }
          if (inFcode) {
            const need0 = cont.contentIndent - cur.col;
            if (need0 > 0) curSkipSpaces(cur, need0);
            savepoint = { i: cur.i, col: cur.col, tab: cur.tab };
            continue;
          }
        }
        const save = { i: cur.i, col: cur.col, tab: cur.tab };
        // the item's content starts `contentIndentRel` columns after the
        // current line's container content start (cur.col)
        const need = cont.contentIndentRel;
        const got = need <= 0 ? 0 : curSkipSpaces(cur, need);
        if (need <= 0 || got >= need) {
          savepoint = { i: cur.i, col: cur.col, tab: cur.tab };
          continue;
        }
        cur.i = save.i; cur.col = save.col; cur.tab = save.tab;
        break;
      }
    }
    const matched = depth;
    // a line that is blank after container matching (only markers +
    // whitespace remain) is a blank line, not a lazy continuation and
    // not an interrupting block start — it must reach the blank-line
    // branch (which keeps list/item containers open)
    const blankAfterMatch = /^[ \t]*$/.test(curRest(cur));
    // ---- lazy paragraph continuation? ----
    // A lazy line continues the paragraph even though containers did not
    // match, unless it would start a new block (thematic break, ATX, fence,
    // HTML 1-6, blockquote, list item). A lazy line that looks like a
    // setext underline is kept as text with 4 spaces prepended so it cannot
    // become a heading; other lazy lines lose up to 4 leading spaces.
    if (matched < containers.length && leaf && leaf.t === 'para' && !blank && !blankAfterMatch) {
      const save = { i: savepoint.i, col: savepoint.col, tab: savepoint.tab };
      const lcur = { s: line, i: save.i, col: save.col, tab: save.tab };
      let interrupts = false;
      let lazyText = null;
      const lind = curIndentCols(lcur);
      if (lind <= 3) {
        curSkipSpaces(lcur, lind);
        const pk = curPeek(lcur);
        if (pk === '#') {
          let j = lcur.i, level = 0;
          while (j < lcur.s.length && lcur.s[j] === '#' && level < 7) { j++; level++; }
          if (level >= 1 && level <= 6 && (j >= lcur.s.length || lcur.s[j] === ' ' || lcur.s[j] === '\t')) interrupts = true;
        } else if (pk === '`' || pk === '~') {
          let j = lcur.i;
          while (j < lcur.s.length && lcur.s[j] === pk) j++;
          if (j - lcur.i >= 3 && !(pk === '`' && lcur.s.slice(j).includes('`'))) interrupts = true;
        } else if (pk === '<') {
          const hb = htmlBlockStart(lcur);
          if (hb && hb.type >= 1 && hb.type <= 6) interrupts = true;
        } else if (isThematicBreak(lcur)) interrupts = true;
        else if (pk === '>') interrupts = true;
        else {
          const marker = parseListMarker(lcur);
          if (marker) {
            if (!marker.ordered || marker.start === 1) interrupts = true;
            // a list item is a new item (not a lazy continuation) when
            // there is an open ancestor list, regardless of start number
            // or delimiter; an empty item alone does not interrupt
            if (!interrupts && !marker.empty) {
              let hasAncestorList = false;
              for (let d = matched - 1; d >= 0; d--) {
                if (containers[d].t === 'list') { hasAncestorList = true; break; }
              }
              if (hasAncestorList) interrupts = true;
            }
            if (!interrupts && marker.empty) {
              // an empty item that joins an ancestor list is a new item
              for (let d = matched - 1; d >= 0; d--) {
                if (containers[d].t === 'list') {
                  const L = containers[d];
                  if (L.ordered === marker.ordered && L.bullet === marker.bullet) interrupts = true;
                  break;
                }
              }
            }
          } else if (setextLevel(lcur) > 0) {
            // a setext-like lazy line: prepend 4 spaces, keep it as text
            lazyText = '    ' + curRest(lcur).replace(/^[ \t]+/, '');
          }
        }
      }
      if (!interrupts) {
        if (lazyText !== null) {
          leaf.lines.push(lazyText);
        } else {
          cur.i = save.i; cur.col = save.col; cur.tab = save.tab;
          // a lazy line loses 4 leading spaces only when indented 4+;
          // fewer leading spaces are paragraph content and are kept
          // (doc-29 keeps 1 space; cm-238/291/312 strip 4)
          if (curIndentCols(cur) >= 4) curSkipSpaces(cur, 4);
          leaf.lines.push(expandParaLeadingTab(curRest(cur), cur.col));
        }
        continue;
      }
      // an interrupting line: close the unmatched containers and start fresh
      closeTo(matched);
      // fall through with the cursor at the savepoint
      cur.i = save.i; cur.col = save.col; cur.tab = save.tab;
    } else if (matched < containers.length) {
      // a blank line (only container markers + whitespace remain) does
      // NOT close list/item containers descended from a matched container
      // — the list continues across the blank line, and the blank line
      // makes it loose (doc-04/09/10: blank '>' inside a quote). Only
      // close other (non-list/item) unmatched containers.
      if (/^[ \t]*$/.test(curRest(cur))) {
        let m = matched;
        while (m < containers.length && (containers[m].t === 'list' || containers[m].t === 'item')) m++;
        // closeTo finalizes the open leaf, so only call it when a
        // container is actually being closed: a blank line that matches
        // every container (m === length) is content for an open fenced
        // or indented code leaf, not a leaf-ender (doc-12: a blank '>'
        // right after an indented ```yaml fence inside a list item
        // closed the empty fcode because the item match failed on the
        // blank line — lines.length === 0 — and closeTo killed it)
        if (m < containers.length) closeTo(m);
      } else {
        closeTo(matched);
      }
    }
    // ---- blank line ----
    // a line is blank when the whole line is whitespace, or when only
    // container markers + whitespace remain after matching (an empty rest),
    // or when the rest is whitespace-only and no paragraph is open
    const restBlank = curBlank(cur);
    const restEmpty = cur.i >= cur.s.length && cur.tab === 0;
    const isBlankLine = blank || restEmpty || (restBlank && !(leaf && leaf.t === 'para'));
    // a type-1 html block whose end marker was seen on the previous line
    // is finalized now: it ends at a blank line (strip the newline) if
    // this line is blank, otherwise at the marker (keep it) — doc-05/12/20
    // (blank after </style>) vs cm-170/172 (content after the end tag).
    // A type-2 comment defers the same way, but only a TRULY empty next
    // line strips the newline (doc-01/13); a whitespace-only next line
    // keeps it (doc-15).
    if (leaf && leaf.t === 'html' && leaf.htmlPendingEnd) {
      // type 1 (like type 2) strips the trailing newline only when the
      // next line is TRULY empty (doc-22: a tab-only line, doc-24: a
      // spaces-only line keep '</pre>\n'); a whitespace-only next line
      // ends the block at the marker and keeps the newline. "Truly
      // empty" is measured AFTER container matching (restEmpty): a
      // '>' line inside an already-open quote is blank (doc-30 — the
      // marker was consumed), but a '>' line that OPENS a new quote
      // leaves cur.i at 0 and is content (keep the newline).
      if (restEmpty) leaf.htmlEnded = 'blank';
      finalizeLeaf();
    }
    if (isBlankLine) {
      // a whitespace-only line containing a TAB inside a table paragraph
      // is a table row of empty cells, not a paragraph break (doc-26: a
      // lone tab line, and the setext lines after it, are table rows);
      // a spaces-only line still ends the table (doc-29: '   ' before a
      // fence is a blank line, not a row)
      if (leaf && leaf.t === 'para' && line.includes('\t') && leaf.lines.length >= 2 && parseDelimiterRow(leaf.lines[1])) {
        leaf.lines.push(line);
        continue;
      }
      if (leaf) {
        if (leaf.t === 'para') finalizeLeaf();
        else if (leaf.t === 'fcode') {
          // a blank line inside fenced code keeps its remaining spaces
          // after stripping the opening fence's indent
          const rest = curRest(cur);
          let stripped = 0;
          let j = 0;
          let col = cur.col;
          const find = leaf.fenceIndent || 0;
          while (j < rest.length && stripped < find) {
            if (rest[j] === ' ') { stripped++; col++; j++; }
            else if (rest[j] === '\t') { const w = 4 - (col % 4); stripped += w; col += w; j++; }
            else break;
          }
          leaf.lines.push(rest.slice(j) + '\n');
        }
        else if (leaf.t === 'icode') {
          // a blank line inside indented code keeps its remaining spaces
          // after stripping 4 columns of indent
          const rest = curRest(cur);
          let stripped = 0;
          let j = 0;
          let col = cur.col;
          while (j < rest.length && stripped < 4) {
            if (rest[j] === ' ') { stripped++; col++; j++; }
            else if (rest[j] === '\t') { const w = 4 - (col % 4); stripped += w; col += w; j++; }
            else break;
          }
          leaf.lines.push(rest.slice(j) + '\n');
        } else if (leaf.t === 'html') {
          // types 6 and 7 end at a blank line; types 1-5 continue through it
          if (leaf.hb === 6 || leaf.hb === 7) { leaf.htmlEnded = 'blank'; finalizeLeaf(); }
          else leaf.lines.push('\n');
        }
      }
      // record the blank line for tight/loose tracking: only when the
      // blank line is directly in an item (deepest container is the item
      // itself). A blank line inside a nested quote or a code leaf does
      // not separate the item's children. A blank line inside a
      // fenced/indented code leaf is code content, not a separator.
      if (!leaf || (leaf.t !== 'fcode' && leaf.t !== 'icode')) {
        const d = deepest();
        if (d && d.t === 'item') { blankSeen = true; blankItem = d; }
      }
      // an empty list item (no children) is closed by a blank line: pop it
      // from the container stack (it stays in the list as an empty <li>)
      if (deepest() && deepest().t === 'item' && deepest().children.length === 0) {
        containers.pop();
      }
      continue;
    }
    // ---- non-blank line ----
    // fenced code leaf
    if (leaf && leaf.t === 'fcode') {
      const save = { i: cur.i, col: cur.col, tab: cur.tab };
      curSkipSpaces(cur, 3);
      const ch = curPeek(cur);
      if (ch === leaf.fence) {
        let j = cur.i;
        while (j < cur.s.length && cur.s[j] === ch) j++;
        if (j - cur.i >= leaf.len) {
          let k = j;
          let onlySpaces = true;
          while (k < cur.s.length) { if (cur.s[k] !== ' ' && cur.s[k] !== '\t') { onlySpaces = false; break; } k++; }
          if (onlySpaces) {
            // a single trailing blank line before the closing fence is
            // dropped (cm-318: content 'b' + 2 blank lines renders 'b\n\n')
            const ls = leaf.lines;
            if (ls.length > 0) {
              const last = ls[ls.length - 1];
              if (last === '\n' || last === '') ls.pop();
            }
            finalizeLeaf(); continue;
          }
        }
      }
      cur.i = save.i; cur.col = save.col; cur.tab = save.tab;
      // strip up to the opening fence's indent from each content line.
      // a tab in the content is expanded to spaces (next multiple of 4)
      // only when the line sits inside a container (col > 0 BEFORE the
      // fence-indent strip) — a top-level tab stays literal even after
      // the fence indent is stripped (doc-13 line 47/365 vs 182)
      const colBeforeStrip = cur.col;
      curSkipFenceIndent(cur, leaf.fenceIndent || 0);
      let content = curRest(cur);
      if (colBeforeStrip > 0 && content.includes('\t')) {
        let col = cur.col;
        let out = '';
        for (let q = 0; q < content.length; q++) {
          const ch = content[q];
          if (ch === '\t') { const w = 4 - (col % 4); out += ' '.repeat(w); col += w; }
          else { out += ch; col++; }
        }
        content = out;
      }
      leaf.lines.push(content + (hadNL ? '\n' : ''));
      continue;
    }
    // HTML block leaf
    if (leaf && leaf.t === 'html') {
      const text = curRest(cur);
      leaf.lines.push(text + (hadNL ? '\n' : ''));
      const hb = leaf.hb;
      if (hb === 1) {
        // type 1 ends at the line containing the matching end tag
        // (anywhere in the line, case-insensitive); finalization is
        // deferred one line so a following blank line ends it at the
        // blank (stripping the newline) instead of at the marker
        const m = new RegExp('</' + leaf.tag + '(?:[ \\t>]|$)', 'i').exec(text);
        if (m) { leaf.htmlEnded = 'marker'; leaf.htmlPendingEnd = true; }
      } else if (hb === 2 && text.includes('-->')) {
        // type 2 ends at the line containing -->; finalization is
        // deferred one line so the next line decides the trailing
        // newline: a truly empty next line strips it (doc-01/13), a
        // whitespace-only or content next line keeps it (doc-15)
        leaf.htmlEnded = 'marker'; leaf.htmlPendingEnd = true;
      }
      else if (hb === 3 && text.includes('?>')) { leaf.htmlEnded = 'marker'; finalizeLeaf(); }
      else if (hb === 4 && text.includes('>')) { leaf.htmlEnded = 'marker'; finalizeLeaf(); }
      else if (hb === 5 && text.includes(']]>')) { leaf.htmlEnded = 'marker'; finalizeLeaf(); }
      continue;
    }
    // indented code leaf
    if (leaf && leaf.t === 'icode') {
      const ind = curIndentCols(cur);
      if (ind >= 4) {
        for (let k = 0; k < 4; k++) curAdv(cur);
        leaf.lines.push(curRest(cur) + (hadNL ? '\n' : ''));
        continue;
      }
      finalizeLeaf();
      // fall through to leaf-start detection
    }
    // paragraph leaf: check for interrupting starts
    if (leaf && leaf.t === 'para') {
      const save = { i: cur.i, col: cur.col, tab: cur.tab };
      const ind = curIndentCols(cur);
      let handled = false;
      if (ind <= 3) {
        curSkipSpaces(cur, ind);
        const lv = setextLevel(cur);
        // a table paragraph is not a setext heading: its second line is
        // a delimiter row, so a '===' line after the rows is a table
        // row, not an underline (doc-26)
        const isTable = leaf.lines.length >= 2 && !!parseDelimiterRow(leaf.lines[1]);
        if (lv > 0 && !isTable) {
          // reference definitions are extracted from the paragraph first;
          // if nothing remains, the underline line becomes a fresh paragraph
          const { defs, rest } = parseRefDefs(leaf.lines);
          for (const d of defs) {
            const key = normalizeLabel(d.label);
            if (!refs.has(key)) refs.set(key, { dest: d.dest, title: d.title });
          }
          const ch = deepest().children;
          const idx = ch.indexOf(leaf);
          if (rest.length === 0) {
            // the paragraph held only definitions: drop it, and the
            // underline line becomes a new paragraph
            if (idx >= 0) ch.splice(idx, 1);
            leaf = null;
            cur.i = save.i; cur.col = save.col; cur.tab = save.tab;
            startBlocks(cur, hadNL);
            handled = true;
          } else {
            // strip trailing spaces/tabs from the heading's last line and
            // up to 3 leading spaces from each line
            rest[rest.length - 1] = rest[rest.length - 1].replace(/[ \t]+$/, '');
            for (let r = 0; r < rest.length; r++) rest[r] = rest[r].replace(/^ {0,3}/, '');
            const h = { t: 'heading', level: lv, lines: rest };
            ch[idx] = h;
            leaf = null;
            handled = true;
          }
        } else {
          cur.i = save.i; cur.col = save.col; cur.tab = save.tab;
        }
      }
      if (handled) continue;
      // other interrupting starts: ATX / fence / html 1-6 / thematic / quote / list
      const save2 = { i: cur.i, col: cur.col, tab: cur.tab };
      const ind2 = curIndentCols(cur);
      if (ind2 <= 3) {
        curSkipSpaces(cur, ind2);
        const pk = curPeek(cur);
        let interrupts = false;
        if (pk === '#') {
          let j = cur.i, level = 0;
          while (j < cur.s.length && cur.s[j] === '#' && level < 7) { j++; level++; }
          if (level >= 1 && level <= 6 && (j >= cur.s.length || cur.s[j] === ' ' || cur.s[j] === '\t')) interrupts = true;
        } else if (pk === '`' || pk === '~') {
          let j = cur.i;
          while (j < cur.s.length && cur.s[j] === pk) j++;
          if (j - cur.i >= 3) {
            if (!(pk === '`' && cur.s.slice(j).includes('`'))) interrupts = true;
          }
        } else if (pk === '<') {
          const hb = htmlBlockStart(cur);
          if (hb && hb.type >= 1 && hb.type <= 6) interrupts = true;
        } else if (isThematicBreak(cur)) interrupts = true;
        else if (pk === '>') interrupts = true;
        else {
          const marker = parseListMarker(cur);
          if (marker && !marker.empty) {
            if (!marker.ordered || marker.start === 1) interrupts = true;
            else {
              // an ordered marker with start != 1 interrupts a paragraph
              // when nested inside a list item (it starts a sub-list,
              // doc-27 '0.' inside a '2.' item); at the top level the
              // start==1 rule still applies
              for (const c of containers) {
                if (c.t === 'item') { interrupts = true; break; }
              }
            }
          }
        }
        if (interrupts) {
          finalizeLeaf();
          cur.i = save2.i; cur.col = save2.col; cur.tab = save2.tab;
          markLoose();
          startBlocks(cur, hadNL);
          continue;
        }
        cur.i = save2.i; cur.col = save2.col; cur.tab = save2.tab;
      }
      // paragraph continuation
      leaf.lines.push(expandParaLeadingTab(curRest(cur), cur.col));
      continue;
    }
    // no open leaf: start new blocks
    markLoose();
    startBlocks(cur, hadNL);
  }
  // mark an html block still open at EOF so its trailing newline is kept
  if (leaf && leaf.t === 'html') leaf.htmlEnded = 'eof';
  closeTo(1);
  return { doc, refs };
}

// ---------- rendering ----------

function renderNode(node, refs, out) {
  switch (node.t) {
    case 'doc':
      for (const c of node.children) renderNode(c, refs, out);
      return;
    case 'para':
      out.push('<p>', parseInline(node.lines.join('\n'), refs), '</p>\n');
      return;
    case 'heading':
      out.push('<h', String(node.level), '>', parseInline(node.lines.join('\n'), refs), '</h', String(node.level), '>\n');
      return;
    case 'hr':
      out.push('<hr>\n');
      return;
    case 'fcode': {
      const word = node.info ? node.info.split(/[ \t]+/)[0] : '';
      out.push('<pre><code');
      if (word) out.push(' class="language-', escAttr(word), '"');
      out.push('>', escText(node.lines.join('')), '</code></pre>\n');
      return;
    }
    case 'icode':
      out.push('<pre><code>', escText(node.lines.join('')), '</code></pre>\n');
      return;
    case 'html':
      out.push(node.lines.join(''));
      return;
    case 'quote':
      out.push('<blockquote>\n');
      for (const c of node.children) renderNode(c, refs, out);
      out.push('</blockquote>\n');
      return;
    case 'list': {
      out.push(node.ordered ? '<ol' : '<ul');
      if (node.ordered && node.start !== 1) out.push(' start="', String(node.start), '"');
      out.push('>\n');
      for (const item of node.children) {
        out.push('<li>');
        const kids = item.children;
        for (let k = 0; k < kids.length; k++) {
          const ch = kids[k];
          if (ch.t === 'para') {
            // a task list item: the first paragraph starts with [ ] / [x] / [X]
            let text = ch.lines.join('\n');
            let checkbox = null;
            if (k === 0) {
              const m = /^ {0,3}\[( |x|X)\] /.exec(text);
              if (m) {
                checkbox = m[1] === ' ' ? '<input disabled="" type="checkbox"> ' : '<input checked="" disabled="" type="checkbox"> ';
                text = text.slice(m[0].length);
              }
            }
            if (node.tight) {
              if (checkbox) out.push(checkbox);
              out.push(parseInline(text, refs));
              // a newline follows a tight paragraph only before another
              // paragraph (a following block starts immediately)
              if (k < kids.length - 1 && kids[k + 1].t === 'para') out.push('\n');
            } else {
              out.push('<p>');
              if (checkbox) out.push(checkbox);
              out.push(parseInline(text, refs), '</p>\n');
            }
          } else {
            renderNode(ch, refs, out);
          }
        }
        out.push('</li>\n');
      }
      out.push(node.ordered ? '</ol>\n' : '</ul>\n');
      return;
    }
    case 'table': {
      out.push('<table>\n<thead>\n<tr>\n');
      for (let k = 0; k < node.header.length; k++) {
        out.push('<th');
        const a = node.aligns[k];
        if (a) out.push(' align="', a, '"');
        out.push('>', parseInline(node.header[k], refs), '</th>\n');
      }
      out.push('</tr>\n</thead>\n');
      if (node.rows.length > 0) {
        out.push('<tbody>');
        for (const row of node.rows) {
          out.push('<tr>\n');
          for (let k = 0; k < row.length; k++) {
            out.push('<td');
            const a = node.aligns[k];
            if (a) out.push(' align="', a, '"');
            out.push('>', parseInline(row[k], refs), '</td>\n');
          }
          out.push('</tr>\n');
        }
        out.push('</tbody>');
      }
      out.push('</table>\n');
      return;
    }
  }
}

export function parse(markdown) {
  inLinkDoc = false;
  const refs = new Map();
  const { doc } = parseBlocks(markdown, refs);
  const out = [];
  renderNode(doc, refs, out);
  return out.join('');
}
