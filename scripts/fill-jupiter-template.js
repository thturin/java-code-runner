'use strict';
// Copies a Jupiter assignment template and fills in each student's Score
// (the percentage from results.csv) and Comment (the Notes from results.csv).
// The template itself is never changed.
//
// Students are matched by the Student Id in "Last, First (ID)". If the id
// isn't in results.csv, they're matched by first + last name instead.
// Students not in results.csv at all get a 0 and the comment "No submission".
//
// Usage:
//   node scripts/fill-jupiter-template.js \
//     --template Even-Template.csv \
//     --results assignments/U1C3-Programming-Challenge/results.csv \
//     --out assignments/U1C3-Programming-Challenge/Jupiter-Even.csv

const fs = require('fs');
const path = require('path');
const { parseCsv, csvEscape } = require('../src/csvWriter');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  return args;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const args = parseArgs(process.argv.slice(2));
if (!args.template || !args.results || !args.out) {
  console.log('Usage: node scripts/fill-jupiter-template.js --template <Jupiter template.csv> --results <results.csv> --out <filled copy.csv>');
  process.exit(1);
}
if (path.resolve(args.out) === path.resolve(args.template)) {
  console.error('--out must be a different file from --template, so the template is kept as is.');
  process.exit(1);
}

// --- results.csv lookups ---
const [header, ...rows] = parseCsv(fs.readFileSync(args.results, 'utf8'));
const results = rows
  .filter((cells) => cells.some((c) => c !== ''))
  .map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] || ''])));

const byId = new Map();
const byName = new Map(); // null = more than one student with this name
for (const r of results) {
  if (r['Student Id']) byId.set(r['Student Id'].trim(), r);
  const key = `${normalize(r['First Name'])}|${normalize(r['Last Name'])}`;
  byName.set(key, byName.has(key) ? null : r);
}

// --- fill the template, keeping every non-student line exactly as it was ---
const STUDENT_ROW = /^"(.+), (.+) \((\d+)\)"/;
const used = new Set();
const filled = [];
const skipped = [];

const lines = fs.readFileSync(args.template, 'utf8').split('\n');
const output = lines.map((line) => {
  const m = line.match(STUDENT_ROW);
  if (!m) return line;
  const [, last, first, id] = m;

  let result = byId.get(id);
  let how = 'id';
  if (!result) {
    result = byName.get(`${normalize(first)}|${normalize(last)}`);
    how = 'name';
  }
  if (!result) {
    skipped.push(`${first} ${last} (${id})`);
    return [`${last}, ${first} (${id})`, 0, 'No submission'].map(csvEscape).join(',');
  }

  used.add(result);
  filled.push({ name: `${first} ${last}`, how, score: result['Score (%)'] });
  // no score in results.csv (e.g. repo not found) -> 0 in Jupiter
  return [`${last}, ${first} (${id})`, result['Score (%)'] || 0, result['Notes']].map(csvEscape).join(',');
});

fs.writeFileSync(args.out, output.join('\n'), 'utf8');

console.log(`Wrote ${args.out}`);
console.log(`  Filled ${filled.length} student(s): ${filled.filter((f) => f.how === 'id').length} by Student Id, ${filled.filter((f) => f.how === 'name').length} by name`);
for (const f of filled.filter((f) => f.score === '')) {
  console.log(`  - ${f.name}: matched, but results.csv has no score - given 0 (see Comment)`);
}
if (skipped.length) {
  console.log(`  ${skipped.length} student(s) not in results.csv - given 0, "No submission":`);
  for (const s of skipped) console.log(`    - ${s}`);
}
const unused = results.filter((r) => !used.has(r));
if (unused.length) {
  console.log(`  ${unused.length} results.csv row(s) not in this template:`);
  for (const r of unused) console.log(`    - ${r['First Name']} ${r['Last Name']} (${r['Section']}${r['Student Id'] ? `, ${r['Student Id']}` : ''})`);
}
