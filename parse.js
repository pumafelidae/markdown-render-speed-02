// A single-pass Markdown renderer whose HTML matches marked 18.1.3 with its
// default options (GFM on, breaks off, pedantic off). Written fresh from the
// competition prose spec and the kit's rules; no vendored code is used here.
// The renderer walks blocks once and inline content once, writing HTML
// directly, and keeps no state between calls to parse().

// ---------- small helpers ----------

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const ESC_TEST = /[&<>"']/;
const ESC_REPLACE = /[&<>"']/g;
const ESC_TEST_NOENC = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
const ESC_REPLACE_NOENC = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;

function escHtml(s, encode) {
  if (encode) {
    if (ESC_TEST.test(s)) return s.replace(ESC_REPLACE, (c) => ESCAPES[c]);
  } else if (ESC_TEST_NOENC.test(s)) {
    return s.replace(ESC_REPLACE_NOENC, (c) => ESCAPES[c]);
  }
  return s;
}

const NUM_REF = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/;
const NUM_REF_OR_AMP = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;

function unesc(s) {
  if (!NUM_REF.test(s)) return s;
  return s.replace(NUM_REF_OR_AMP, (m, dec, hex) => {
    if (dec === undefined && hex === undefined) return '&amp;';
    const n = hex === undefined ? parseInt(dec, 10) : parseInt(hex, 16);
    if (n === 0 || n > 1114111 || (n >= 55296 && n <= 57343)) return '�';
    if (n === 38) return '&amp;';
    return String.fromCodePoint(n);
  });
}

function cleanHref(href) {
  try {
    return encodeURI(href).replace(/%25/g, '%');
  } catch {
    return null;
  }
}

// Index of the unmatched closer in `pair` (e.g. "()"), -2 when an opener is
// left unclosed, -1 when there is no bracket at all. Backslashes escape.
function findClose(str, pair) {
  if (str.indexOf(pair[0]) === -1 && str.indexOf(pair[1]) === -1) return -1;
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') { i++; continue; }
    if (str[i] === pair[0]) depth++;
    else if (str[i] === pair[1]) { depth--; if (depth < 0) return i; }
  }
  return depth > 0 ? -2 : -1;
}

function normLabel(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase().toUpperCase().toLowerCase();
}

// Expand tabs to spaces, to the next multiple of four from column `col`.
function expandTabs(s, col = 0) {
  let out = '';
  let c = col;
  for (const ch of s) {
    if (ch === '\t') {
      const r = 4 - (c % 4);
      out += ' '.repeat(r);
      c += r;
    } else {
      out += ch;
      c++;
    }
  }
  return out;
}

// Strip a run of `ch` from the end of `s` (or, when `invert`, strip a run of
// characters that are not `ch`).
function rtrimEnd(s, ch, invert) {
  const n = s.length;
  if (n === 0) return '';
  let k = 0;
  for (; k < n;) {
    const r = s.charAt(n - k - 1);
    if (r === ch && !invert) k++;
    else if (r !== ch && invert) k++;
    else break;
  }
  return s.slice(0, n - k);
}

// Drop trailing blank lines, keeping at most one trailing blank line.
function trimBlankTail(s) {
  const lines = s.split('\n');
  let t = lines.length - 1;
  for (; t >= 0 && /^[ \t]*$/.test(lines[t]);) t--;
  return lines.length - t <= 2 ? s : lines.slice(0, t + 1).join('\n');
}

// Split one table row on unescaped pipes, trimming cells and honouring the
// expected column count.
function splitCells(row, count) {
  const t = row.replace(/\|/g, (m, off, str) => {
    let escaped = false;
    let p = off;
    for (; --p >= 0 && str[p] === '\\';) escaped = !escaped;
    return escaped ? '|' : ' |';
  });
  const cells = t.split(/ \|/);
  if (!cells[0].trim()) cells.shift();
  if (cells.length > 0 && !cells.at(-1).trim()) cells.pop();
  if (count) {
    if (cells.length > count) cells.splice(count);
    else for (; cells.length < count;) cells.push('');
  }
  for (let i = 0; i < cells.length; i++) cells[i] = cells[i].trim().replace(/\\\|/g, '|');
  return cells;
}

// ---------- emphasis / strikethrough mask ----------

// For a stretch of inline source, find the last index where a delimiter run
// could close an emphasis span (per delimiter) and a strikethrough span.
// A run only counts when the character before it is not whitespace.
function computeMask(src) {
  const em = { '*': -1, '_': -1 };
  let del = -1;
  const n = src.length;
  for (let s = 0; s < n; s++) {
    const r = src[s];
    if (r !== '*' && r !== '_' && r !== '~') continue;
    const prev = s === 0 ? '\n' : src[s - 1];
    let i = s + 1;
    for (; i < n && src[i] === r;) i++;
    if (prev !== ' ' && prev !== '\t' && prev !== '\n' && prev !== '\r' && prev !== '\f') {
      if (r === '~') del = s;
      else em[r] = s;
    }
    s = i - 1;
  }
  return { maskedSrc: src, lastPossibleEmStrongCloserIndex: em, lastPossibleDelCloserIndex: del };
}

// ---------- "other" patterns: small shared pieces ----------

const TAGLIST = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';

const O = {
  codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  endingSpaceTabChar: /[ \t]$/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  leadingSpaceTab: /^[ \t]+/,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  blockquoteMarkerWhitespace: /^( {0,3}>)([ \t]+)/gm,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\][ \t]+\S/,
  listReplaceTask: /^\[[ xX]\][ \t]+/,
  listTaskCheckbox: /\[[ xX]\]/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
};

function memoRegex(make) {
  const cache = [];
  return (n) => {
    const k = Math.max(0, Math.min(3, n - 1));
    return cache[k] || (cache[k] = make(k));
  };
}

O.listItemRegex = (a) => new RegExp(`^( {0,3}${a})((?:[\t ][^\n]*)?(?:\n|$))`);
O.nextBulletRegex = memoRegex((k) => new RegExp(`^ {0,${k}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\n]*)?(?:\n|$))`));
O.hrRegex = memoRegex((k) => new RegExp(`^ {0,${k}}((?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\\*[ \t]*){3,})(?:\n+|$)`));
O.fencesBeginRegex = memoRegex((k) => new RegExp(`^ {0,${k}}(?:\`\`\`|~~~)`));
O.headingBeginRegex = memoRegex((k) => new RegExp(`^ {0,${k}}#{1,6}(?:\\s|$)`));
O.htmlBeginRegex = memoRegex((k) => new RegExp(`^ {0,${k}}(?:<\\/?(?:${TAGLIST})(?: +|$|\\/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, 'i'));
O.blockquoteBeginRegex = memoRegex((k) => new RegExp(`^ {0,${k}}>`));

// ---------- block grammar, composed from shared fragments ----------

// Fragments for the "what can interrupt a paragraph / quote / table" lists.
const HR_INT = ' {0,3}((?:-[\\t ]*){3,}|(?:_[ \\t]*){3,}|(?:\\*[ \\t]*){3,})(?:\\n+|$)';
const HR_NC = ' {0,3}(?:(?:-[\\t ]*){3,}|(?:_[ \\t]*){3,}|(?:\\*[ \\t]*){3,})(?:\\n+|$)';
const HD_INT = ' {0,3}#{1,6}(?:\\s|$)';
const BQ_INT = ' {0,3}>';
const FN_INT = ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)';
const LI_INT = ' {0,3}(?:[*+-]|\\d{1,9}[.)])(?:[ \\t]|\\n|$)';
const LI1_INT = ' {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]';
const LI1B_INT = ' {0,3}(?:[*+-]|1[.)])[ \\t]';
const HTML_INT = ' {0,3}(?:<\\/?(?:' + TAGLIST + ')(?: +|\\n|\\/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)';
const BLANK_INT = '[ \\t]+\\n';
const CODE_INT = '(?: {4}| {0,3}	)[^\\n]';
const TBL_DELIM = '(?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?';
const TBL_ROW_INT = [' *\\n', HR_INT, HD_INT, BQ_INT, CODE_INT, FN_INT, LI1B_INT, HTML_INT].join('|');
const TBL_BRANCH = ' *([^\\n ].*)\\n {0,3}(' + TBL_DELIM + ')(?:\\n((?:(?!' + TBL_ROW_INT + ').*(?:\\n|$))*)\\n*|$)';
const INT_BQ = [HR_INT, HD_INT, BQ_INT, FN_INT, LI_INT, HTML_INT, BLANK_INT].join('|');
const INT_P = [HR_INT, HD_INT, BQ_INT, FN_INT, LI1_INT, HTML_INT, TBL_BRANCH, BLANK_INT].join('|');

const BLOCK = {
  newline: /^(?:[ \t]*(?:\n|$))+/,
  code: /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,
  fences: /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/,
  hr: /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,
  heading: /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,
  blockquote: new RegExp('^( {0,3}> ?(?:(?![ \\t]*(?:\\n|$))(([^\\n]+(?:\\n(?!' + INT_BQ + ')[^\\n]+)*))|[^\\n]*)(?:\\n|$))+'),
  list: /^( {0,3}(?:[*+-]|\d{1,9}[.)]))([ \t][^\n]*?)?(?:\n|$)/,
  html: new RegExp('^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:<\\/\\1>[^\\n]*\\n*|$)|<!--(?:-?>|[\\s\\S]*?(?:-->|$))[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|<\\/?(' + TAGLIST + ')(?:[ \\t]+|\\n|\\/?>|$)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?: +[a-zA-Z:_][\\w.:-]*(?: *= *"[^"\\n]*"| *= *\'[^\'\\n]*\'| *= *[^\\s"\'=<>`]+)?)*? *\\/?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<\\/[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))', 'i'),
  lheading: new RegExp('^(?!' + [' {0,3}(?:[*+-]|\\d{1,9}[.)]) ', '(?: {4}| {0,3}\\t)', ' {0,3}(?:`{3,}|~{3,})', ' {0,3}>', ' {0,3}#{1,6}(?:\\s|$)', ' {0,3}<[^\\n>]+>\\n', ' {0,3}\\|?(?:[:\\- ]*\\|)+[\\:\\- ]*\\n'].join('|') + ')((?:.|\\n(?!' + ['\\s*?\\n', ' {0,3}(?:[*+-]|\\d{1,9}[.)]) ', ' {0,3}(?:`{3,}|~{3,})', ' {0,3}>', ' {0,3}#{1,6}(?:\\s|$)', HR_NC, ' {0,3}<[^\\n>]+>\\n', ' {0,3}\\|?(?:[:\\- ]*\\|)+[\\:\\- ]*\\n'].join('|') + '))+?)\\n {0,3}(=+|-+)[ \\t]*(?:\\n+|$)'),
  def: /^ {0,3}\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)((?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))))? *(?:\n+|$)/,
  table: new RegExp('^ *([^\\n ].*)\\n {0,3}(' + TBL_DELIM + ')(?:\\n((?:(?!' + TBL_ROW_INT + ').*(?:\\n|$))*)\\n*|$)'),
  paragraph: new RegExp('^([^\\n]+(?:\\n(?!' + INT_P + ')[^\\n]+)*)'),
  text: /^[^\n]+/,
};

// ---------- inline grammar ----------

const INLINE = {
  escape: /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,
  tag: /^<!--(?:-?>|[\s\S]*?-->)|^<\/[a-zA-Z][a-zA-Z0-9-]*\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?)*?\s*\/?>|^<\?[\s\S]*?\?>|^<![a-zA-Z]+\s[\s\S]*?>|^<!\[CDATA\[[\s\S]*?\]\]>/,
  link: /^!?\[((?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?)\]\([ \t\n]*(<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\)))(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)))?[ \t\n]*\)/,
  reflink: /^!?\[((?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?)\]\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\]/,
  nolink: /^!?\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\](?:\[\])?/,
  emStrongLDelim: /^(?:\*+(?:((?!\*)(?!~)[\p{P}\p{S}])|([^\s*]))?)|^_+(?:((?!_)(?!~)[\p{P}\p{S}])|([^\s_]))?/u,
  emStrongRDelimAst: /^[^_*]*?__[^_*]*?\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?=[\s]|$)|(?:[^\s\p{P}\p{S}]|~)(\*+)(?!\*)(?=(?!~)[\s\p{P}\p{S}]|$)|(?!\*)(?!~)[\s\p{P}\p{S}](\*+)(?=(?:[^\s\p{P}\p{S}]|~))|[\s](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?:[^\s\p{P}\p{S}]|~)(\*+)(?=(?:[^\s\p{P}\p{S}]|~))/gu,
  emStrongRDelimUnd: /^[^_*]*?\*\*[^_*]*?_[^_*]*?(?=\*\*)|[^_]+(?=[^_])|(?!_)[\p{P}\p{S}](_+)(?=[\s]|$)|[^\s\p{P}\p{S}](_+)(?!_)(?=[\s\p{P}\p{S}]|$)|(?!_)[\s\p{P}\p{S}](_+)(?=[^\s\p{P}\p{S}])|[\s](_+)(?!_)(?=[\p{P}\p{S}])|(?!_)[\p{P}\p{S}](_+)(?!_)(?=[\p{P}\p{S}])/gu,
  code: /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,
  br: /^( {2,}|\\)\n(?!\s*$)[ \t]*/,
  del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,
  delLDelim: /^~~?(?:((?!~)[\p{P}\p{S}])|[^\s~])/u,
  delRDelim: /^[^~]+(?=[^~])|(?!~)[\p{P}\p{S}](~~?)(?=[\s]|$)|[^\s\p{P}\p{S}](~~?)(?!~)(?=[\s\p{P}\p{S}]|$)|(?!~)[\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])|[\s](~~?)(?!~)(?=[\p{P}\p{S}])|(?!~)[\p{P}\p{S}](~~?)(?!~)(?=[\p{P}\p{S}])|[^\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])/gu,
  autolink: /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s\x00-\x1f<>]*|[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_]))>/,
  url: /^(?:mailto:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])|xmpp:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])(?:\/[A-Za-z0-9@.]+)?)|^((?:[hH][tT][tT][pP][sS]?|[fF][tT][pP]):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/,
  text: /^(?:[^a-zA-Z0-9](?=(?:mailto|xmpp):)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|[hH][tT][tT][pP][sS]?|[fF][tT][pP]:\/\/|(?<![^\s*_~(])www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=(?:mailto|xmpp):)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/,
  punctuation: /^((?![*_])[\s\p{P}\p{S}])/u,
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  blockSkip: /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)|(?<!`)()(?<b>`+)[^`]+\k<b>(?!`)|<(?! )[^<>]*?>/g,
  reflinkSearch: /!?\[((?:[^\[\]\\`]*(?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?)\]\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\]|!?\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\](?:\[\])?(?!\()/g,
  anyPunctuation: /\\([\p{P}\p{S}])/gu,
  anyPunctuationOutsideCode: /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu,
};

// ---------- fences indent compensation ----------

function fenceText(raw, content, rules) {
  const m = raw.match(rules.other.indentCodeCompensation);
  if (m === null) return content;
  const indent = m[1];
  return content.split('\n').map((line) => {
    const lead = line.match(rules.other.beginningSpace);
    if (lead === null) return line;
    return line.slice(Math.min(lead[0].length, indent.length));
  }).join('\n');
}

// ---------- mask stack (emStrong / del closer lookup) ----------

const maskStacks = new WeakMap();

function maskPush(tokenizer, maskedSrc) {
  const entry = computeMask(maskedSrc);
  const stack = maskStacks.get(tokenizer);
  if (stack) stack.push(entry);
  else maskStacks.set(tokenizer, [entry]);
}

function maskPop(tokenizer) {
  const stack = maskStacks.get(tokenizer);
  if (stack) {
    stack.pop();
    if (stack.length === 0) maskStacks.delete(tokenizer);
  }
}

function maskEmStrong(tokenizer, src, delim) {
  const top = maskStacks.get(tokenizer)?.at(-1);
  if (top && top.maskedSrc === src) return top.lastPossibleEmStrongCloserIndex[delim];
  return computeMask(src).lastPossibleEmStrongCloserIndex[delim];
}

function maskDel(tokenizer, src) {
  const top = maskStacks.get(tokenizer)?.at(-1);
  if (top && top.maskedSrc === src) return top.lastPossibleDelCloserIndex;
  return computeMask(src).lastPossibleDelCloserIndex;
}

// ---------- link / image token creation (De) ----------

function makeLink(match, info, raw, lexer, rules) {
  const href = info.href;
  const title = info.title || null;
  const label = match[1].replace(rules.other.outputLinkReplace, '$1');
  const isImage = match[0].charAt(0) === '!';
  const prevInLink = lexer.state.inLink;
  const prevEmitted = lexer.state.linkEmitted;
  const prevRawBlock = lexer.state.inRawBlock;
  lexer.state.inLink = true;
  lexer.state.linkEmitted = false;
  const tokens = lexer.inlineTokens(label);
  const nestedLink = lexer.state.linkEmitted;
  lexer.state.linkEmitted = prevEmitted;
  lexer.state.inLink = prevInLink;
  if (!isImage) {
    if (nestedLink) {
      lexer.state.inRawBlock = prevRawBlock;
      return undefined;
    }
    lexer.state.linkEmitted = true;
  }
  return { type: isImage ? 'image' : 'link', raw, href, title, text: label, tokens };
}

// ---------- link-in-label check (Be) ----------

function hasLinkInLabel(src, label, offset, rules) {
  if (!label.includes('<')) return false;
  for (let i = 0; i < label.length; i++) {
    if (label[i] === '\\') { i++; continue; }
    if (label[i] === '`') {
      const code = rules.inline.code.exec(label.slice(i));
      if (code) { i += code[0].length - 1; continue; }
    }
    if (label[i] !== '<') continue;
    const rest = src.slice(offset + i);
    const tag = rules.inline.tag.exec(rest) || rules.inline.autolink.exec(rest);
    if (tag) {
      if (tag[0].length > label.length - i) return true;
      i += tag[0].length - 1;
    }
  }
  return false;
}

// ---------- Lexer ----------

class Lexer {
  constructor(options) {
    this.tokens = [];
    this.tokens.links = Object.create(null);
    this.options = options || {};
    this.state = { inLink: false, inRawBlock: false, linkEmitted: false, linkParenPossible: true, top: true };
    this.tokenizer = new Tokenizer(this);
    this.inlineQueue = [];
  }

  lex(src) {
    src = src.replace(O.carriageReturn, '\n');
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const entry = this.inlineQueue[i];
      this.state.inRawBlock = false;
      this.inlineTokens(entry.src, entry.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }

  blockTokens(src, tokens = [], merge = false) {
    this.tokenizer.lexer = this;
    let shortest = Infinity;
    for (; src;) {
      if (src.length < shortest) shortest = src.length;
      else { this.infiniteLoopError(src.charCodeAt(0)); break; }
      let tok;
      if ((tok = this.tokenizer.space(src))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        if (tok.raw.length === 1 && prev !== undefined) prev.raw += '\n';
        else tokens.push(tok);
        continue;
      }
      if ((tok = this.tokenizer.code(src))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        if (prev?.type === 'paragraph' || prev?.type === 'text') {
          prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          prev.text += '\n' + tok.text;
          this.inlineQueue.at(-1).src = prev.text;
        } else tokens.push(tok);
        continue;
      }
      if ((tok = this.tokenizer.fences(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.heading(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.hr(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.blockquote(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.list(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.html(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.def(src))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        if (prev?.type === 'paragraph' || prev?.type === 'text') {
          prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          prev.text += '\n' + tok.raw;
          this.inlineQueue.at(-1).src = prev.text;
        } else {
          if (!this.tokens.links[tok.tag]) this.tokens.links[tok.tag] = { href: tok.href, title: tok.title };
          tokens.push(tok);
        }
        continue;
      }
      if ((tok = this.tokenizer.table(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.lheading(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if (this.state.top && (tok = this.tokenizer.paragraph(src))) {
        const prev = tokens.at(-1);
        if (merge && prev?.type === 'paragraph') {
          prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          prev.text += '\n' + tok.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = prev.text;
        } else tokens.push(tok);
        merge = false;
        src = src.substring(tok.raw.length);
        continue;
      }
      if ((tok = this.tokenizer.text(src))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        if (prev?.type === 'text') {
          prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          prev.text += '\n' + tok.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = prev.text;
        } else tokens.push(tok);
        continue;
      }
      if (src) { this.infiniteLoopError(src.charCodeAt(0)); break; }
    }
    this.state.top = true;
    return tokens;
  }

  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }

  linkInText(src) {
    if (!src.includes('[')) return false;
    const linkRe = this.tokenizer.rules.inline.link;
    for (const m of src.matchAll(this.tokenizer.rules.inline.blockSkip)) {
      if (linkRe.test(m[0]) && src.charAt(m.index - 1) !== '!') return true;
    }
    for (const m of src.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
      const s = m[0];
      const r = s.lastIndexOf('[');
      if (!(s.charAt(0) === '!' || !Object.hasOwn(this.tokens.links, normLabel(s.slice(r + 1, -1)))) && !(r > 1 && this.linkInText(s.slice(1, r - 1)))) return true;
    }
    return false;
  }

  inlineTokens(src, tokens = []) {
    this.tokenizer.lexer = this;
    const prev = this.state.linkParenPossible;
    this.state.linkParenPossible = prev && src.includes(')');
    try {
      return this.inlineLoop(src, tokens);
    } finally {
      this.state.linkParenPossible = prev;
    }
  }

  inlineLoop(src, tokens) {
    const masked = (src.includes('*') || src.includes('_') || src.includes('~')) ? this.maskSrc(src) : src;
    maskPush(this.tokenizer, masked);
    try {
      return this.inlineScan(src, masked, tokens);
    } finally {
      maskPop(this.tokenizer);
    }
  }

  maskSrc(src) {
    let t = src;
    if (this.tokens.links && src.includes('[')) {
      const search = this.tokenizer.rules.inline.reflinkSearch;
      const replaceOne = (m) => {
        const o = m.lastIndexOf('[');
        if (!Object.hasOwn(this.tokens.links, normLabel(m.slice(o + 1, -1)))) return m;
        if (o > 1 && m.charAt(0) !== '!') {
          const inner = m.slice(1, o - 1);
          if (this.linkInText(inner)) return '[' + inner.replace(search, replaceOne) + '][' + 'a'.repeat(m.length - o - 2) + ']';
        }
        return '[' + 'a'.repeat(m.length - 2) + ']';
      };
      t = t.replace(search, replaceOne);
    }
    t = t.replace(this.tokenizer.rules.inline.anyPunctuationOutsideCode, (m, code, punct) => {
      if (punct) return '+'.repeat(m.length);
      if (code) return code + m.slice(code.length, -code.length).replace(/`/g, '+') + code;
      return m;
    });
    t = t.replace(this.tokenizer.rules.inline.blockSkip, (m, code, backticks) => {
      const lead = backticks ? backticks.length : 0;
      return m.slice(0, lead) + '[' + 'a'.repeat(m.length - lead - 2) + ']';
    });
    return t;
  }

  inlineScan(src, masked, tokens) {
    let lastChar = '';
    let lastWasText = false;
    let shortest = Infinity;
    for (; src;) {
      if (src.length < shortest) shortest = src.length;
      else { this.infiniteLoopError(src.charCodeAt(0)); break; }
      if (!lastWasText) lastChar = '';
      lastWasText = false;
      let tok;
      if ((tok = this.tokenizer.escape(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.tag(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.link(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.reflink(src, this.tokens.links))) {
        src = src.substring(tok.raw.length);
        const prev = tokens.at(-1);
        if (tok.type === 'text' && prev?.type === 'text') { prev.raw += tok.raw; prev.text += tok.text; }
        else tokens.push(tok);
        continue;
      }
      if ((tok = this.tokenizer.emStrong(src, masked, lastChar))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.codespan(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.br(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.del(src, masked, lastChar))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.autolink(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if (!this.state.inLink && (tok = this.tokenizer.url(src))) { src = src.substring(tok.raw.length); tokens.push(tok); continue; }
      if ((tok = this.tokenizer.inlineText(src))) {
        src = src.substring(tok.raw.length);
        if (tok.raw.slice(-1) !== '_') lastChar = tok.raw.slice(-1);
        lastWasText = true;
        const prev = tokens.at(-1);
        if (prev?.type === 'text') { prev.raw += tok.raw; prev.text += tok.text; }
        else tokens.push(tok);
        continue;
      }
      if (src) { this.infiniteLoopError(src.charCodeAt(0)); break; }
    }
    return tokens;
  }

  infiniteLoopError(byte) {
    const msg = 'Infinite loop on byte: ' + byte;
    if (this.options.silent) console.error(msg);
    else throw new Error(msg);
  }
}

// ---------- Tokenizer (block) ----------

class Tokenizer {
  constructor(lexer) {
    this.lexer = lexer;
    this.options = lexer.options;
    this.rules = { block: BLOCK, inline: INLINE, other: O };
  }

  space(src) {
    const m = this.rules.block.newline.exec(src);
    if (m && m[0].length > 0) return { type: 'space', raw: m[0] };
  }

  code(src) {
    const m = this.rules.block.code.exec(src);
    if (m) {
      const raw = this.options.pedantic ? m[0] : trimBlankTail(m[0]);
      const text = raw.replace(this.rules.other.codeRemoveIndent, '');
      return { type: 'code', raw, codeBlockStyle: 'indented', text };
    }
  }

  fences(src) {
    const m = this.rules.block.fences.exec(src);
    if (m) {
      const raw = m[0];
      const text = fenceText(raw, m[3] || '', this.rules);
      return { type: 'code', raw, lang: m[2] ? m[2].trim().replace(this.rules.inline.anyPunctuation, '$1') : m[2], text };
    }
  }

  heading(src) {
    const m = this.rules.block.heading.exec(src);
    if (m) {
      let text = m[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const stripped = rtrimEnd(text, '#');
        if (this.options.pedantic || !stripped || this.rules.other.endingSpaceTabChar.test(stripped)) text = stripped.trim();
      }
      return { type: 'heading', raw: rtrimEnd(m[0], '\n'), depth: m[1].length, text, tokens: this.lexer.inline(text) };
    }
  }

  hr(src) {
    const m = this.rules.block.hr.exec(src);
    if (m) return { type: 'hr', raw: rtrimEnd(m[0], '\n') };
  }

  blockquote(src) {
    const m = this.rules.block.blockquote.exec(src);
    if (!m) return;
    let lines = rtrimEnd(m[0], '\n').split('\n');
    let raw = '';
    let text = '';
    const tokens = [];
    for (; lines.length > 0;) {
      let hasQuote = false;
      const chunk = [];
      let p;
      for (p = 0; p < lines.length; p++) {
        if (this.rules.other.blockquoteStart.test(lines[p])) { chunk.push(lines[p]); hasQuote = true; }
        else if (!hasQuote) chunk.push(lines[p]);
        else break;
      }
      lines = lines.slice(p);
      const joined = chunk.join('\n');
      const stripped = joined
        .replace(this.rules.other.blockquoteMarkerWhitespace, (g, b, ws) => b + expandTabs(ws, b.length))
        .replace(this.rules.other.blockquoteSetextReplace, '\n    $1')
        .replace(this.rules.other.blockquoteSetextReplace2, '');
      raw = raw ? raw + '\n' + joined : joined;
      text = text ? text + '\n' + stripped : stripped;
      const prevTop = this.lexer.state.top;
      this.lexer.state.top = true;
      this.lexer.blockTokens(stripped, tokens, true);
      this.lexer.state.top = prevTop;
      if (lines.length === 0) break;
      const last = tokens.at(-1);
      if (last?.type === 'code' || last?.type === 'heading' || last?.type === 'hr' || last?.type === 'html' || last?.type === 'table') break;
      if (last?.type === 'blockquote') {
        const inner = last;
        const rest = lines.join('\n');
        const combined = inner.raw + '\n' + rest.replace(this.rules.other.blockquoteSetextReplace2, '');
        const reparsed = this.blockquote(combined);
        tokens[tokens.length - 1] = reparsed;
        const leftover = combined.substring(reparsed.raw.length).replace(/^\n/, '');
        const leftLines = leftover ? leftover.split('\n').length : 0;
        const consumed = leftLines ? lines.slice(0, -leftLines) : lines;
        if (consumed.length > 0) raw = raw + '\n' + consumed.join('\n');
        text = text.substring(0, text.length - inner.text.length) + reparsed.text;
        lines = lines.slice(consumed.length);
        if (lines.length > 0 && this.rules.other.blockquoteStart.test(lines[0])) continue;
        break;
      } else if (last?.type === 'list') {
        const inner = last;
        const combined = inner.raw + '\n' + lines.join('\n');
        const reparsed = this.list(combined);
        tokens[tokens.length - 1] = reparsed;
        const extra = reparsed.raw.length > inner.raw.length ? combined.slice(inner.raw.length + 1, reparsed.raw.length).split('\n').length : 0;
        if (extra > 0) {
          const taken = lines.slice(0, extra).join('\n');
          raw = raw + '\n' + taken;
          text = text + '\n' + taken;
        }
        lines = lines.slice(extra);
        continue;
      }
    }
    return { type: 'blockquote', raw, tokens, text };
  }

  list(src) {
    const cap = this.rules.block.list.exec(src);
    if (!cap) return;
    const original = src;
    const consumed = () => original.length - src.length;
    let bull = cap[1].trim();
    const ordered = bull.length > 1;
    const listTok = { type: 'list', raw: '', ordered, start: ordered ? +bull.slice(0, -1) : '', loose: false, items: [] };
    bull = ordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
    if (this.options.pedantic) bull = ordered ? bull : '[*+-]';
    const itemRe = this.rules.other.listItemRegex(bull);
    let sawDoubleBlank = false;
    for (; src;) {
      let blankItem = false;
      let content = '';
      const t = itemRe.exec(src);
      if (!t || this.rules.block.hr.test(src)) break;
      const startPos = consumed();
      src = src.substring(t[0].length);
      const firstLine = t[2].split('\n', 1)[0];
      const markerLen = t[1].length;
      let expanded = this.options.pedantic ? expandTabs(firstLine, markerLen) : firstLine.replace(this.rules.other.leadingSpaceTab, (v) => expandTabs(v, markerLen));
      const nextLine = src.split('\n', 1)[0];
      let isBlank = !expanded.trim();
      let indentWidth = 0;
      if (this.options.pedantic) { indentWidth = 2; content = expanded.trimStart(); }
      else if (isBlank) indentWidth = markerLen + 1;
      else {
        indentWidth = expanded.search(this.rules.other.nonSpaceChar);
        if (indentWidth > 4) indentWidth = 1;
        content = expanded.slice(indentWidth);
        indentWidth += markerLen;
      }
      if (isBlank && this.rules.other.blankLine.test(nextLine)) {
        src = src.substring(nextLine.length + 1);
        blankItem = true;
      }
      if (!blankItem) {
        const nextBullet = this.rules.other.nextBulletRegex(indentWidth);
        const hrRe = this.rules.other.hrRegex(indentWidth);
        const fencesRe = this.rules.other.fencesBeginRegex(indentWidth);
        const headingRe = this.options.pedantic ? this.rules.other.pedanticHeadingBeginRegex(indentWidth) : this.rules.other.headingBeginRegex(indentWidth);
        const htmlRe = this.rules.other.htmlBeginRegex(indentWidth);
        const bqRe = this.rules.other.blockquoteBeginRegex(indentWidth);
        for (; src;) {
          const line = src.split('\n', 1)[0];
          let check = line;
          let expandedLine;
          if (this.options.pedantic) {
            check = check.replace(this.rules.other.listReplaceNesting, '  ');
            expandedLine = check;
          } else {
            expandedLine = check.replace(this.rules.other.leadingSpaceTab, (v) => expandTabs(v));
          }
          if (fencesRe.test(check) || headingRe.test(check) || htmlRe.test(check) || bqRe.test(check) || nextBullet.test(check) || hrRe.test(check)) break;
          if (expandedLine.search(this.rules.other.nonSpaceChar) >= indentWidth || !check.trim()) {
            content += '\n' + expandedLine.slice(indentWidth);
          } else {
            if (isBlank || expanded.replace(this.rules.other.tabCharGlobal, '    ').search(this.rules.other.nonSpaceChar) >= 4 || fencesRe.test(expanded) || headingRe.test(expanded) || htmlRe.test(expanded) || hrRe.test(expanded)) break;
            const setext = !this.options.pedantic && /^ {0,3}(?:=+|-+) *$/.test(check) && this.rules.block.lheading.test(`${expanded}\n${check}`) ? `    ${expandedLine.replace(/^ {0,3}/, '')}` : check;
            content += '\n' + setext;
          }
          isBlank = !check.trim();
          src = src.substring(line.length + 1);
          expanded = expandedLine.slice(indentWidth);
        }
      }
      const itemRaw = original.slice(startPos, consumed());
      if (!listTok.loose) {
        if (sawDoubleBlank) listTok.loose = true;
        else if (this.rules.other.doubleBlankLine.test(itemRaw)) sawDoubleBlank = true;
      }
      listTok.items.push({ type: 'list_item', raw: itemRaw, task: !!this.options.gfm && this.rules.other.listIsTask.test(content), loose: false, text: content, tokens: [] });
    }
    const lastItem = listTok.items.at(-1);
    if (!lastItem) return;
    lastItem.raw = lastItem.raw.trimEnd();
    lastItem.text = lastItem.text.trimEnd();
    listTok.raw = original.slice(0, consumed()).trimEnd();
    for (const item of listTok.items) {
      this.lexer.state.top = false;
      item.tokens = this.lexer.blockTokens(item.text, []);
      if (!listTok.loose) {
        const spaces = item.tokens.filter((g) => g.type === 'space');
        if (spaces.length > 0 && spaces.some((g) => this.rules.other.anyLine.test(g.raw))) listTok.loose = true;
      }
    }
    for (const item of listTok.items) {
      const first = item.tokens[0];
      if (item.task && (first?.type === 'text' || first?.type === 'paragraph')) {
        item.text = item.text.replace(this.rules.other.listReplaceTask, '');
        first.raw = first.raw.replace(this.rules.other.listReplaceTask, '');
        first.text = first.text.replace(this.rules.other.listReplaceTask, '');
        for (let g = this.lexer.inlineQueue.length - 1; g >= 0; g--) {
          if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[g].src)) {
            this.lexer.inlineQueue[g].src = this.lexer.inlineQueue[g].src.replace(this.rules.other.listReplaceTask, '');
            break;
          }
        }
        const cb = this.rules.other.listTaskCheckbox.exec(item.raw);
        if (cb) {
          const box = { type: 'checkbox', raw: cb[0] + ' ', checked: cb[0] !== '[ ]' };
          item.checked = box.checked;
          if (listTok.loose && item.tokens[0] && ['paragraph', 'text'].includes(item.tokens[0].type) && 'tokens' in item.tokens[0]) {
            item.tokens[0].raw = box.raw + item.tokens[0].raw;
            item.tokens[0].text = box.raw + item.tokens[0].text;
            item.tokens[0].tokens.unshift(box);
          } else if (listTok.loose) {
            item.tokens.unshift({ type: 'paragraph', raw: box.raw, text: box.raw, tokens: [box] });
          } else {
            item.tokens.unshift(box);
          }
        }
      } else if (item.task) {
        item.task = false;
      }
    }
    if (listTok.loose) {
      for (const item of listTok.items) {
        item.loose = true;
        for (const tok of item.tokens) if (tok.type === 'text') tok.type = 'paragraph';
      }
    }
    return listTok;
  }

  html(src) {
    const m = this.rules.block.html.exec(src);
    if (m) {
      const text = trimBlankTail(m[0]);
      return { type: 'html', block: true, raw: text, pre: m[1] === 'pre' || m[1] === 'script' || m[1] === 'style', text };
    }
  }

  def(src) {
    const m = this.rules.block.def.exec(src);
    if (m) {
      if (!this.rules.other.startAngleBracket.test(m[2]) && findClose(m[2], '()') !== -1) return;
      const tag = normLabel(m[1]);
      const href = m[2] ? m[2].replace(this.rules.other.hrefBrackets, '$1').replace(this.rules.inline.anyPunctuation, '$1') : '';
      const title = m[3] ? m[3].substring(1, m[3].length - 1).replace(this.rules.inline.anyPunctuation, '$1') : m[3];
      return { type: 'def', tag, raw: rtrimEnd(m[0], '\n'), href, title };
    }
  }

  table(src) {
    const m = this.rules.block.table.exec(src);
    if (!m || !this.rules.other.tableDelimiter.test(m[2])) return;
    const headerCells = splitCells(m[1]);
    const alignParts = m[2].replace(this.rules.other.tableAlignChars, '').split('|');
    const rowLines = m[3]?.trim() ? m[3].replace(this.rules.other.tableRowBlankLine, '').split('\n') : [];
    const out = { type: 'table', raw: rtrimEnd(m[0], '\n'), header: [], align: [], rows: [] };
    if (headerCells.length === alignParts.length) {
      for (const part of alignParts) {
        if (this.rules.other.tableAlignRight.test(part)) out.align.push('right');
        else if (this.rules.other.tableAlignCenter.test(part)) out.align.push('center');
        else if (this.rules.other.tableAlignLeft.test(part)) out.align.push('left');
        else out.align.push(null);
      }
      for (let i = 0; i < headerCells.length; i++) {
        out.header.push({ text: headerCells[i], tokens: this.lexer.inline(headerCells[i]), header: true, align: out.align[i] });
      }
      for (const line of rowLines) {
        out.rows.push(splitCells(line, out.header.length).map((cell, p) => ({ text: cell, tokens: this.lexer.inline(cell), header: false, align: out.align[p] })));
      }
      return out;
    }
  }

  lheading(src) {
    const m = this.rules.block.lheading.exec(src);
    if (m) {
      const text = m[1].trim();
      return { type: 'heading', raw: rtrimEnd(m[0], '\n'), depth: m[2].charAt(0) === '=' ? 1 : 2, text, tokens: this.lexer.inline(text) };
    }
  }

  paragraph(src) {
    const m = this.rules.block.paragraph.exec(src);
    if (m) {
      const text = m[1].charAt(m[1].length - 1) === '\n' ? m[1].slice(0, -1) : m[1];
      return { type: 'paragraph', raw: m[0], text, tokens: this.lexer.inline(text) };
    }
  }

  text(src) {
    const m = this.rules.block.text.exec(src);
    if (m) return { type: 'text', raw: m[0], text: m[0], tokens: this.lexer.inline(m[0]) };
  }

  escape(src) {
    const m = this.rules.inline.escape.exec(src);
    if (m) return { type: 'escape', raw: m[0], text: m[1] };
  }

  tag(src) {
    const m = this.rules.inline.tag.exec(src);
    if (m) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(m[0])) this.lexer.state.inLink = true;
      else if (this.lexer.state.inLink && this.rules.other.endATag.test(m[0])) this.lexer.state.inLink = false;
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(m[0])) this.lexer.state.inRawBlock = true;
      else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(m[0])) this.lexer.state.inRawBlock = false;
      return { type: 'html', raw: m[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: m[0] };
    }
  }

  link(src) {
    if (this.lexer.state.linkParenPossible === false) return;
    const m = this.rules.inline.link.exec(src);
    if (m) {
      const offset = m[0].charAt(0) === '!' ? 2 : 1;
      if (!this.options.pedantic && hasLinkInLabel(src, m[1], offset, this.rules)) return;
      const dest = m[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(dest)) {
        if (!this.rules.other.endAngleBracket.test(dest)) return;
        const stripped = rtrimEnd(dest.slice(0, -1), '\\');
        if ((dest.length - stripped.length) % 2 === 0) return;
      } else {
        const close = findClose(m[2], '()');
        if (close === -2) return;
        if (close > -1) {
          const cut = (m[0].indexOf('!') === 0 ? 5 : 4) + m[1].length + close;
          m[2] = m[2].substring(0, close);
          m[0] = m[0].substring(0, cut).trim();
          m[3] = '';
        }
      }
      const rawStripped = rtrimEnd(m[0].slice(0, -1), '\\');
      if ((m[0].length - rawStripped.length) % 2 === 0) return;
      let href = m[2];
      let title = '';
      if (this.options.pedantic) {
        const pt = this.rules.other.pedanticHrefTitle.exec(href);
        if (pt) { href = pt[1]; title = pt[3]; }
      } else {
        title = m[3] ? m[3].slice(1, -1) : '';
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(dest)) href = href.slice(1);
        else href = href.slice(1, -1);
      }
      return makeLink(m, { href: href && href.replace(this.rules.inline.anyPunctuation, '$1'), title: title && title.replace(this.rules.inline.anyPunctuation, '$1') }, m[0], this.lexer, this.rules);
    }
  }

  reflink(src, links) {
    const m = this.rules.inline.reflink.exec(src) || this.rules.inline.nolink.exec(src);
    if (m) {
      const offset = m[0].charAt(0) === '!' ? 2 : 1;
      if (!this.options.pedantic && hasLinkInLabel(src, m[1], offset, this.rules)) return;
      const ref = links[normLabel(m[2] || m[1])];
      if (!ref) {
        const ch = m[0].charAt(0);
        return { type: 'text', raw: ch, text: ch };
      }
      return makeLink(m, ref, m[0], this.lexer, this.rules);
    }
  }

  emStrong(src, masked, prevChar = '') {
    const m = this.rules.inline.emStrongLDelim.exec(src);
    if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return;
    const delim = m[0][0];
    const prevIsDelim = prevChar === delim;
    const start = masked.length - src.length;
    let l = start;
    for (; !this.options.pedantic && l > 0 && masked[l - 1] === delim;) l--;
    const before = [...masked.slice(Math.max(0, l - 2), l)].at(-1) ?? '';
    const beforeIsPunct = before === '*' || before === '_' || !!this.rules.inline.punctuation.exec(before);
    if (l < start) prevChar = before;
    const leftFlanking = l < start ? beforeIsPunct : !!this.rules.inline.punctuation.exec(prevChar);
    if (m[4] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const opener = m[1] || m[3] || '';
    if (!opener || !prevChar || leftFlanking) {
      const runLen = [...m[0]].length - 1;
      let min = runLen;
      let extra = 0;
      const y = start - l + runLen;
      const ruleOf3 = !this.options.pedantic && !!before.trim() && (!!opener || (delim === '*' && !beforeIsPunct));
      if (delim !== '*' && delim !== '_') return;
      const closerRe = delim === '*' ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      const maxCloser = maskEmStrong(this, masked, delim);
      const base = start + runLen;
      if (maxCloser < base) return;
      const rest = masked.slice(-1 * src.length + runLen);
      const limit = maxCloser - base;
      let cm;
      for (closerRe.lastIndex = 0; (cm = closerRe.exec(rest)) !== null && !(cm.index > limit);) {
        const g = cm[1] || cm[2] || cm[3] || cm[4] || cm[5] || cm[6];
        if (!g) continue;
        const b = [...g].length;
        if (cm[3] || cm[4]) { min += b; continue; }
        else if (cm[5] || cm[6] || ruleOf3) {
          if (prevIsDelim && (cm[5] || cm[6])) break;
          if (y % 3 && !((y + b) % 3)) { extra += b; continue; }
        }
        min -= b;
        if (min > 0) continue;
        const blen = Math.min(b, b + min + extra);
        const firstLen = [...cm[0]][0].length;
        const raw = src.slice(0, runLen + cm.index + firstLen + blen);
        if (Math.min(runLen, blen) % 2) {
          const inner = raw.slice(1, -1);
          return { type: 'em', raw, text: inner, tokens: this.lexer.inlineTokens(inner) };
        }
        const inner = raw.slice(2, -2);
        return { type: 'strong', raw, text: inner, tokens: this.lexer.inlineTokens(inner) };
      }
    }
  }

  codespan(src) {
    const m = this.rules.inline.code.exec(src);
    if (m) {
      let text = m[2].replace(this.rules.other.newLineCharGlobal, ' ');
      const hasNonSpace = this.rules.other.nonSpaceChar.test(text);
      const wrapped = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpace && wrapped) text = text.substring(1, text.length - 1);
      return { type: 'codespan', raw: m[0], text };
    }
  }

  br(src) {
    const m = this.rules.inline.br.exec(src);
    if (m) return { type: 'br', raw: m[0] };
  }

  del(src, masked, prevChar = '') {
    const m = this.rules.inline.delLDelim.exec(src);
    if (!m) return;
    if (!(m[1] || '') || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const runLen = [...m[0]].length - 1;
      let p = runLen;
      const closerRe = this.rules.inline.delRDelim;
      const maxCloser = maskDel(this, masked);
      const base = masked.length - src.length + runLen;
      if (maxCloser < base) return;
      const rest = masked.slice(-1 * src.length + runLen);
      const limit = maxCloser - base;
      let cm;
      for (closerRe.lastIndex = 0; (cm = closerRe.exec(rest)) !== null && !(cm.index > limit);) {
        const g = cm[1] || cm[2] || cm[3] || cm[4] || cm[5] || cm[6];
        if (!g) continue;
        const blen0 = [...g].length;
        if (blen0 !== runLen) continue;
        if (cm[3] || cm[4]) { p += blen0; continue; }
        p -= blen0;
        if (p > 0) continue;
        const blen = Math.min(blen0, blen0 + p);
        const firstLen = [...cm[0]][0].length;
        const raw = src.slice(0, runLen + cm.index + firstLen + blen);
        const inner = raw.slice(runLen, -runLen);
        return { type: 'del', raw, text: inner, tokens: this.lexer.inlineTokens(inner) };
      }
    }
  }

  autolink(src) {
    const m = this.rules.inline.autolink.exec(src);
    if (m) {
      let text, href;
      if (m[2] === '@') { text = m[1]; href = 'mailto:' + text; }
      else { text = m[1]; href = text; }
      return { type: 'link', raw: m[0], text, href, autolink: true, tokens: [{ type: 'text', raw: text, text }] };
    }
  }

  url(src) {
    const m = this.rules.inline.url.exec(src);
    if (m) {
      let text, href;
      if (m[2] === '@') { text = m[0]; href = 'mailto:' + text; }
      else {
        let prev;
        do { prev = m[0]; m[0] = this.rules.inline._backpedal.exec(m[0])?.[0] ?? ''; } while (prev !== m[0]);
        text = m[0];
        href = m[1] === 'www.' ? 'http://' + m[0] : m[0];
      }
      return { type: 'link', raw: m[0], text, href, autolink: true, tokens: [{ type: 'text', raw: text, text }] };
    }
  }

  inlineText(src) {
    const m = this.rules.inline.text.exec(src);
    if (m) {
      const inRaw = this.lexer.state.inRawBlock;
      return { type: 'text', raw: m[0], text: inRaw ? m[0] : unesc(m[0]), escaped: inRaw };
    }
  }

}

// ---------- Parser ----------

class Parser {
  constructor(options) {
    this.options = options || {};
    this.renderer = new Renderer();
    this.renderer.parser = this;
    this.textRenderer = new TextRenderer();
    this.textRenderer.parser = this;
  }

  parse(tokens) {
    this.renderer.parser = this;
    let out = '';
    for (const token of tokens) {
      let html = '';
      switch (token.type) {
        case 'space': html = this.renderer.space(token); break;
        case 'hr': html = this.renderer.hr(token); break;
        case 'heading': html = this.renderer.heading(token); break;
        case 'code': html = this.renderer.code(token); break;
        case 'table': html = this.renderer.table(token); break;
        case 'blockquote': html = this.renderer.blockquote(token); break;
        case 'list': html = this.renderer.list(token); break;
        case 'checkbox': html = this.renderer.checkbox(token); break;
        case 'html': html = this.renderer.html(token); break;
        case 'def': html = this.renderer.def(token); break;
        case 'paragraph': html = this.renderer.paragraph(token); break;
        case 'text': html = this.renderer.text(token); break;
        default: {
          const msg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) { console.error(msg); html = ''; }
          else throw new Error(msg);
        }
      }
      out += html;
    }
    return out;
  }

  parseInline(tokens, renderer) {
    const r = renderer || this.renderer;
    r.parser = this;
    let out = '';
    for (const token of tokens) {
      let html = '';
      switch (token.type) {
        case 'escape': html = r.text(token); break;
        case 'html': html = r.html(token); break;
        case 'link': html = r.link(token); break;
        case 'image': html = r.image(token); break;
        case 'checkbox': html = r.checkbox(token); break;
        case 'strong': html = r.strong(token); break;
        case 'em': html = r.em(token); break;
        case 'codespan': html = r.codespan(token); break;
        case 'br': html = r.br(token); break;
        case 'del': html = r.del(token); break;
        case 'text': html = r.text(token); break;
        default: {
          const msg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) { console.error(msg); html = ''; }
          else throw new Error(msg);
        }
      }
      out += html;
    }
    return out;
  }
}

// ---------- Renderer ----------

class Renderer {
  space() { return ''; }

  code({ text, lang, escaped }) {
    const langName = (lang || '').match(O.notSpaceStart)?.[0];
    const body = text ? text.replace(O.endingNewline, '') + '\n' : '';
    const inner = escaped ? body : escHtml(body, true);
    if (langName) return '<pre><code class="language-' + escHtml(langName) + '">' + inner + '</code></pre>\n';
    return '<pre><code>' + inner + '</code></pre>\n';
  }

  blockquote({ tokens }) {
    return '<blockquote>\n' + this.parser.parse(tokens) + '</blockquote>\n';
  }

  html({ text }) { return text; }

  def() { return ''; }

  heading({ tokens, depth }) {
    return '<h' + depth + '>' + this.parser.parseInline(tokens) + '</h' + depth + '>\n';
  }

  hr() { return '<hr>\n'; }

  list({ ordered, start, items }) {
    let body = '';
    for (const item of items) body += this.listitem(item);
    const tag = ordered ? 'ol' : 'ul';
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : '';
    return '<' + tag + startAttr + '>\n' + body + '</' + tag + '>\n';
  }

  listitem({ tokens }) {
    return '<li>' + this.parser.parse(tokens) + '</li>\n';
  }

  checkbox({ checked }) {
    return '<input ' + (checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> ';
  }

  paragraph({ tokens }) {
    return '<p>' + this.parser.parseInline(tokens) + '</p>\n';
  }

  table({ header, rows }) {
    let headHtml = '';
    for (const cell of header) headHtml += this.tablecell(cell);
    const headRow = this.tablerow({ text: headHtml });
    let bodyHtml = '';
    for (const row of rows) {
      let rowHtml = '';
      for (const cell of row) rowHtml += this.tablecell(cell);
      bodyHtml += this.tablerow({ text: rowHtml });
    }
    if (bodyHtml) bodyHtml = '<tbody>' + bodyHtml + '</tbody>';
    return '<table>\n<thead>\n' + headRow + '</thead>\n' + bodyHtml + '</table>\n';
  }

  tablerow({ text }) {
    return '<tr>\n' + text + '</tr>\n';
  }

  tablecell({ tokens, header, align }) {
    const tag = header ? 'th' : 'td';
    const open = align ? '<' + tag + ' align="' + align + '">' : '<' + tag + '>';
    return open + this.parser.parseInline(tokens) + '</' + tag + '>\n';
  }

  strong({ tokens }) {
    return '<strong>' + this.parser.parseInline(tokens) + '</strong>';
  }

  em({ tokens }) {
    return '<em>' + this.parser.parseInline(tokens) + '</em>';
  }

  codespan({ text }) {
    return '<code>' + escHtml(text, true) + '</code>';
  }

  br() { return '<br>'; }

  del({ tokens }) {
    return '<del>' + this.parser.parseInline(tokens) + '</del>';
  }

  link({ href, title, text, tokens, autolink }) {
    const label = autolink ? escHtml(text, true) : this.parser.parseInline(tokens);
    const cleaned = cleanHref(href);
    if (cleaned === null) return label;
    const url = escHtml(cleaned, autolink);
    let out = '<a href="' + url + '"';
    if (title) out += ' title="' + escHtml(title) + '"';
    out += '>' + label + '</a>';
    return out;
  }

  image({ href, title, text, tokens }) {
    if (tokens) text = this.parser.parseInline(tokens, this.parser.textRenderer);
    const cleaned = cleanHref(href);
    if (cleaned === null) return escHtml(text);
    let out = '<img src="' + escHtml(cleaned) + '" alt="' + escHtml(text) + '"';
    if (title) out += ' title="' + escHtml(title) + '"';
    out += '>';
    return out;
  }

  text(token) {
    if ('tokens' in token && token.tokens) return this.parser.parseInline(token.tokens);
    if ('escaped' in token && token.escaped) return token.text;
    return escHtml(token.text);
  }
}

// ---------- TextRenderer (plain text, for image alt) ----------

class TextRenderer {
  strong({ tokens, text }) {
    return tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text;
  }

  em({ tokens, text }) {
    return tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text;
  }

  codespan({ text }) { return text; }

  del({ tokens, text }) {
    return tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text;
  }

  html({ text }) { return text; }

  text({ text }) { return text; }

  link({ tokens, text }) {
    return tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text;
  }

  image({ tokens, text }) {
    return tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text;
  }

  br() { return ''; }

  checkbox(token) { return token.raw || ''; }
}

// ---------- public entry point ----------

export function parse(src, options) {
  const opts = { gfm: true, breaks: false, pedantic: false, async: false, silent: false, ...(options || {}) };
  const lexer = new Lexer(opts);
  const tokens = lexer.lex(src);
  const parser = new Parser(opts);
  return parser.parse(tokens);
}

export { Lexer, Parser, Renderer, Tokenizer };
