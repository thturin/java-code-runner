'use strict';

const fs = require('fs').promises;

const COLUMNS = [
  ['lastName', 'Last Name'],
  ['firstName', 'First Name'],
  ['section', 'Section'],
  ['studentId', 'Student Id'],
  ['githubRepository', 'Github Repository'],
  ['expectedUsername', 'Expected Username'],
  ['actualOwner', 'Actual Owner'],
  ['ownershipMatch', 'Ownership Match'],
  ['compiled', 'Compiled'],
  ['testsPassed', 'Tests Passed'],
  ['testsTotal', 'Tests Total'],
  ['score', 'Score (%)'],
  ['notes', 'Notes'],
  ['codeFolder', 'Code Folder'],
];

function csvEscape(value) {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Splits CSV text into rows of fields, handling quoted fields that contain
// commas, quotes ("") or newlines - the same shapes csvEscape produces.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function rowKey(row) {
  return ['lastName', 'firstName', 'section']
    .map((k) => String(row[k] || '').trim().toLowerCase().replace(/\s+/g, ' '))
    .join('|');
}

// Used by --student: replaces the matching students' rows (same last name,
// first name and section) in an existing results CSV and leaves every other
// row alone. Students not already in the file are added at the end. If the
// file doesn't exist yet, it's created with just these rows.
async function updateResultsCsv(results, outPath) {
  let existing = [];
  try {
    const [header, ...rows] = parseCsv(await fs.readFile(outPath, 'utf8'));
    const keys = header.map((label) => (COLUMNS.find(([, l]) => l === label) || [label])[0]);
    existing = rows
      .filter((cells) => cells.some((c) => c !== ''))
      .map((cells) => Object.fromEntries(keys.map((k, i) => [k, cells[i]])));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const updated = new Map(results.map((r) => [rowKey(r), r]));
  const merged = existing.map((row) => {
    const key = rowKey(row);
    if (!updated.has(key)) return row;
    const replacement = updated.get(key);
    updated.delete(key);
    return replacement;
  });
  merged.push(...updated.values());

  await writeResultsCsv(merged, outPath);
}

async function writeResultsCsv(results, outPath) {
  console.log("..........Writing results to CSV..........");
  const header = COLUMNS.map(([, label]) => csvEscape(label)).join(',');
  const rows = results.map((row) => COLUMNS.map(([key]) => csvEscape(row[key])).join(','));
  const csv = [header, ...rows].join('\n') + '\n';
  await fs.writeFile(outPath, csv, 'utf8');
  console.log("----------------------------");
}

module.exports = { writeResultsCsv, updateResultsCsv, parseCsv, csvEscape };
