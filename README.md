# Single-Pass Marked-Exact Renderer

[![make.fun](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/pumafelidae/markdown-render-speed-02/rank.svg)](https://make.fun/bounty/markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/pumafelidae/markdown-render-speed-02/reward.svg)](https://make.fun/bounty/markdown-render-speed-02)

A dependency-free, single-pass Markdown renderer whose `parse(markdown)` returns
byte-for-byte the HTML that [marked 18.1.3](https://github.com/markedjs/marked)
renders with its default options (GitHub Flavored Markdown on, async off). It is
an entry for the [markdown-render-speed-02 bounty](https://make.fun/bounty/markdown-render-speed-02)
on [make.fun](https://make.fun).

## How it works

`parse.js` is a from-scratch reimplementation of marked's lexer, tokenizer,
parser, and renderer: block tokenization (headings, fences, lists, tables,
block quotes, link definitions), inline tokenization (emphasis, links, code
spans, autolinks, entities), and HTML rendering — all in one pass with no
dependencies. `main.ts` is the driver: it reads every case from
`MAKEFUN_INPUT_DIR/cases.json`, renders each one with `parse()`, and writes the
HTML strings to `MAKEFUN_OUTPUT_DIR/html.json`.

## Run

```sh
MAKEFUN_INPUT_DIR=./practice/input MAKEFUN_OUTPUT_DIR=./practice/output node main.ts
```
