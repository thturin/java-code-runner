'use strict';
// Generates blank, correctly-headed roster.xlsx and registry.xlsx files you
// can open and fill in with real data.
// Usage: node scripts/create-sample-sheets.js

const path = require('path');
const XLSX = require('xlsx');

const rosterRows = [
  { 'Last Name': 'Doe', 'First Name': 'Jane', 'Section': 'Odd', 'Student Id': '12345', 'Github Repository': 'https://github.com/janedoe/hw1-template' },
];

const registryRows = [
  { 'Last Name': 'Doe', 'First Name': 'Jane', 'Section': 'Odd', 'Student Id': '12345', 'Github Username': 'janedoe' },
];

function writeSheet(rows, outPath) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  XLSX.writeFile(workbook, outPath);
  console.log(`Wrote ${outPath}`);
}

const dir = path.join(__dirname, '..', 'assignments', 'example-assignment');
writeSheet(rosterRows, path.join(dir, 'roster.example.xlsx'));
writeSheet(registryRows, path.join(__dirname, '..', 'registry.example.xlsx'));
