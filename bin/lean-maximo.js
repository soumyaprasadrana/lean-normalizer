#!/usr/bin/env node
/**
 * bin/lean-maximo.js
 * ─────────────────────────────────────────────────────────────────────────────
 * LEAN/COTS CLI Runner — Maximo Adapter
 *
 * Works from compiled dist/ — NO ts-node required.
 * Run after:  npm run build
 *
 * Usage:
 *   node bin/lean-maximo.js <path-to-input.json>
 *   npm run run:maximo -- tests/input/maximo-workorders.json
 *
 * (when installed globally via npm)
 *   lean-maximo tests/input/maximo-workorders.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Resolve dist/ — works both locally and when installed as a package ────────
const DIST = path.resolve(__dirname, '..', 'dist');

if (!fs.existsSync(DIST)) {
  console.error([
    '',
    '  \x1b[31m✗  dist/ not found. You need to build first.\x1b[0m',
    '',
    '     Run:  \x1b[1mnpm run build\x1b[0m',
    '     Then: \x1b[1mnode bin/lean-maximo.js <your-file.json>\x1b[0m',
    '',
  ].join('\n'));
  process.exit(1);
}

const { LeanEncoder }   = require(path.join(DIST, 'core', 'encoder'));
const { MaximoAdapter } = require(path.join(DIST, 'adapters', 'maximo'));

// ── ANSI colour helpers ───────────────────────────────────────────────────────

const C = {
  reset  : '\x1b[0m',
  bold   : '\x1b[1m',
  dim    : '\x1b[2m',
  cyan   : '\x1b[36m',
  green  : '\x1b[32m',
  yellow : '\x1b[33m',
  red    : '\x1b[31m',
  magenta: '\x1b[35m',
  blue   : '\x1b[34m',
};

const bold    = (s) => `${C.bold}${s}${C.reset}`;
const dim     = (s) => `${C.dim}${s}${C.reset}`;
const cyan    = (s) => `${C.cyan}${s}${C.reset}`;
const green   = (s) => `${C.green}${s}${C.reset}`;
const yellow  = (s) => `${C.yellow}${s}${C.reset}`;
const red     = (s) => `${C.red}${s}${C.reset}`;
const magenta = (s) => `${C.magenta}${s}${C.reset}`;
const blue    = (s) => `${C.blue}${s}${C.reset}`;

// ── Utility ───────────────────────────────────────────────────────────────────

function hr(char = '─', width = 72) {
  return dim(char.repeat(width));
}

function pad(label, width = 22) {
  return String(label).padEnd(width);
}

function bytes(n) {
  if (n < 1024)         return `${n} B`;
  if (n < 1048576)      return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

function bar(ratio, width = 30) {
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)));
  const empty  = width - filled;
  return `${C.green}${'█'.repeat(filled)}${C.reset}${dim('░'.repeat(empty))}`;
}

function extractBlock(encoded, blockName) {
  const re = new RegExp(`### ${blockName}[^\\n]*\\n([\\s\\S]*?)(?=###|$)`);
  return encoded.match(re)?.[1]?.trim() ?? '';
}

function parseDict(encoded) {
  const raw = extractBlock(encoded, 'DICT');
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map((line) => {
    const eq = line.indexOf('=');
    return { pointer: line.slice(0, eq), value: line.slice(eq + 1) };
  });
}

function parseSchema(encoded) {
  const raw = extractBlock(encoded, 'SCHEMA');
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map((line) => {
    const eq = line.indexOf('=');
    return { key: line.slice(0, eq), path: line.slice(eq + 1) };
  });
}

function parseDataBlocks(encoded) {
  const blocks = [];
  const re = /### DATA: ([^\n]+)\n([\s\S]*?)(?=###|$)/g;
  let m;
  while ((m = re.exec(encoded)) !== null) {
    const rows = m[2].trim().split('\n').filter(Boolean);
    blocks.push({ tableName: m[1].trim(), rows });
  }
  return blocks;
}

function countPointerUsage(encoded, dictEntries) {
  const dataSection = encoded.split('### DATA:').slice(1).join('### DATA:');
  return dictEntries.map(({ pointer, value }) => {
    // Escape * for regex — e.g. *0 → \*0
    const escaped = pointer.replace('*', '\\*');
    const re = new RegExp(`${escaped}(?=[\\s])`, 'g');
    const count = (dataSection.match(re) ?? []).length;
    return { pointer, value, count };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {

  // ── 1. Resolve input file ──────────────────────────────────────────────────
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error([
      '',
      red('  ✗  No input file specified.'),
      '',
      `  Usage:   ${bold('node bin/lean-maximo.js <path-to-input.json>')}`,
      `  Example: ${dim('node bin/lean-maximo.js tests/input/maximo-workorders.json')}`,
      '',
    ].join('\n'));
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(red(`\n  ✗  File not found: ${inputPath}\n`));
    process.exit(1);
  }

  // ── 2. Read & parse JSON ───────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  } catch (e) {
    console.error(red(`\n  ✗  Failed to parse JSON: ${e.message}\n`));
    process.exit(1);
  }

  const rawJson     = JSON.stringify(payload);
  const inputSize   = Buffer.byteLength(rawJson, 'utf-8');
  const prettyLines = JSON.stringify(payload, null, 2).split('\n').length;

  // ── 3. Encode ──────────────────────────────────────────────────────────────
  const adapter   = new MaximoAdapter();
  const encoder   = new LeanEncoder({ adapter });
  const startMs   = Date.now();
  const result    = encoder.encode(payload);
  const elapsedMs = Date.now() - startMs;

  // ── 4. Analyse output ──────────────────────────────────────────────────────
  const dictEntries = result.compressed ? parseDict(result.encoded)       : [];
  const schemaKeys  = result.compressed ? parseSchema(result.encoded)     : [];
  const dataBlocks  = result.compressed ? parseDataBlocks(result.encoded) : [];
  const ptrUsage    = result.compressed ? countPointerUsage(result.encoded, dictEntries) : [];
  const savedBytes  = result.originalSize - result.encodedSize;

  // ── 5. Print ───────────────────────────────────────────────────────────────

  const pkg = require(path.join(DIST, '..', 'package.json'));

  console.log('');
  console.log(hr('═'));
  console.log(bold(cyan(`  LEAN/COTS Encoder  v${pkg.version}  —  Maximo Adapter`)));
  console.log(hr('═'));

  // ── INPUT ──────────────────────────────────────────────────────────────────
  console.log('');
  console.log(bold(`  📂  INPUT`));
  console.log(hr());
  console.log(`  ${pad('File')}${cyan(path.basename(inputPath))}`);
  console.log(`  ${pad('Full path')}${dim(inputPath)}`);
  console.log(`  ${pad('JSON size')}${bold(bytes(inputSize))}  ${dim(`(${prettyLines} lines pretty-printed)`)}`);

  try {
    const root = adapter.findRoot(payload);
    console.log(`  ${pad('Root array key')}${cyan(root.name)}`);
    console.log(`  ${pad('Record count')}${bold(String(root.data.length))}`);
    if (root.data.length > 0 && typeof root.data[0] === 'object' && root.data[0] !== null) {
      const allKeys = Object.keys(root.data[0]);
      const preview = allKeys.slice(0, 8).join(', ');
      const more    = allKeys.length > 8 ? ` … +${allKeys.length - 8} more` : '';
      console.log(`  ${pad('First record keys')}${dim(preview + more)}`);
    }
  } catch (_) { /* ignore */ }

  // ── ENCODING RESULT ────────────────────────────────────────────────────────
  console.log('');
  console.log(bold(`  ⚙️   ENCODING RESULT`));
  console.log(hr());

  if (!result.compressed) {
    console.log(`  ${pad('Status')}${yellow('⚠  Circuit breaker fired — raw JSON returned')}`);
    console.log(`  ${pad('Reason')}${dim('Encoded output was not smaller than raw JSON.')}`);
    console.log(`  ${pad('Original size')}${bytes(result.originalSize)}`);
    console.log(`  ${pad('Elapsed')}${dim(elapsedMs + ' ms')}`);
    console.log('');
    console.log(hr('═'));
    console.log(bold('  📤  OUTPUT  (raw JSON — no compression applied)'));
    console.log(hr('═'));
    console.log('');
    console.log(result.encoded);
    console.log('');
    process.exit(0);
  }

  const pctSaved = ((savedBytes / result.originalSize) * 100).toFixed(1);

  console.log(`  ${pad('Status')}${green('✅  LEAN wire format applied')}`);
  console.log(`  ${pad('Original size')}${bold(bytes(result.originalSize))}`);
  console.log(`  ${pad('Encoded size')}${bold(green(bytes(result.encodedSize)))}`);
  console.log(`  ${pad('Bytes saved')}${bold(green(bytes(savedBytes)))}  ${dim(`(${pctSaved}% reduction)`)}`);
  console.log(`  ${pad('Ratio')}${bold((result.ratio * 100).toFixed(1) + '% of original')}  ${bar(result.ratio)}`);
  console.log(`  ${pad('Elapsed')}${dim(elapsedMs + ' ms')}`);

  // ── DICT BLOCK ─────────────────────────────────────────────────────────────
  console.log('');
  console.log(bold(`  📖  DICT BLOCK`));
  console.log(hr());

  if (dictEntries.length === 0) {
    console.log(`  ${dim('(empty — no strings met the dictionary threshold)')}`);
  } else {
    console.log(`  ${dim(`${dictEntries.length} entries  ·  minLength=6  ·  minFrequency=1  ·  URLs/dates bypass`)}`);
    console.log('');
    console.log(`  ${dim(pad('Pointer', 10))}${dim(pad('Uses in DATA', 14))}${dim('Stored value')}`);
    console.log(`  ${dim('─'.repeat(62))}`);
    ptrUsage.forEach(({ pointer, value, count }) => {
      const badge = count > 0
        ? green(`×${count}`.padEnd(14))
        : dim(`×${count}`.padEnd(14));
      console.log(`  ${cyan(pad(pointer, 10))}${badge}${value}`);
    });
  }

  // ── SCHEMA BLOCK ───────────────────────────────────────────────────────────
  console.log('');
  console.log(bold(`  🗺️   SCHEMA BLOCK`));
  console.log(hr());
  console.log(`  ${dim(`${schemaKeys.length} field paths mapped to base-36 short keys`)}`);
  console.log('');
  console.log(`  ${dim(pad('Key', 8))}${dim('Full field path  (spi:/rdf: prefixes already stripped)')}`);
  console.log(`  ${dim('─'.repeat(62))}`);

  const rootKeys  = schemaKeys.filter((e) => e.path.split('.').length <= 2);
  const childKeys = schemaKeys.filter((e) => e.path.split('.').length >  2);

  rootKeys.forEach(({ key, path: p }) => {
    console.log(`  ${magenta(pad(key, 8))}${p}`);
  });
  if (childKeys.length > 0) {
    console.log(`  ${dim('  ── child table fields ──')}`);
    childKeys.forEach(({ key, path: p }) => {
      console.log(`  ${blue(pad(key, 8))}${dim(p)}`);
    });
  }

  // ── DATA BLOCKS ────────────────────────────────────────────────────────────
  console.log('');
  console.log(bold(`  🗃️   DATA BLOCKS`));
  console.log(hr());
  console.log(`  ${dim(`${dataBlocks.length} table(s) total`)}`);
  console.log('');

  dataBlocks.forEach(({ tableName, rows }) => {
    const isChild = tableName.includes('.');
    const label   = isChild
      ? `  ${blue('↳')} ${blue(tableName)}`
      : `  ${cyan(tableName)}`;

    console.log(`${bold(label)}  ${dim(`${rows.length} row${rows.length !== 1 ? 's' : ''}`)}`);

    const preview = rows.slice(0, 4);
    preview.forEach((row) => {
      const display = row.length > 118 ? row.slice(0, 115) + '…' : row;
      console.log(`     ${dim(display)}`);
    });
    if (rows.length > 4) {
      console.log(`     ${dim(`… ${rows.length - 4} more row(s)`)}`);
    }
    console.log('');
  });

  // ── SUPPRESSION REPORT ─────────────────────────────────────────────────────
  console.log(bold(`  🚫  MAXIMO SUPPRESSED KEYS  (skipPatterns)`));
  console.log(hr());
  [
    ['_collectionref',  'OSLC collection navigation link'],
    ['localref',        'OSLC local cross-reference'],
    ['_rowstamp',       'Optimistic-lock token — read noise'],
    ['href',            'OSLC self-link (data is already in the payload)'],
    ['about',           'RDF resource identifier'],
    ['rdf:about',       'RDF about triple'],
    ['rdf:type',        'RDF type triple'],
    ['rdf:resource',    'RDF resource reference'],
  ].forEach(([pattern, reason]) => {
    console.log(`  ${red('✗')}  ${pad(pattern, 18)}${dim(reason)}`);
  });

  // ── NORMALISATION REPORT ───────────────────────────────────────────────────
  console.log('');
  console.log(bold(`  🔧  NORMALISATION PIPELINE`));
  console.log(hr());
  [
    ['HTML tag stripping',       'stripHTML=true  →  <b> <i> <p> <br> removed from values'],
    ['Empty string suppression', 'skipEmptyStrings=true  →  "" fields omitted entirely'],
    ['Namespace prefix strip',   'spi: rdf: oslc: dcterms: rdfs: removed from key paths'],
    ['URL guard',                'https?:// strings bypass dictionary  (tool-call safe)'],
    ['ISO date guard',           'YYYY-MM-DD… strings bypass dictionary'],
    ['Path-like guard',          'Strings with / or \\ bypass dictionary'],
    ['OData date convert',       '/Date(ms)/  →  ISO-8601 string'],
    ['Null field handling',      'null values emitted as token "null"'],
  ].forEach(([label, detail]) => {
    console.log(`  ${green('✔')}  ${pad(label, 26)}${dim(detail)}`);
  });

  // ── FULL WIRE FORMAT ───────────────────────────────────────────────────────
  console.log('');
  console.log(hr('═'));
  console.log(bold(`  📤  FULL LEAN WIRE FORMAT OUTPUT`));
  console.log(hr('═'));
  console.log('');

  result.encoded.split('\n').forEach((line) => {
    if (line.startsWith('### LEAN FORMAT')) {
      process.stdout.write(bold(cyan(line)) + '\n');
    } else if (line.startsWith('### DICT')) {
      process.stdout.write(bold(yellow(line)) + '\n');
    } else if (line.startsWith('### SCHEMA')) {
      process.stdout.write(bold(magenta(line)) + '\n');
    } else if (line.startsWith('### DATA')) {
      process.stdout.write(bold(blue(line)) + '\n');
    } else if (/^\*\d+=/.test(line)) {
      // DICT entry:  *0=BEDFORD
      const eq  = line.indexOf('=');
      process.stdout.write(`${yellow(line.slice(0, eq))}=${line.slice(eq + 1)}\n`);
    } else if (/^[0-9a-z]+=/.test(line)) {
      // SCHEMA entry:  0=wonum
      const eq  = line.indexOf('=');
      process.stdout.write(`${magenta(line.slice(0, eq))}=${dim(line.slice(eq + 1))}\n`);
    } else if (line.startsWith('_id:') || /\s_id:/.test(line)) {
      // DATA row — highlight _id, _p, *N pointers
      const out = line
        .replace(/(_id:\S+)/g, `${green('$1')}`)
        .replace(/(_p:\S+)/g,  `${blue('$1')}`)
        .replace(/(\*\d+)(?=\s|$)/g, `${yellow('$1')}`);
      process.stdout.write(out + '\n');
    } else {
      process.stdout.write(dim(line) + '\n');
    }
  });

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  console.log('');
  console.log(hr('═'));
  console.log(bold(green(
    `  ✅  Done.  ${bytes(savedBytes)} saved  ·  ` +
    `${pctSaved}% reduction  ·  ` +
    `${result.encodedSize.toLocaleString()} / ${result.originalSize.toLocaleString()} bytes`
  )));
  console.log(hr('═'));
  console.log('');
}

main();
