'use strict';

const path = require('path');
const fs = require('fs').promises;

const { readRegistry } = require('./excelReader');
const { parseGithubUrl, toCloneUrl } = require('./github');
const { cloneRepo, removeDir } = require('./gitClone');
const { injectTemplateFiles, studentFileExists } = require('./prepareSubmission');
const { ensureImageExists, runMavenInContainer } = require('./dockerRunner');
const { parseJUnitOutput, scorePercent } = require('./junitParser');

// Docker Desktop only shares certain host paths (typically the user's home
// directory) into the VM it runs containers in - the OS temp dir (/tmp on
// Linux) is often NOT shared, so a bind mount from os.tmpdir() shows up as an
// empty directory inside the container even though the files exist on the
// host. Using a folder inside the project itself avoids that entirely.
//
// Each student's code is kept (not deleted) after grading, at
// tmp/<assignment>/<last>-<first>-<section>/, so it can be re-tested by hand.
const WORK_ROOT = path.join(__dirname, '..', 'tmp');

function blankResult(student) {
  return {
    lastName: student.lastName,
    firstName: student.firstName,
    section: student.section || '',
    studentId: student.studentId,
    githubRepository: student.githubRepository,
    expectedUsername: '',
    actualOwner: '',
    ownershipMatch: '',
    compiled: '',
    testsPassed: '',
    testsTotal: '',
    score: '',
    notes: '',
    codeFolder: '',
  };
}

// Lowercases, trims, and collapses inner whitespace so "Even " matches "even"
// and "Mary  Ann" matches "mary ann".
function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function nameSectionKey(person) {
  return [person.firstName, person.lastName, person.section].map(normalize).join('|');
}

// Turns text into a safe folder name: "Doe, Jane" -> "doe-jane".
function folderSafe(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function studentFolderName(student) {
  return [student.lastName, student.firstName, student.section]
    .map(folderSafe)
    .filter(Boolean)
    .join('-') || 'student';
}

// Finds the roster rows a --student value refers to. It can be the student's
// name ("Jane Doe" or "Doe Jane"), Student Id, or GitHub username (the owner
// in their repo URL, or their username in the registry). When the roster has
// no Student Id column, the id is looked up in the registry. --section
// narrows the matches to one section.
function selectStudents(roster, query, section, registryIndex) {
  const q = normalize(String(query).replace(/,/g, ' '));
  const matches = roster.filter((student) => {
    const first = normalize(student.firstName);
    const last = normalize(student.lastName);
    const parsed = parseGithubUrl(student.githubRepository);
    const { entry } = registryIndex ? findRegistryEntry(student, registryIndex) : {};
    const ids = [student.studentId, entry && entry.studentId].filter(Boolean).map(normalize);
    const usernames = [parsed && parsed.owner, entry && entry.githubUsername].filter(Boolean).map(normalize);
    return (
      q === `${first} ${last}` ||
      q === `${last} ${first}` ||
      ids.includes(q) ||
      usernames.includes(q)
    );
  });
  if (!section) return matches;
  return matches.filter((student) => normalize(student.section) === normalize(section));
}

// Builds lookups by Student Id and by first name + last name + section.
// A name+section key shared by more than one registry row is marked
// ambiguous (null) so it can't silently match the wrong student.
function indexRegistry(registry) {
  const byId = new Map();
  const byNameSection = new Map();
  for (const entry of registry) {
    if (entry.studentId) byId.set(entry.studentId, entry);
    const key = nameSectionKey(entry);
    byNameSection.set(key, byNameSection.has(key) ? null : entry);
  }
  return { byId, byNameSection };
}

// Roster rows with a Student Id are matched by it; rows without one are
// matched by first name + last name + section.
function findRegistryEntry(student, registryIndex) {
  if (student.studentId) {
    const entry = registryIndex.byId.get(student.studentId);
    if (entry) return { entry };
    return { error: `No entry found in username registry for Student Id ${student.studentId}` };
  }
  const label = `${student.firstName} ${student.lastName} (Section ${student.section || 'blank'})`;
  const entry = registryIndex.byNameSection.get(nameSectionKey(student));
  if (entry) return { entry };
  if (entry === null) {
    return { error: `More than one username registry entry matches ${label}` };
  }
  return { error: `No entry found in username registry for ${label}` };
}

function appendNote(result, note) {
  result.notes = [result.notes, note].filter(Boolean).join('; ');
}

async function gradeOneStudent(student, registryIndex, templateDir, timeout, workDir) {
  console.log("..........grading student tests..........");
  const result = blankResult(student);

  // --- Ownership check ---
  console.log("..........confirming ownership.........");
  const { entry: registryEntry, error } = findRegistryEntry(student, registryIndex);
  if (!registryEntry) {
    appendNote(result, error);
    return result;
  }
  result.expectedUsername = registryEntry.githubUsername;
  if (!result.studentId) result.studentId = registryEntry.studentId || '';
  result.codeFolder = path.relative(path.join(__dirname, '..'), workDir);

  const parsedUrl = parseGithubUrl(student.githubRepository);
  if (!parsedUrl) {
    appendNote(result, `Could not parse a GitHub owner/repo out of "${student.githubRepository}"`);
    return result;
  }
  result.actualOwner = parsedUrl.owner;
  result.ownershipMatch =
    parsedUrl.owner.toLowerCase() === registryEntry.githubUsername.toLowerCase() ? 'YES' : 'NO';

  if (result.ownershipMatch === 'NO') {
    appendNote(result, `Repo owner "${parsedUrl.owner}" does not match registered username "${registryEntry.githubUsername}"`);
  }

  // --- Clone + grade. Still runs even on an ownership mismatch, so a mismatch
  // shows up as a flag on the row rather than skipping the student entirely.
  // Any folder left from an earlier run is cleared first so the code is a
  // fresh clone, not old and new files mixed together. ---
  console.log("..........cloning repo into the student's folder.........");
  try {
    await removeDir(workDir);
    await fs.mkdir(path.dirname(workDir), { recursive: true });
    const cloneUrl = toCloneUrl(student.githubRepository);
    await cloneRepo(cloneUrl, workDir);

    const hasSolution = await studentFileExists(workDir);
    if (!hasSolution) {
      appendNote(result, 'src/main/java/Solution.java not found in repo');
      result.score = 0;
      return result;
    }

    console.log("..........adds teacher pom.xml and solutionTest.java to student's cloned repo ..........");
    await injectTemplateFiles(workDir, templateDir);

    const { timedOut, output } = await runMavenInContainer(workDir, { timeout });

    if (timedOut) {
      result.testsPassed = 0;
      result.testsTotal = 0;
      result.score = 0;
      appendNote(result, `Timed out after ${timeout}ms (likely an infinite loop)`);
      return result;
    }

    const testResults = parseJUnitOutput(output);
    const score = scorePercent(testResults);

    if (score === null) {
      result.compiled = 'NO';
      result.testsPassed = 0;
      result.testsTotal = 0;
      result.score = 0;
      appendNote(result, 'Build did not produce any test results - check Solution.java for syntax/signature errors');
    } else {
      result.compiled = 'YES';
      result.testsPassed = testResults.passed;
      result.testsTotal = testResults.totalTests;
      result.score = score;
      if (testResults.details.length) appendNote(result, testResults.details.join(' | '));
    }
  } catch (err) {
    appendNote(result, `Error: ${err.message}`);
    if (result.score === '') result.score = 0;
  }

  return result;
}

// The assignment folder name, e.g. "U1C2-Programming-Challenge" for
// assignments/U1C2-Programming-Challenge/template.
function assignmentNameFor(templateDir) {
  const base = path.basename(templateDir);
  return base === 'template' ? path.basename(path.dirname(templateDir)) : base;
}

// students: the roster rows to grade - the whole roster, or just the
// student(s) picked with --student.
async function gradeAssignment({ templateDir, students, registryPath, timeout = 60000, onProgress }) {
  await ensureImageExists();

  // combine roster and registry by Student Id, or by name + section when
  // the roster has no Student Id
  const registry = readRegistry(registryPath);
  const registryIndex = indexRegistry(registry);
  const assignmentDir = path.join(WORK_ROOT, assignmentNameFor(templateDir));

  const results = [];
  const usedFolders = new Set();
  for (let i = 0; i < students.length; i += 1) {
    const student = students[i];
    if (onProgress) onProgress(i + 1, students.length, student);

    // Two students with the same name in the same section get "-2", "-3"...
    const baseFolder = studentFolderName(student);
    let folder = baseFolder;
    for (let n = 2; usedFolders.has(folder); n += 1) folder = `${baseFolder}-${n}`;
    usedFolders.add(folder);

    const workDir = path.join(assignmentDir, folder);
    const result = await gradeOneStudent(student, registryIndex, templateDir, timeout, workDir);
    results.push(result);
  }

  return results;
}

module.exports = {
  gradeAssignment,
  indexRegistry,
  findRegistryEntry,
  selectStudents,
  studentFolderName,
  assignmentNameFor,
};
