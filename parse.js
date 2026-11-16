// A fast drop-in for marked 18.1.3: parse(markdown) returns exactly the HTML
// marked renders with its default options (GFM on). Single-pass design:
// one block pass collects blocks and link definitions, one inline pass
// renders each block's inline content straight to HTML. No token tree.
//
// Written from the CommonMark 0.31.2 / GFM 0.29 specifications and the
// observed behaviour of the reference renderer, with its edge cases
// (container tabs, list looseness, emphasis masking) re-derived here.

/* ------------------------------------------------------------------ */
/* small shared patterns                                               */
/* ------------------------------------------------------------------ */

const RX = {
  codeIndentStrip: /^(?: {0,3}\t| {1,4})/gm,
  linkBracketUnescape: /\\([\[\]])/g,
  fenceIndent: /^(\s+)(?:```)/,
  leadSpace: /^\s+/,
  hashEnd: /#$/,
  spaceStart: /^ /,
  spaceEnd: / $/,
  spaceTabEnd: /[ \t]$/,
  nonSpace: /[^ ]/,
  newlineG: /\n/g,
  tabG: /\t/g,
  leadSpaceTab: /^[ \t]+/,
  multiSpaceG: /\s+/g,
  blank: /^[ \t]*$/,
  doubleBlank: /\n[ \t]*\n[ \t]*$/,
  quoteStart: /^ {0,3}>/,
  quoteSetext: /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g,
  quoteMarker: /^ {0,3}>[ \t]?/gm,
  quoteMarkerWs: /^( {0,3}>)([ \t]+)/gm,
  listNest: /^ {1,4}(?=( {4})*[^ ])/g,
  taskItem: /^\[[ xX]\][ \t]+\S/,
  taskStrip: /^\[[ xX]\][ \t]+/,
  taskBox: /\[[ xX]\]/,
  setextLine: /^ {0,3}(?:=+|-+) *$/,
  anyLine: /\n.*\n/,
  angleHref: /^<(.*)>$/,
  tableDelim: /[:|]/,
  tableEdge: /^\||\| *$/g,
  tableRowBlank: /\n[ \t]*$/,
  alignRight: /^ *-+: *$/,
  alignCenter: /^ *:-+: *$/,
  alignLeft: /^ *:-+ *$/,
  openAnchor: /^<a /i,
  closeAnchor: /^<\/a>/i,
  openPre: /^<(pre|code|kbd|script)(\s|>)/i,
  closePre: /^<\/(pre|code|kbd|script)(\s|>)/i,
  openAngle: /^</,
  closeAngle: />$/,
  alnumUnicode: /[\p{L}\p{N}]/u,
  numRef: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/,
  numRefOrAmp: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  escTest: /[&<>"']/,
  escReplace: /[&<>"']/g,
  escTestPlain: /[<>\"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escReplacePlain: /[<>\"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  pctDecode: /%25/g,
  pipeFind: /\|/g,
  pipeSplit: / \|/,
  pipeEscaped: /\\\|/g,
  crlf: /\r\n|\r/g,
  spaceOnlyLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  newlineEnd: /\n$/,
  punctClass: /[\p{P}\p{S}]/u,
  punctSpaceClass: /[\s\p{P}\p{S}]/u,
  notPunctSpaceClass: /[^\s\p{P}\p{S}]/u,
  punctNoTilde: /(?!~)[\p{P}\p{S}]/u,
  punctSpaceNoTilde: /(?!~)[\s\p{P}\p{S}]/u,
  notPunctOrTilde: /(?:[^\s\p{P}\p{S}]|~)/u,
  openQuotePunct: /[\p{Pi}\p{Ps}"']/u,
  backpedal: /(?:[^?!.,:;*_'\"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'\"~)]+(?!$))+/,
};

const BLOCK_TAGS =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';

const ATTR_PATTERN =
  / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/;
const COMMENT_PATTERN = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;

/* ------------------------------------------------------------------ */
/* block grammar                                                       */
/* ------------------------------------------------------------------ */

const BLOCK = {
  newline: /^(?:[ \t]*(?:\n|$))+/,
  code: /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,
  fences:
    /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/,
  heading: /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,
  hr: /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,
  bullet: / {0,3}(?:[*+-]|\d{1,9}[.)])/,
  text: /^[^\n]+/,
};

// Paragraph body: one or more lines, stopping before a line that opens a
// new block. The stop list is filled in by the builders below.
const PARA_BODY =
  /^([^\n]+(?:\n(?!HR|HEADING|QUOTE|FENCES|LIST|HTML|TABLE|[ \t]+\n)[^\n]+)*)/;

// Setext heading body (the text part is the same shape as a paragraph).
const SETEXT_BODY =
  /^(?!BULL |CODEBLK|FENCES|QUOTE|HEADING|HTML|TABLE)((?:.|\n(?!\s*?\n|BULL |FENCES|QUOTE|HEADING|HR|HTML|TABLE))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/;

const TABLE_BODY =
  /^ *([^\n ].*)\n {0,3}((?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?)(?:\n((?:(?! *\n|HR|HEADING|QUOTE|CODEBLK|FENCES|LIST|HTML).*(?:\n|$))*)|\n*|$)/;

const DEF_LABEL = /(?!\s*\])(?:\\[\s\S]|[^\[\]\n]|\n(?![ \t]*\n))+/;
const DEF_RULE_SRC =
  '^ {0,3}\\[(LABEL)\\]: *(?:\\n[ \\t]*)?([^<\\s][^\\s]*|<.*?>)' +
  '(?:(?: +(?:\\n[ \\t]*)?| *\\n[ \\t]*)(TITLE))? *(?:\\n+|$)';
const TITLE_PATTERN =
  /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\)/;

// HTML block (CommonMark types 1-7 plus a lone closing tag).
const HTML_BLOCK = new RegExp(
  '^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)' +
    '|COMMENT[^\\n]*(\\n+|$)' +
    '|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)' +
    '|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)' +
    '|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)' +
    '|</?(TAG)(?:[ \\t]+|\\n|/?>|$)[\\s\\S]*?(?:(?:\\n[ \\t]*)+\\n|$)' +
    '|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?:ATTR)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \\t]*)+\\n|$)' +
    '|</[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \\t]*)+\\n|$))',
  'i',
);

// Small "edit" helper: build a regex from a template by substituting
// named slots with pattern sources (all slots replaced globally).
function editRegex(template, slots) {
  let src = template.source;
  for (const [name, pattern] of Object.entries(slots)) {
    const replacement = typeof pattern === 'string' ? pattern : pattern.source;
    src = src.split(name).join(replacement);
  }
  return new RegExp(src, template.flags);
}

const HR_SRC = ' {0,3}(?:(?:-[\\t ]*){3,}|(?:_[ \\t]*){3,}|(?:\\*[ \\t]*){3,})(?:\\n+|$)';
const HEADING_SRC = ' {0,3}#{1,6}(?:\\s|$)';
const QUOTE_SRC = ' {0,3}>';
const FENCES_SRC = ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)';
const LIST_ONE_SRC = ' {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]';
const LIST_ANY_SRC = ' {0,3}(?:[*+-]|\\d{1,9}[.)])(?:[ \\t]|\\n|$)';
const LIST_BARE_SRC = ' {0,3}(?:[*+-]|\\d{1,9}[.)])';
const CODEBLK_SRC = '(?: {4}| {0,3}\\t)[^\\n]';
const HTML_START_SRC =
  ' {0,3}(?:</?(?:' + BLOCK_TAGS + ')(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)';
const TABLE_DELIM_SRC = ' {0,3}\\|?(?:[:\\- ]*\\|)+[\\:\\- ]*\\n';
const HTML_LINE_SRC = ' {0,3}<[^\\n>]+>\\n';

// The table rule, with its inner stop list filled in.
const TABLE_RULE = editRegex(TABLE_BODY, {
  HR: HR_SRC,
  HEADING: HEADING_SRC,
  QUOTE: QUOTE_SRC,
  CODEBLK: CODEBLK_SRC,
  FENCES: FENCES_SRC,
  LIST: ' {0,3}(?:[*+-]|1[.)])[ \\t]',
  HTML: HTML_START_SRC,
});

// Top-level GFM paragraph: stops before hr / heading / quote / fences /
// list / html / table starts. (Setext is NOT a stop: lheading is tried
// first and claims the whole paragraph+underline.)
const PARA_TOP = editRegex(PARA_BODY, {
  HR: HR_SRC,
  HEADING: HEADING_SRC,
  QUOTE: QUOTE_SRC,
  FENCES: FENCES_SRC,
  LIST: LIST_ONE_SRC,
  HTML: HTML_START_SRC,
  TABLE: TABLE_RULE.source,
});

// Paragraph used inside blockquotes / list items: same shape, but the
// list stop accepts any ordered number and tables do not stop it. (The
// TABLE stop is dropped from the template, not replaced with an empty
// string: an empty alternative would make the negative lookahead fail.)
const PARA_INNER_BODY = new RegExp(PARA_BODY.source.replace('|TABLE', ''), PARA_BODY.flags);
const PARA_INNER = editRegex(PARA_INNER_BODY, {
  HR: HR_SRC,
  HEADING: HEADING_SRC,
  QUOTE: QUOTE_SRC,
  FENCES: FENCES_SRC,
  LIST: LIST_ANY_SRC,
  HTML: HTML_START_SRC,
});

// Setext heading (GFM: also stops at a table delimiter row).
const SETEXT_RULE = editRegex(SETEXT_BODY, {
  'BULL ': LIST_BARE_SRC + ' ',
  CODEBLK: '(?: {4}| {0,3}\\t)',
  FENCES: ' {0,3}(?:`{3,}|~{3,})',
  QUOTE: QUOTE_SRC,
  HEADING: HEADING_SRC,
  HR: HR_SRC,
  HTML: HTML_LINE_SRC,
  TABLE: TABLE_DELIM_SRC,
});

// Blockquote rule: one or more lines, each either a quote line or a lazy
// paragraph continuation (matched with the inner paragraph rule).
const QUOTE_RULE = new RegExp(
  '^( {0,3}> ?(?:(?![ \\t]*(?:\\n|$))(' +
    PARA_INNER.source.slice(2, -1) +
    ')|[^\\n]*)(?:\\n|$))+',
);

// List opening rule.
const LIST_RULE = new RegExp('^(BULL)([ \\t][^\\n]*?)?(?:\\n|$)'.replace('BULL', BLOCK.bullet.source));

// The link-definition rule, with label and title slots filled in.
const DEF_RULE = editRegex(new RegExp(DEF_RULE_SRC), {
  LABEL: DEF_LABEL.source,
  TITLE: TITLE_PATTERN.source,
});

// The HTML-block regex, with comment / tag / attribute slots filled in.
const HTML_RULE = editRegex(HTML_BLOCK, {
  COMMENT: COMMENT_PATTERN.source,
  TAG: BLOCK_TAGS,
  ATTR: ATTR_PATTERN.source,
});

// Indented-code compensation for fenced blocks.
function fenceDedent(raw, text) {
  const m = raw.match(RX.fenceIndent);
  if (m === null) return text;
  const indent = m[1];
  return text
    .split('\n')
    .map((line) => {
      const lead = line.match(RX.leadSpace);
      if (lead === null) return line;
      return line.slice(Math.min(lead[0].length, indent.length));
    })
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* inline grammar                                                      */
/* ------------------------------------------------------------------ */

// A link label: balanced brackets, code spans, or plain characters.
const BRACKETED = /\[(?:\\[\s\S]|[^\[\]\\])*\]/;
const LABEL_BODY = new RegExp(
  '(?:\\[(?:BRACKETS|\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\])|[^\\[\\]\\\\`])*?',
);
const LABEL_PATTERN = editRegex(LABEL_BODY, { BRACKETS: BRACKETED.source });
const REF_LABEL = /(?:\\[\s\S]|[^\[\]\n]|\n(?![ \t]*\n))+/;
const REF_LABEL_SHORT = /(?:\\[\s\S]|[^\[\]\\]){1,999}/;
const REF_LABEL_LONG = editRegex(
  new RegExp(
    '(?:[^\\[\\]`]*(?:\\[(?:BRACKETS|\\\\[\\s\\S]|[^\\[\\]\\\\])*\\]|\\\\[\\s\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\]))){0,999}?[^\\[\\]`]*?',
  ),
  { BRACKETS: BRACKETED.source },
);

// Inline link / reference link / shortcut link patterns.
const HREF_PATTERN = /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/;
const LINK_PATTERN = editRegex(
  new RegExp(
    '^!?\\[(LABEL)\\]\\([ \\t\\n]*(HREF)(?:(?:[ \\t]+(?:\\n[ \\t]*)?|\\n[ \\t]*)(TITLE))?[ \\t\\n]*\\)',
  ),
  { LABEL: LABEL_PATTERN.source, HREF: HREF_PATTERN.source, TITLE: TITLE_PATTERN.source },
);
const REFLINK_PATTERN = editRegex(
  new RegExp('^!?\\[(LABEL)\\]\\[(REF)\\]'),
  { LABEL: LABEL_PATTERN.source, REF: REF_LABEL.source },
);
const NOLINK_PATTERN = editRegex(
  new RegExp('^!?\\[(REF)\\](?:\\[\\])?'),
  { REF: REF_LABEL.source },
);

// Reference-search pattern used by the masking pass: finds reference
// links and shortcut links (labels only, no leading anchor).
const REFLINK_SEARCH = new RegExp(
  editRegex(new RegExp('^!?\\[(LABEL)\\]\\[(REF)\\]'), {
    LABEL: REF_LABEL_LONG.source,
    REF: REF_LABEL_SHORT.source,
  }).source.slice(1) +
    '|' +
    editRegex(new RegExp('^!?\\[(REF)\\](?:\\[\\])?'), {
      REF: REF_LABEL_SHORT.source,
    }).source.slice(1) +
    '(?!\\()',
  'g',
);

const INLINE = {
  // backslash + ASCII punctuation
  escape: /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{\|}~])/,
  // code span: run of backticks, content, matching run
  code: /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,
  // hard break: two spaces or a backslash before a newline
  br: /^( {2,}|\\)\n(?!\s*$)[ \t]*/,
  // GFM plain text: stops before a backtick run, a tilde run, a bare
  // autolink start (scheme://, www., email), or the usual inline openers.
  text: /^(?:[^a-zA-Z0-9](?=(?:mailto|xmpp):)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|[hH][tT][tT][pP][sS]?|[fF][tT][pP]:\/\/|(?<![^\s*_~(])www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=(?:mailto|xmpp):)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/,
  // <...> autolink: scheme:rest or an email address
  autolink: new RegExp(
    '^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\\s\\x00-\\x1f<>]*|[a-zA-Z0-9.!#$%&\'*+/=?^_`{\|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_]))>',
  ),
  // raw HTML tag / comment / processing instruction / declaration / CDATA
  tag: null, // built below (needs ATTR + COMMENT)
  // GFM bare autolink (www. / scheme:// / email), built below
  url: null,
  // backpedal: trim trailing punctuation from a bare autolink
  backpedal:
    /(?:[^?!.,:;*_'\"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'\"~)]+(?!$))+/,
};

const ATTR_INLINE =
  /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/;
const TAG_PATTERN = new RegExp(
  '^COMMENT|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:ATTR)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>',
);
INLINE.tag = editRegex(TAG_PATTERN, {
  COMMENT: COMMENT_PATTERN.source,
  ATTR: ATTR_INLINE.source,
});

// Bare-autolink pieces.
const EMAIL_PATTERN =
  /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/;
const SCHEME_PATTERN = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
INLINE.url = editRegex(
  new RegExp(
    '^(?:MAILTO|^((?:SCHEME):\\/\\/|www\\.)(?:[a-zA-Z0-9\\-]+\\.?)+[^\\s<]*|^EMAIL2)',
  ),
  {
    MAILTO:
      '(?:mailto:EMAIL|xmpp:EMAIL(?:\\/[A-Za-z0-9@.]+)?)'.replace(
        /EMAIL/g,
        EMAIL_PATTERN.source,
      ),
    SCHEME: SCHEME_PATTERN.source,
    EMAIL2: '[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\\w-])',
  },
);

/* ------------------------------------------------------------------ */
/* emphasis / strikethrough delimiter patterns                         */
/* ------------------------------------------------------------------ */

// marked's inline "punctuation" test: a whitespace or punctuation
// character, other than * and _. (Used for the emphasis/delimiter
// flanking checks, where a preceding space counts like punctuation.)
const PUNCT_OR_SPACE = /^((?![*_])[\s\p{P}\p{S}])/u;

// Left delimiter: a run of * or _, plus the following character when it
// can tell us whether the run can open. Groups: 1 punct after *, 2 other
// after *, 3 punct after _, 4 other after _.
const LDELIM = /^(?:\*+(?:((?!\*)(?!~)[\p{P}\p{S}])|([^\s*]))?)|^_+(?:((?!_)(?!~)[\p{P}\p{S}])|([^\s_]))?/u;

// Right delimiter for *: built from the template below. Groups 1-6 hold
// the closing run; groups 3-4 are "add to the count" candidates.
const RDELIM_AST_TEMPLATE =
  '^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])' +
  '|(?!\\*)PUNCT(\\*+)(?=[\\s]|$)' +
  '|NOTPUNCT(\\*+)(?!\\*)(?=PUNCTSP|$)' +
  '|(?!\\*)PUNCTSP(\\*+)(?=NOTPUNCT)' +
  '|[\\s](\\*+)(?!\\*)(?=PUNCT)' +
  '|(?!\\*)PUNCT(\\*+)(?!\\*)(?=PUNCT)' +
  '|NOTPUNCT(\\*+)(?=NOTPUNCT)';

// Right delimiter for _: same shape, five groups.
const RDELIM_UND_TEMPLATE =
  '^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])' +
  '|(?!_)PUNCT(_+)(?=[\\s]|$)' +
  '|NOTPUNCT(_+)(?!_)(?=PUNCTSP|$)' +
  '|(?!_)PUNCTSP(_+)(?=NOTPUNCT)' +
  '|[\\s](_+)(?!_)(?=PUNCT)' +
  '|(?!_)PUNCT(_+)(?!_)(?=PUNCT)';

// Right delimiter for ~~: same shape, six groups.
const RDELIM_DEL_TEMPLATE =
  '^[^~]+(?=[^~])' +
  '|(?!~)PUNCT(~~?)(?=[\\s]|$)' +
  '|NOTPUNCT(~~?)(?!~)(?=PUNCTSP|$)' +
  '|(?!~)PUNCTSP(~~?)(?=NOTPUNCT)' +
  '|[\\s](~~?)(?!~)(?=PUNCT)' +
  '|(?!~)PUNCT(~~?)(?!~)(?=PUNCT)' +
  '|NOTPUNCT(~~?)(?=NOTPUNCT)';

function buildRDelim(template, punct, punctSpace, notPunct) {
  return new RegExp(
    template
      .split('PUNCTSP')
      .join(punctSpace.source)
      .split('NOTPUNCT')
      .join(notPunct.source)
      .split('PUNCT')
      .join(punct.source),
    'gu',
  );
}

// The *-closer uses tilde-aware classes (a tilde counts as "not
// punctuation" for emphasis); the _- and ~~-closers use plain classes.
const RDELIM_AST = buildRDelim(
  RDELIM_AST_TEMPLATE,
  RX.punctNoTilde,
  RX.punctSpaceNoTilde,
  RX.notPunctOrTilde,
);
const RDELIM_UND = buildRDelim(
  RDELIM_UND_TEMPLATE,
  RX.punctClass,
  RX.punctSpaceClass,
  RX.notPunctSpaceClass,
);
const RDELIM_DEL = buildRDelim(
  RDELIM_DEL_TEMPLATE,
  RX.punctClass,
  RX.punctSpaceClass,
  RX.notPunctSpaceClass,
);

// Left delimiter for ~~: one or two tildes plus the following character.
const LDELIM_DEL = /^~~?(?:((?!~)[\p{P}\p{S}])|[^\s~])/u;

// Code-span pattern used by the masking pass: a backtick run, content
// that may itself hold backticks, a closing run at least as long.
const CODE_OUTSIDE = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu;

// Skip pattern used by the masking pass: an inline link, a code span, or
// a raw HTML tag. The code alternative is guarded by a lookbehind so a
// backtick preceded by another backtick does not start a span.
const SKIP_LINK =
  '\\[(?:[^\\[\\]`]|(?<a>`+)[^`]+\\k<a>(?!`))*?\\]\\((?:\\\\[\\s\\S]|[^\\\\\\(\\)]|\\((?:\\\\[\\s\\S]|[^\\\\\\(\\)])*\\))*\\)';
const SKIP_CODE = '(?<b>`+)[^`]+\\k<b>(?!`)';
const SKIP_HTML = '<(?! )[^<>]*?>';
const SKIP_PATTERN = new RegExp(
  SKIP_LINK + '|(?<!`)()' + SKIP_CODE + '|' + SKIP_HTML,
  'g',
);

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(text, encodeAmp) {
  if (encodeAmp) {
    return RX.escTest.test(text)
      ? text.replace(RX.escReplace, (ch) => ESCAPE_MAP[ch])
      : text;
  }
  return RX.escTestPlain.test(text)
    ? text.replace(RX.escReplacePlain, (ch) => (ch === '&' ? '&amp;' : ESCAPE_MAP[ch]))
    : text;
}

// Decode numeric character references; a bare & becomes &amp;.
function decodeEntities(text) {
  if (!RX.numRef.test(text)) return text;
  return text.replace(RX.numRefOrAmp, (whole, dec, hex) => {
    if (dec === undefined && hex === undefined) return '&amp;';
    const code = hex === undefined ? parseInt(dec, 10) : parseInt(hex, 16);
    if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\uFFFD';
    if (code === 38) return '&amp;';
    return String.fromCodePoint(code);
  });
}

// Percent-encode a URL the way the reference does (encodeURI, then
// restore literal % characters).
function encodeHref(href) {
  try {
    return encodeURI(href).replace(RX.pctDecode, '%');
  } catch {
    return null;
  }
}

// Normalize a link label: trim, collapse inner whitespace, fold case.
function normalizeLabel(label) {
  return label.trim().replace(RX.multiSpaceG, ' ').toLowerCase().toUpperCase().toLowerCase();
}

// Expand tabs to spaces, tracking the column (tab stops every 4).
function expandTabs(text, startCol) {
  let col = startCol;
  let out = '';
  for (const ch of text) {
    if (ch === '\t') {
      const width = 4 - (col % 4);
      out += ' '.repeat(width);
      col += width;
    } else {
      out += ch;
      col++;
    }
  }
  return out;
}

// Strip trailing occurrences of a character (or, when invert is set,
// trailing characters that are NOT it).
function stripTrailing(text, ch, invert) {
  const n = text.length;
  if (n === 0) return '';
  let cut = 0;
  for (; cut < n; ) {
    const c = text.charAt(n - cut - 1);
    if (c === ch && !invert) cut++;
    else if (c !== ch && invert) cut++;
    else break;
  }
  return text.slice(0, n - cut);
}

// Remove trailing blank lines from a block, keeping at most one newline.
function trimBlankTail(text) {
  const lines = text.split('\n');
  let last = lines.length - 1;
  for (; last >= 0 && RX.blank.test(lines[last]); ) last--;
  return lines.length - last <= 2 ? text : lines.slice(0, last + 1).join('\n');
}

// Find the index of an unmatched closing paren in text (skipping
// backslash escapes and nested pairs). Returns -2 when a paren is left
// open, -1 when balanced or absent.
function parenBalance(text, pair) {
  if (text.indexOf(pair[0]) === -1 && text.indexOf(pair[1]) === -1) return -1;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === pair[0]) depth++;
    else if (text[i] === pair[1] && (--depth, depth < 0)) return i;
  }
  return depth > 0 ? -2 : -1;
}

// Split a table row on unescaped pipes, trim cells, pad or cut to the
// header's column count.
function splitTableRow(row, columns) {
  const marked = row.replace(RX.pipeFind, (ch, offset, whole) => {
    let escaped = false;
    let p = offset;
    for (; --p >= 0 && whole[p] === '\\'; ) escaped = !escaped;
    return escaped ? '|' : ' |';
  });
  const cells = marked.split(RX.pipeSplit);
  let i = 0;
  if (cells[0].trim() || cells.shift(), cells.length > 0 && !cells.at(-1)?.trim()) cells.pop();
  if (columns) {
    if (cells.length > columns) cells.splice(columns);
    else for (; cells.length < columns; ) cells.push('');
  }
  for (; i < cells.length; i++) cells[i] = cells[i].trim().replace(RX.pipeEscaped, '|');
  return cells;
}

// Last-possible-closer index: the last index where a delimiter run starts
// that is not preceded by a space, tab, newline, carriage return or form
// feed. Computed over the masked source.
function lastCloserIndex(masked) {
  const em = { '*': -1, _: -1 };
  let del = -1;
  const n = masked.length;
  for (let s = 0; s < n; s++) {
    const r = masked[s];
    if (r !== '*' && r !== '_' && r !== '~') continue;
    const prev = s === 0 ? '\n' : masked[s - 1];
    let i = s + 1;
    for (; i < n && masked[i] === r; ) i++;
    if (prev !== ' ' && prev !== '\t' && prev !== '\n' && prev !== '\r' && prev !== '\f') {
      if (r === '~') del = s;
      else em[r] = s;
    }
    s = i - 1;
  }
  return { em, del };
}

// Does this text contain a link (used by the masking pass to decide
// whether a reference label's inner text holds a nested link)?
function textHasLink(text, links) {
  if (!text.includes('[')) return false;
  for (const m of text.matchAll(SKIP_PATTERN)) {
    if (LINK_PATTERN.test(m[0]) && text.charAt(m.index - 1) !== '!') return true;
  }
  for (const m of text.matchAll(REFLINK_SEARCH)) {
    const whole = m[0];
    const open = whole.lastIndexOf('[');
    if (
      !(whole.charAt(0) === '!' || !Object.hasOwn(links, normalizeLabel(whole.slice(open + 1, -1)))) &&
      !(open > 1 && textHasLink(whole.slice(1, open - 1), links))
    ) {
      return true;
    }
  }
  return false;
}

// The masking pass: produce the masked source used for emphasis and
// strikethrough decisions. Reference links whose labels exist are masked
// to bracketed runs of "a"; code spans keep their backticks but lose
// inner backticks (they become "+"); links, code spans and raw HTML are
// masked to bracketed runs of "a". Masking preserves string length, so
// indexes in the masked source line up with the real source.
function maskSource(src, links) {
  let out = src;
  if (links && src.includes('[')) {
    const rewrite = (match) => {
      const open = match.lastIndexOf('[');
      if (!Object.hasOwn(links, normalizeLabel(match.slice(open + 1, -1)))) return match;
      if (open > 1 && match.charAt(0) !== '!') {
        const inner = match.slice(1, open - 1);
        if (textHasLink(inner, links)) {
          return '[' + inner.replace(REFLINK_SEARCH, rewrite) + '][' + 'a'.repeat(match.length - open - 2) + ']';
        }
      }
      return '[' + 'a'.repeat(match.length - 2) + ']';
    };
    out = out.replace(REFLINK_SEARCH, rewrite);
  }
  out = out.replace(CODE_OUTSIDE, (whole, ticks, punct) =>
    punct
      ? '+'.repeat(whole.length)
      : ticks
        ? ticks + whole.slice(ticks.length, -ticks.length).replace(/`/g, '+') + ticks
        : whole,
  );
  out = out.replace(SKIP_PATTERN, (whole) => '[' + 'a'.repeat(whole.length - 2) + ']');
  return out;
}

/* ------------------------------------------------------------------ */
/* inline rendering                                                    */
/* ------------------------------------------------------------------ */

// A `<` inside a link label blocks the link only when it opens a tag or
// autolink that runs past the label's end (or sits inside a code span,
// which is fine).
function labelHasBadAngle(src, label, offset) {
  if (!label.includes('<')) return false;
  for (let s = 0; s < label.length; s++) {
    if (label[s] === '\\') {
      s++;
      continue;
    }
    if (label[s] === '`') {
      const code = INLINE.code.exec(label.slice(s));
      if (code) {
        s += code[0].length - 1;
        continue;
      }
    }
    if (label[s] !== '<') continue;
    const tag = INLINE.tag.exec(src.slice(offset + s)) || INLINE.autolink.exec(src.slice(offset + s));
    if (tag) {
      if (tag[0].length > label.length - s) return true;
      s += tag[0].length - 1;
    }
  }
  return false;
}

// Build the HTML for a link or image token from its match, href and
// title. Tokenizes the label text (nested content) and enforces the
// no-nested-link rule. Returns null when the link must not form.
function makeLink(match, href, title, ctx) {
  const isImage = match[0].charAt(0) === '!';
  const labelText = match[1].replace(RX.linkBracketUnescape, '$1');
  const savedInLink = ctx.inLink;
  const savedEmitted = ctx.linkEmitted;
  const savedRaw = ctx.inRawBlock;
  ctx.inLink = true;
  ctx.linkEmitted = false;
  const inner = renderInline(labelText, ctx);
  const nested = ctx.linkEmitted;
  ctx.linkEmitted = savedEmitted;
  ctx.inLink = savedInLink;
  if (!isImage) {
    if (nested) {
      ctx.inRawBlock = savedRaw;
      return null;
    }
    ctx.linkEmitted = true;
  }
  const cleanHref = href ? href.replace(/\\([\p{P}\p{S}])/gu, '$1') : href;
  const cleanTitle = title ? title.replace(/\\([\p{P}\p{S}])/gu, '$1') : title;
  if (isImage) {
    const savedEm = ctx.linkEmitted;
    const alt = renderPlainText(labelText, ctx);
    ctx.linkEmitted = savedEm;
    const encoded = encodeHref(cleanHref);
    if (encoded === null) return { raw: match[0], html: escapeHtml(alt) };
    let img = '<img src="' + escapeHtml(encoded) + '" alt="' + escapeHtml(alt) + '"';
    if (cleanTitle) img += ' title="' + escapeHtml(cleanTitle) + '"';
    return { raw: match[0], html: img + '>' };
  }
  const encoded = encodeHref(cleanHref);
  if (encoded === null) return { raw: match[0], html: inner };
  let a = '<a href="' + escapeHtml(encoded) + '"';
  if (cleanTitle) a += ' title="' + escapeHtml(cleanTitle) + '"';
  return { raw: match[0], html: a + '>' + inner + '</a>' };
}

// Render inline content as plain text (used for image alt text): strong,
// emphasis, code, strikethrough and links collapse to their text, a hard
// break vanishes, raw HTML stays as-is.
function renderPlainText(src, ctx) {
  const savedInLink = ctx.inLink;
  const savedRaw = ctx.inRawBlock;
  const savedParen = ctx.linkParenPossible;
  ctx.inLink = false;
  ctx.linkEmitted = false;
  ctx.linkParenPossible = savedParen && src.includes(')');
  try {
    const hasDelims = src.includes('*') || src.includes('_') || src.includes('~');
    const masked = hasDelims ? maskSource(src, ctx.links) : src;
    const closer = hasDelims ? lastCloserIndex(masked) : { em: { '*': -1, _: -1 }, del: -1 };
    return inlineLoop(src, masked, closer, ctx, true);
  } finally {
    ctx.inLink = savedInLink;
    ctx.inRawBlock = savedRaw;
    ctx.linkParenPossible = savedParen;
  }
}

// Try an inline link [!?[label](href "title")]. Returns {raw, html} or
// null. When plain is set, the result is plain text instead of HTML.
function tryLink(rest, ctx, plain) {
  if (ctx.linkParenPossible === false) return null;
  const m = LINK_PATTERN.exec(rest);
  if (!m) return null;
  const offset = m[0].charAt(0) === '!' ? 2 : 1;
  if (labelHasBadAngle(rest, m[1], offset)) return null;
  const hrefPart = m[2].trim();
  if (RX.openAngle.test(hrefPart)) {
    if (!RX.closeAngle.test(hrefPart)) return null;
    const stripped = stripTrailing(hrefPart.slice(0, -1), '\\');
    if ((hrefPart.length - stripped.length) % 2 === 0) return null;
  } else {
    const bal = parenBalance(m[2], '()');
    if (bal === -2) return null;
    if (bal > -1) {
      const cut = (m[0].indexOf('!') === 0 ? 5 : 4) + m[1].length + bal;
      m[2] = m[2].substring(0, bal);
      m[0] = m[0].substring(0, cut).trim();
      m[3] = '';
    }
  }
  const trail = stripTrailing(m[0].slice(0, -1), '\\');
  if ((m[0].length - trail.length) % 2 === 0) return null;
  let href = m[2].trim();
  const title = m[3] ? m[3].slice(1, -1) : '';
  if (RX.openAngle.test(href)) href = href.slice(1, -1);
  if (plain) return makePlainLink(m, href, title, ctx);
  return makeLink(m, href, title, ctx);
}

// Plain-text version of a link: the label rendered as plain text, with
// the same no-nested-link rule (a nested link makes the outer one not
// form, returning null).
function makePlainLink(match, href, title, ctx) {
  const isImage = match[0].charAt(0) === '!';
  const labelText = match[1].replace(RX.linkBracketUnescape, '$1');
  const savedInLink = ctx.inLink;
  const savedEmitted = ctx.linkEmitted;
  const savedRaw = ctx.inRawBlock;
  ctx.inLink = true;
  ctx.linkEmitted = false;
  const inner = renderPlainText(labelText, ctx);
  const nested = ctx.linkEmitted;
  ctx.linkEmitted = savedEmitted;
  ctx.inLink = savedInLink;
  if (!isImage) {
    if (nested) {
      ctx.inRawBlock = savedRaw;
      return null;
    }
    ctx.linkEmitted = true;
  }
  return { raw: match[0], html: inner };
}

// Try a reference link [!?[label][ref]] or shortcut [!?[label]].
function tryReflink(rest, ctx, plain) {
  const m = REFLINK_PATTERN.exec(rest) || NOLINK_PATTERN.exec(rest);
  if (!m) return null;
  const offset = m[0].charAt(0) === '!' ? 2 : 1;
  if (labelHasBadAngle(rest, m[1], offset)) return null;
  const def = ctx.links[normalizeLabel(m[2] || m[1])];
  if (!def) {
    const ch = m[0].charAt(0);
    return { raw: ch, html: escapeHtml(ch), isText: true };
  }
  if (plain) return makePlainLink(m, def.href, def.title || '', ctx);
  return makeLink(m, def.href, def.title || '', ctx);
}

// Try emphasis / strong emphasis at the start of rest. masked is the
// masked source for the whole inline string; prevChar is the last
// character of the preceding text token ("" when none).
function tryEmStrong(rest, masked, prevChar, closer, ctx, plain) {
  const s = LDELIM.exec(rest);
  if (!s || (!s[1] && !s[2] && !s[3] && !s[4])) return null;
  const delim = s[0][0];
  const sameAsPrev = prevChar === delim;
  const i = masked.length - rest.length;
  let l = i;
  while (l > 0 && masked[l - 1] === delim) l--;
  const before = [...masked.slice(Math.max(0, l - 2), l)].at(-1) ?? '';
  const beforeIsPunct = before === '*' || before === '_' || PUNCT_OR_SPACE.test(before);
  let n = prevChar;
  if (l < i) n = before;
  const u = l < i ? beforeIsPunct : PUNCT_OR_SPACE.test(n);
  if (s[4] && n.match(RX.alnumUnicode)) return null;
  const d = s[1] || s[3] || '';
  if (!d || !n || u) {
    const k = [...s[0]].length - 1;
    let m = k;
    let f = 0;
    const y = i - l + k;
    const canCloseAlone = !!before.trim() && (!!d || (delim === '*' && !beforeIsPunct));
    if (delim !== '*' && delim !== '_') return null;
    const rightRe = delim === '*' ? RDELIM_AST : RDELIM_UND;
    const last = closer.em[delim];
    const q = masked.length - rest.length + k;
    if (last < q) return null;
    const region = masked.slice(-1 * rest.length + k);
    const limit = last - q;
    rightRe.lastIndex = 0;
    let close;
    while ((close = rightRe.exec(region)) !== null && !(close.index > limit)) {
      const g = close[1] || close[2] || close[3] || close[4] || close[5] || close[6];
      if (!g) continue;
      let b = [...g].length;
      if (close[3] || close[4]) {
        m += b;
        continue;
      } else if (close[5] || close[6] || canCloseAlone) {
        if (sameAsPrev && (close[5] || close[6])) break;
        if (y % 3 && !((y + b) % 3)) {
          f += b;
          continue;
        }
      }
      m -= b;
      if (m > 0) continue;
      b = Math.min(b, b + m + f);
      const firstLen = [...close[0]][0].length;
      const raw = rest.slice(0, k + close.index + firstLen + b);
      if (Math.min(k, b) % 2) {
        const inner = raw.slice(1, -1);
        return { raw, html: plain ? renderPlainText(inner, ctx) : '<em>' + renderInline(inner, ctx) + '</em>' };
      }
      const inner = raw.slice(2, -2);
      return { raw, html: plain ? renderPlainText(inner, ctx) : '<strong>' + renderInline(inner, ctx) + '</strong>' };
    }
  }
  return null;
}

// Try strikethrough (~~text~~) at the start of rest.
function tryDel(rest, masked, prevChar, closer, ctx, plain) {
  const s = LDELIM_DEL.exec(rest);
  if (!s) return null;
  if (!(s[1] || '') || !prevChar || PUNCT_OR_SPACE.test(prevChar)) {
    const o = [...s[0]].length - 1;
    let p = o;
    const last = closer.del;
    const d = masked.length - rest.length + o;
    if (last < d) return null;
    const region = masked.slice(-1 * rest.length + o);
    const limit = last - d;
    RDELIM_DEL.lastIndex = 0;
    let close;
    while ((close = RDELIM_DEL.exec(region)) !== null && !(close.index > limit)) {
      const g = close[1] || close[2] || close[3] || close[4] || close[5] || close[6];
      if (!g) continue;
      let l = [...g].length;
      if (l !== o) continue;
      if (close[3] || close[4]) {
        p += l;
        continue;
      }
      p -= l;
      if (p > 0) continue;
      l = Math.min(l, l + p);
      const firstLen = [...close[0]][0].length;
      const raw = rest.slice(0, o + close.index + firstLen + l);
      const inner = raw.slice(o, -o);
      return { raw, html: plain ? renderPlainText(inner, ctx) : '<del>' + renderInline(inner, ctx) + '</del>' };
    }
  }
  return null;
}

// Try a GFM bare autolink (www. / scheme:// / email) at the start of rest.
function tryUrl(rest, ctx, plain) {
  const m = INLINE.url.exec(rest);
  if (!m) return null;
  let text;
  let href;
  if (m[2] === '@') {
    text = m[0];
    href = 'mailto:' + text;
  } else {
    let raw = m[0];
    let prev;
    do {
      prev = raw;
      raw = INLINE.backpedal.exec(raw)?.[0] ?? '';
    } while (raw !== prev);
    text = raw;
    href = m[1] === 'www.' ? 'http://' + raw : raw;
  }
  if (plain) return { raw: text, html: text };
  const encoded = encodeHref(href);
  if (encoded === null) return { raw: text, html: escapeHtml(text, true) };
  return { raw: text, html: '<a href="' + escapeHtml(encoded, true) + '">' + escapeHtml(text, true) + '</a>' };
}

// Render an inline string to HTML. ctx carries the per-document state
// (link definitions, in-link / raw-block flags).
function renderInline(src, ctx) {
  const hasDelims = src.includes('*') || src.includes('_') || src.includes('~');
  const masked = hasDelims ? maskSource(src, ctx.links) : src;
  const closer = hasDelims ? lastCloserIndex(masked) : { em: { '*': -1, _: -1 }, del: -1 };
  const savedParen = ctx.linkParenPossible;
  ctx.linkParenPossible = savedParen && src.includes(')');
  try {
    return inlineLoop(src, masked, closer, ctx, false);
  } finally {
    ctx.linkParenPossible = savedParen;
  }
}

function inlineLoop(src, masked, closer, ctx, plain) {
  let out = '';
  let rest = src;
  let prevChar = '';
  let prevText = false;
  while (rest) {
    if (!prevText) prevChar = '';
    prevText = false;
    let m;
    if ((m = INLINE.escape.exec(rest))) {
      out += plain ? m[1] : escapeHtml(m[1]);
      rest = rest.slice(m[0].length);
      continue;
    }
    if ((m = INLINE.tag.exec(rest))) {
      if (!ctx.inLink && RX.openAnchor.test(m[0])) ctx.inLink = true;
      else if (ctx.inLink && RX.closeAnchor.test(m[0])) ctx.inLink = false;
      if (!ctx.inRawBlock && RX.openPre.test(m[0])) ctx.inRawBlock = true;
      else if (ctx.inRawBlock && RX.closePre.test(m[0])) ctx.inRawBlock = false;
      out += m[0];
      rest = rest.slice(m[0].length);
      continue;
    }
    const link = tryLink(rest, ctx, plain);
    if (link) {
      out += link.html;
      rest = rest.slice(link.raw.length);
      continue;
    }
    const ref = tryReflink(rest, ctx, plain);
    if (ref) {
      out += ref.html;
      rest = rest.slice(ref.raw.length);
      if (ref.isText) {
        if (ref.raw.slice(-1) !== '_') prevChar = ref.raw.slice(-1);
        prevText = true;
      }
      continue;
    }
    const em = tryEmStrong(rest, masked, prevChar, closer, ctx, plain);
    if (em) {
      out += em.html;
      rest = rest.slice(em.raw.length);
      continue;
    }
    if ((m = INLINE.code.exec(rest))) {
      let text = m[2].replace(RX.newlineG, ' ');
      if (RX.nonSpace.test(text) && RX.spaceStart.test(text) && RX.spaceEnd.test(text)) {
        text = text.substring(1, text.length - 1);
      }
      out += plain ? text : '<code>' + escapeHtml(text, true) + '</code>';
      rest = rest.slice(m[0].length);
      continue;
    }
    if ((m = INLINE.br.exec(rest))) {
      if (!plain) out += '<br>';
      rest = rest.slice(m[0].length);
      continue;
    }
    const del = tryDel(rest, masked, prevChar, closer, ctx, plain);
    if (del) {
      out += del.html;
      rest = rest.slice(del.raw.length);
      continue;
    }
    if ((m = INLINE.autolink.exec(rest))) {
      if (plain) {
        out += m[1];
      } else {
        let text;
        let href;
        if (m[2] === '@') {
          text = m[1];
          href = 'mailto:' + text;
        } else {
          text = m[1];
          href = text;
        }
        const encoded = encodeHref(href);
        if (encoded === null) out += escapeHtml(text, true);
        else out += '<a href="' + escapeHtml(encoded, true) + '">' + escapeHtml(text, true) + '</a>';
      }
      rest = rest.slice(m[0].length);
      continue;
    }
    if (!ctx.inLink) {
      const url = tryUrl(rest, ctx, plain);
      if (url) {
        out += url.html;
        rest = rest.slice(url.raw.length);
        continue;
      }
    }
    if ((m = INLINE.text.exec(rest))) {
      out += ctx.inRawBlock ? m[0] : escapeHtml(decodeEntities(m[0]));
      rest = rest.slice(m[0].length);
      if (m[0].slice(-1) !== '_') prevChar = m[0].slice(-1);
      prevText = true;
      continue;
    }
    break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* block lexing                                                        */
/* ------------------------------------------------------------------ */

// Lex a source string into a list of block nodes. ctx carries the
// per-document state (link definitions, top flag). When mergePara is set,
// a paragraph token merges into a preceding paragraph token (used inside
// blockquotes, where lazy continuation lines join the paragraph).
function lexBlocksInto(src, blocks, ctx, mergePara) {
  let rest = src;
  let guard = Infinity;
  while (rest) {
    if (rest.length < guard) guard = rest.length;
    else throw new Error('Infinite loop on byte: ' + rest.charCodeAt(0));
    let tok;

    // Blank lines.
    if ((tok = BLOCK.newline.exec(rest))) {
      rest = rest.slice(tok[0].length);
      const prev = blocks.at(-1);
      if (tok[0].length === 1 && prev !== undefined) prev.raw += '\n';
      else blocks.push({ type: 'space', raw: tok[0] });
      continue;
    }

    // Indented code.
    if ((tok = BLOCK.code.exec(rest))) {
      rest = rest.slice(tok[0].length);
      const raw = trimBlankTail(tok[0]);
      const text = raw.replace(RX.codeIndentStrip, '');
      const prev = blocks.at(-1);
      if (prev?.type === 'paragraph' || prev?.type === 'text') {
        prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + raw;
        prev.text += '\n' + text;
      } else {
        blocks.push({ type: 'code', raw, text, lang: '', fenced: false });
      }
      continue;
    }

    // Fenced code.
    if ((tok = BLOCK.fences.exec(rest))) {
      rest = rest.slice(tok[0].length);
      const lang = tok[2] ? tok[2].trim().replace(/\\([\p{P}\p{S}])/gu, '$1') : tok[2];
      blocks.push({ type: 'code', raw: tok[0], text: fenceDedent(tok[0], tok[3] || ''), lang, fenced: true });
      continue;
    }

    // ATX heading.
    if ((tok = BLOCK.heading.exec(rest))) {
      rest = rest.slice(tok[0].length);
      let text = tok[2].trim();
      if (RX.hashEnd.test(text)) {
        const stripped = stripTrailing(text, '#');
        if (!stripped || RX.spaceTabEnd.test(stripped)) text = stripped.trim();
      }
      blocks.push({ type: 'heading', raw: stripTrailing(tok[0], '\n'), depth: tok[1].length, text });
      continue;
    }

    // Thematic break.
    if ((tok = BLOCK.hr.exec(rest))) {
      rest = rest.slice(tok[0].length);
      blocks.push({ type: 'hr', raw: stripTrailing(tok[0], '\n') });
      continue;
    }

    // Blockquote.
    if ((tok = matchBlockquote(rest, ctx))) {
      rest = rest.slice(tok.raw.length);
      blocks.push(tok);
      continue;
    }

    // List.
    if ((tok = matchList(rest, ctx))) {
      rest = rest.slice(tok.raw.length);
      blocks.push(tok);
      continue;
    }

    // Raw HTML block.
    if ((tok = HTML_RULE.exec(rest))) {
      rest = rest.slice(tok[0].length);
      const text = trimBlankTail(tok[0]);
      const pre = tok[1] === 'pre' || tok[1] === 'script' || tok[1] === 'style';
      blocks.push({ type: 'html', raw: text, text, pre });
      continue;
    }

    // Link reference definition.
    if ((tok = DEF_RULE.exec(rest))) {
      rest = rest.slice(tok[0].length);
      const prev = blocks.at(-1);
      if (prev?.type === 'paragraph' || prev?.type === 'text') {
        prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + tok[0];
        prev.text += '\n' + tok[0];
      } else {
        const tag = normalizeLabel(tok[1]);
        if (!Object.hasOwn(ctx.links, tag)) {
          const href = tok[2] ? tok[2].replace(RX.angleHref, '$1').replace(/\\([\p{P}\p{S}])/gu, '$1') : '';
          const title = tok[3] ? tok[3].substring(1, tok[3].length - 1).replace(/\\([\p{P}\p{S}])/gu, '$1') : tok[3];
          ctx.links[tag] = { href, title };
        }
        blocks.push({ type: 'def', raw: stripTrailing(tok[0], '\n'), tag, href: '', title: '' });
      }
      continue;
    }

    // GFM table.
    if ((tok = matchTable(rest, ctx))) {
      rest = rest.slice(tok.raw.length);
      blocks.push(tok);
      continue;
    }

    // Setext heading.
    if ((tok = SETEXT_RULE.exec(rest))) {
      rest = rest.slice(tok[0].length);
      const text = tok[1].trim();
      blocks.push({ type: 'heading', raw: stripTrailing(tok[0], '\n'), depth: tok[2].charAt(0) === '=' ? 1 : 2, text });
      continue;
    }

    // Paragraph (only at the top level of a container).
    if (ctx.top) {
      const m = PARA_TOP.exec(rest);
      if (m) {
        rest = rest.slice(m[0].length);
        let text = m[1].charAt(m[1].length - 1) === '\n' ? m[1].slice(0, -1) : m[1];
        const prev = blocks.at(-1);
        if (mergePara && prev?.type === 'paragraph') {
          prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + m[0];
          prev.text += '\n' + text;
        } else {
          blocks.push({ type: 'paragraph', raw: m[0], text });
        }
        continue;
      }
    }

    // Plain text line (inside list items, where paragraphs are off).
    if ((tok = BLOCK.text.exec(rest))) {
      rest = rest.slice(tok[0].length);
      const prev = blocks.at(-1);
      if (prev?.type === 'text') {
        prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + tok[0];
        prev.text += '\n' + tok[0];
      } else {
        blocks.push({ type: 'text', raw: tok[0], text: tok[0] });
      }
      continue;
    }

    throw new Error('Infinite loop on byte: ' + rest.charCodeAt(0));
  }
  ctx.top = true;
}

// Lex a source string into a fresh list of block nodes.
function lexBlocks(src, ctx, mergePara) {
  const blocks = [];
  lexBlocksInto(src, blocks, ctx, mergePara);
  return blocks;
}

// GFM table: header row, delimiter row, body rows.
function matchTable(src, ctx) {
  const m = TABLE_RULE.exec(src);
  if (!m || !RX.tableDelim.test(m[2])) return null;
  const headerCells = splitTableRow(m[1]);
  const aligns = m[2].replace(RX.tableEdge, '').split('|');
  const bodyLines = m[3]?.trim() ? m[3].replace(RX.tableRowBlank, '').split('\n') : [];
  const table = { type: 'table', raw: stripTrailing(m[0], '\n'), header: [], align: [], rows: [] };
  if (headerCells.length !== aligns.length) return null;
  for (const cell of aligns) {
    if (RX.alignRight.test(cell)) table.align.push('right');
    else if (RX.alignCenter.test(cell)) table.align.push('center');
    else if (RX.alignLeft.test(cell)) table.align.push('left');
    else table.align.push(null);
  }
  for (let i = 0; i < headerCells.length; i++) {
    table.header.push({ text: headerCells[i], align: table.align[i] });
  }
  for (const line of bodyLines) {
    table.rows.push(
      splitTableRow(line, headerCells.length).map((cell, i) => ({ text: cell, align: table.align[i] })),
    );
  }
  return table;
}

// Blockquote: groups of `>` lines (with lazy continuation lines) are
// stripped of their markers and lexed as a fresh container; a nested
// blockquote or a list that ends a group may swallow following lines.
function matchBlockquote(src, ctx) {
  const m = QUOTE_RULE.exec(src);
  if (!m) return null;
  let lines = stripTrailing(m[0], '\n').split('\n');
  let raw = '';
  let text = '';
  const blocks = [];
  while (lines.length > 0) {
    let hasMarker = false;
    const group = [];
    let p;
    for (p = 0; p < lines.length; p++) {
      if (RX.quoteStart.test(lines[p])) {
        group.push(lines[p]);
        hasMarker = true;
      } else if (!hasMarker) {
        group.push(lines[p]);
      } else break;
    }
    lines = lines.slice(p);
    const joined = group.join('\n');
    const stripped = joined
      .replace(RX.quoteMarkerWs, (g, b, ws) => b + expandTabs(ws, b.length))
      .replace(RX.quoteSetext, '\n    $1')
      .replace(RX.quoteMarker, '');
    raw = raw ? raw + '\n' + joined : joined;
    text = text ? text + '\n' + stripped : stripped;
    const savedTop = ctx.top;
    ctx.top = true;
    lexBlocksInto(stripped, blocks, ctx, true);
    ctx.top = savedTop;
    if (lines.length === 0) break;
    const last = blocks.at(-1);
    if (
      last?.type === 'code' ||
      last?.type === 'heading' ||
      last?.type === 'hr' ||
      last?.type === 'html' ||
      last?.type === 'table'
    ) {
      break;
    }
    if (last?.type === 'blockquote') {
      const g = last;
      const restText = lines.join('\n');
      const combined = g.raw + '\n' + restText.replace(RX.quoteMarker, '');
      const nested = matchBlockquote(combined, ctx);
      blocks[blocks.length - 1] = nested;
      const leftover = combined.substring(nested.raw.length).replace(/^\n/, '');
      const count = leftover ? leftover.split('\n').length : 0;
      const taken = count ? lines.slice(0, -count) : lines;
      if (taken.length > 0) {
        raw = raw + '\n' + taken.join('\n');
        text = text.substring(0, text.length - g.text.length) + nested.text;
        lines = lines.slice(taken.length);
        if (lines.length > 0 && RX.quoteStart.test(lines[0])) continue;
      }
      break;
    } else if (last?.type === 'list') {
      const g = last;
      const combined = g.raw + '\n' + lines.join('\n');
      const relisted = matchList(combined, ctx);
      blocks[blocks.length - 1] = relisted;
      const count =
        relisted.raw.length > g.raw.length
          ? combined.slice(g.raw.length + 1, relisted.raw.length).split('\n').length
          : 0;
      if (count > 0) {
        const taken = lines.slice(0, count).join('\n');
        raw = raw + '\n' + taken;
        text = text + '\n' + taken;
      }
      lines = lines.slice(count);
      continue;
    }
    // Anything else (paragraph, text, space): loop again with the rest.
  }
  return { type: 'blockquote', raw, text, blocks };
}

// List: mirrors marked's list tokenizer. The first line's marker fixes the
// bullet pattern; each item's content is gathered line by line (stopping at
// a fence, heading, HTML block, blockquote, next bullet or hr at the item
// indent, or an under-indented non-blank line), then lexed with top=false
// so its paragraphs become text tokens. Looseness comes from blank lines
// between items or a space token spanning lines inside an item; a task
// marker becomes a checkbox node.
function clampListIndent(n) {
  return Math.max(0, Math.min(3, n - 1));
}
function nextBulletRegex(n) {
  const c = clampListIndent(n);
  return new RegExp(`^ {0,${c}}(?:[*+-]|\\d{1,9}[.)])((?:[ \\t][^\\n]*)?(?:\\n|$))`);
}
function hrAtRegex(n) {
  const c = clampListIndent(n);
  return new RegExp(`^ {0,${c}}((?:-[ \\t]*){3,}|(?:_[ \\t]*){3,}|(?:\\*[ \\t]*){3,})(?:\\n+|$)`);
}
function fencesBeginRegex(n) {
  const c = clampListIndent(n);
  return new RegExp('^ {0,' + c + '}(?:```|~~~)');
}
function headingBeginRegex(n) {
  const c = clampListIndent(n);
  return new RegExp(`^ {0,${c}}#{1,6}(?:\\s|$)`);
}
function htmlBeginRegex(n) {
  const c = clampListIndent(n);
  return new RegExp(
    `^ {0,${c}}(?:</?(?:${BLOCK_TAGS})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`,
    'i',
  );
}
function blockquoteBeginRegex(n) {
  const c = clampListIndent(n);
  return new RegExp(`^ {0,${c}}>`);
}

function matchList(src, ctx) {
  const first = LIST_RULE.exec(src);
  if (!first) return null;
  const whole = src;
  let rest = src;
  const consumed = () => whole.length - rest.length;
  let marker = first[1].trim();
  const ordered = marker.length > 1;
  const list = {
    type: 'list',
    raw: '',
    ordered,
    start: ordered ? Number(marker.slice(0, -1)) : '',
    loose: false,
    items: [],
  };
  marker = ordered ? `\\d{1,9}\\${marker.slice(-1)}` : `\\${marker}`;
  const itemRe = new RegExp(`^( {0,3}${marker})((?:[\\t ][^\\n]*)?(?:\\n|$))`);
  let pendingBlank = false;
  while (rest) {
    let blankItem = false;
    let text = '';
    const t = itemRe.exec(rest);
    if (!t || BLOCK.hr.test(rest)) break;
    const startAt = consumed();
    rest = rest.substring(t[0].length);
    const firstLine = t[2].split('\n', 1)[0];
    const markerLen = t[1].length;
    let m = firstLine.replace(RX.leadSpaceTab, (v) => expandTabs(v, markerLen));
    let f = rest.split('\n', 1)[0];
    let y = !m.trim();
    let indent = 0;
    if (y) {
      indent = markerLen + 1;
    } else {
      indent = m.search(RX.nonSpace);
      indent = indent > 4 ? 1 : indent;
      text = m.slice(indent);
      indent += markerLen;
    }
    if (y && RX.blank.test(f)) {
      rest = rest.substring(f.length + 1);
      blankItem = true;
    }
    if (!blankItem) {
      const nextBullet = nextBulletRegex(indent);
      const hrAt = hrAtRegex(indent);
      const fenceAt = fencesBeginRegex(indent);
      const headingAt = headingBeginRegex(indent);
      const htmlAt = htmlBeginRegex(indent);
      const quoteAt = blockquoteBeginRegex(indent);
      while (rest) {
        const line = rest.split('\n', 1)[0];
        f = line;
        const expanded = f.replace(RX.leadSpaceTab, (v) => expandTabs(v, 0));
        if (
          fenceAt.test(f) ||
          headingAt.test(f) ||
          htmlAt.test(f) ||
          quoteAt.test(f) ||
          nextBullet.test(f) ||
          hrAt.test(f)
        ) {
          break;
        }
        if (expanded.search(RX.nonSpace) >= indent || !f.trim()) {
          text += '\n' + expanded.slice(indent);
        } else {
          if (
            y ||
            m.replace(RX.tabG, '    ').search(RX.nonSpace) >= 4 ||
            fenceAt.test(m) ||
            headingAt.test(m) ||
            htmlAt.test(m) ||
            hrAt.test(m)
          ) {
            break;
          }
          const setextLine =
            RX.setextLine.test(f) && SETEXT_RULE.test(`${m}\n${f}`)
              ? `    ${expanded.replace(/^ {0,3}/, '')}`
              : f;
          text += '\n' + setextLine;
        }
        y = !f.trim();
        rest = rest.substring(line.length + 1);
        m = expanded.slice(indent);
      }
    }
    const itemRaw = whole.slice(startAt, consumed());
    if (!list.loose) {
      if (pendingBlank) list.loose = true;
      else if (RX.doubleBlank.test(itemRaw)) pendingBlank = true;
    }
    list.items.push({
      type: 'listItem',
      raw: itemRaw,
      task: RX.taskItem.test(text),
      loose: false,
      text,
      blocks: [],
    });
  }
  const lastItem = list.items.at(-1);
  if (!lastItem) return null;
  lastItem.raw = lastItem.raw.trimEnd();
  lastItem.text = lastItem.text.trimEnd();
  list.raw = whole.slice(0, consumed()).trimEnd();
  for (const item of list.items) {
    ctx.top = false;
    item.blocks = lexBlocks(item.text, ctx, false);
    if (!list.loose) {
      const spaces = item.blocks.filter((b) => b.type === 'space');
      if (spaces.length > 0 && spaces.some((b) => RX.anyLine.test(b.raw))) list.loose = true;
    }
  }
  for (const item of list.items) {
    const firstBlock = item.blocks[0];
    if (item.task && (firstBlock?.type === 'text' || firstBlock?.type === 'paragraph')) {
      item.text = item.text.replace(RX.taskStrip, '');
      firstBlock.raw = firstBlock.raw.replace(RX.taskStrip, '');
      firstBlock.text = firstBlock.text.replace(RX.taskStrip, '');
      const check = RX.taskBox.exec(item.raw);
      if (check) {
        const box = { type: 'checkbox', raw: check[0] + ' ', checked: check[0] !== '[ ]' };
        item.checked = box.checked;
        if (list.loose) firstBlock.checkbox = box;
        else item.blocks.unshift(box);
      }
    } else if (item.task) {
      item.task = false;
    }
  }
  if (list.loose) {
    for (const item of list.items) {
      item.loose = true;
      for (const b of item.blocks) if (b.type === 'text') b.type = 'paragraph';
    }
  }
  return list;
}

/* ------------------------------------------------------------------ */
/* block rendering                                                     */
/* ------------------------------------------------------------------ */

function renderCheckbox(box) {
  return '<input ' + (box.checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> ';
}

function renderTableCell(cell, isHeader, ctx) {
  const tag = isHeader ? 'th' : 'td';
  const open = cell.align ? `<${tag} align="${cell.align}">` : `<${tag}>`;
  return open + renderInline(cell.text, ctx) + `</${tag}>\n`;
}

function renderBlocks(blocks, ctx) {
  let out = '';
  for (const b of blocks) out += renderBlock(b, ctx);
  return out;
}

function renderBlock(b, ctx) {
  switch (b.type) {
    case 'space':
    case 'def':
      return '';
    case 'code': {
      const lang = (b.lang || '').match(RX.notSpaceStart)?.[0] || '';
      const text = b.text ? b.text.replace(RX.newlineEnd, '') + '\n' : '';
      const body = escapeHtml(text, true);
      if (lang) return `<pre><code class="language-${escapeHtml(lang)}">${body}</code></pre>\n`;
      return `<pre><code>${body}</code></pre>\n`;
    }
    case 'heading':
      return `<h${b.depth}>${renderInline(b.text, ctx)}</h${b.depth}>\n`;
    case 'hr':
      return '<hr>\n';
    case 'blockquote':
      return `<blockquote>\n${renderBlocks(b.blocks, ctx)}</blockquote>\n`;
    case 'list': {
      let items = '';
      for (const item of b.items) items += renderListItem(item, ctx);
      const tag = b.ordered ? 'ol' : 'ul';
      const start = b.ordered && b.start !== 1 ? ` start="${b.start}"` : '';
      return `<${tag}${start}>\n${items}</${tag}>\n`;
    }
    case 'html':
      return b.text;
    case 'table': {
      let head = '';
      for (const cell of b.header) head += renderTableCell(cell, true, ctx);
      let body = '';
      for (const row of b.rows) {
        let cells = '';
        for (const cell of row) cells += renderTableCell(cell, false, ctx);
        body += `<tr>\n${cells}</tr>\n`;
      }
      const tbody = body ? `<tbody>${body}</tbody>` : '';
      return `<table>\n<thead>\n<tr>\n${head}</tr>\n</thead>\n${tbody}</table>\n`;
    }
    case 'paragraph': {
      const box = b.checkbox ? renderCheckbox(b.checkbox) : '';
      return `<p>${box}${renderInline(b.text, ctx)}</p>\n`;
    }
    case 'text': {
      const box = b.checkbox ? renderCheckbox(b.checkbox) : '';
      return box + renderInline(b.text, ctx);
    }
    case 'checkbox':
      return renderCheckbox(b);
    default:
      return '';
  }
}

function renderListItem(item, ctx) {
  let inner = '';
  for (const b of item.blocks) inner += renderBlock(b, ctx);
  return `<li>${inner}</li>\n`;
}

/* ------------------------------------------------------------------ */
/* entry point                                                         */
/* ------------------------------------------------------------------ */

// Render one Markdown document to HTML, byte-identical to marked 18.1.3
// with its defaults (GFM on, breaks off, pedantic off).
export function parse(markdown) {
  const src = String(markdown).replace(RX.crlf, '\n');
  const ctx = {
    links: {},
    top: true,
    inLink: false,
    linkEmitted: false,
    inRawBlock: false,
  };
  return renderBlocks(lexBlocks(src, ctx, false), ctx);
}
