'use strict';

const XLSX = require('xlsx');

// Header variants are normalized (lowercased, spaces/punctuation stripped) so
// small formatting differences in the spreadsheet ("Student ID" vs
// "Student Id" vs "student_id") don't break parsing.
function normalizeHeader(header) {
  return String(header || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ROSTER_FIELDS = {
  lastname: 'lastName',
  firstname: 'firstName',
  section: 'section',
  studentid: 'studentId',
  githubrepository: 'githubRepository',
};

const REGISTRY_FIELDS = {
  lastname: 'lastName',
  firstname: 'firstName',
  section: 'section',
  studentid: 'studentId',
  githubusername: 'githubUsername',
};

function readSheet(filePath, fieldMap, requiredFields) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows.map((row, index) => {
    const mapped = {};
    for (const [rawHeader, value] of Object.entries(row)) {
      const key = fieldMap[normalizeHeader(rawHeader)];
      if (key) mapped[key] = String(value).trim();
    }

    for (const field of requiredFields) {
      if (!mapped[field]) {
        throw new Error(
          `${filePath}: row ${index + 2} is missing a value for "${field}" ` +
          `(check the column header spelling on row 1)`
        );
      }
    }
    return mapped;
  });
}

// Expected columns: Last Name | First Name | Section | Student Id | Github Repository
// Student Id is optional - rows without one are matched to the registry by
// first name + last name + section instead.
function readRoster(filePath) {
  return readSheet(filePath, ROSTER_FIELDS, [
    'lastName', 'firstName', 'githubRepository',
  ]);
}

// Expected columns: Last Name | First Name | Section | Student Id | Github Username
function readRegistry(filePath) {
  return readSheet(filePath, REGISTRY_FIELDS, ['githubUsername']);
}

module.exports = { readRoster, readRegistry };
