#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { gradeAssignment, selectStudents, assignmentNameFor, indexRegistry } = require('./grader');
const { readRoster, readRegistry } = require('./excelReader');
const { writeResultsCsv, updateResultsCsv } = require('./csvWriter');

const PROJECT_ROOT = path.join(__dirname, '..');

function checkKind(label, resolvedPath, kind) {
  if (kind === 'dir' && !fs.statSync(resolvedPath).isDirectory()) {
    console.error(`\n${label} should be a directory, but this is a file: ${resolvedPath}\n`);
    process.exit(1);
  }
  if (kind === 'file' && !fs.statSync(resolvedPath).isFile()) {
    console.error(`\n${label} should be a file, but this is a directory: ${resolvedPath}\n`);
    process.exit(1);
  }
  return resolvedPath;
}

// Resolves a --template/--roster/--registry argument to an existing path,
// trying it relative to the current working directory first, then relative
// to the project root - so a relative path works the same whether you run
// this command from the project root or from somewhere else. Absolute paths
// pass through unchanged. Exits with a clear message (showing every location
// it tried) if the path doesn't exist either way, instead of a raw ENOENT
// stack trace from deep inside some library.
function resolveRequiredPath(label, inputPath, kind) {
  const fromCwd = path.resolve(inputPath);
  if (fs.existsSync(fromCwd)) return checkKind(label, fromCwd, kind);

  const fromRoot = path.resolve(PROJECT_ROOT, inputPath);
  if (fromRoot !== fromCwd && fs.existsSync(fromRoot)) return checkKind(label, fromRoot, kind);

  console.error(`\nCan't find the ${label}: "${inputPath}"`);
  console.error('Looked in:');
  console.error(`  - ${fromCwd}  (relative to your current directory: ${process.cwd()})`);
  if (fromRoot !== fromCwd) {
    console.error(`  - ${fromRoot}  (relative to the project root)`);
  }
  console.error('Double check the path, or pass an absolute path to be safe.\n');
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      args[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function printUsage() {
  console.log(`
Usage:
  node src/index.js --template <dir> --roster <roster.xlsx> --registry <registry.xlsx> --out <results.csv> [--timeout <ms>]
  node src/index.js --template <dir> --roster <roster.xlsx> --registry <registry.xlsx> --section <odd|even> --out <results.csv>
  node src/index.js --template <dir> --roster <roster.xlsx> --registry <registry.xlsx> --student "<name>" [--section <odd|even>] [--out <results.csv>]

Required:
  --template   Assignment template folder (must contain SolutionTest.java and pom.xml)
  --roster     Roster Excel sheet for this assignment
               (columns: Last Name, First Name, Section, Student Id, Github Repository)
               Student Id is optional - without it, students are matched to the
               registry by first name + last name + section
  --registry   GitHub username registry Excel sheet (reusable across assignments)
               (columns: Last Name, First Name, Section, Student Id, Github Username)
  --out        Where to write the results CSV (optional with --student)

Optional:
  --timeout    Per-student grading timeout in milliseconds (default: 60000)
  --student    Grade only this student. Accepts their name ("Jane Doe" or
               "Doe Jane"), Student Id, or GitHub username. With --out, only
               their row in the results CSV is replaced - other rows are kept.
  --section    Grade only the students in this section (Odd/Even). Only their
               rows in the results CSV are replaced - the other section's rows
               are kept. With --student: picks the student in this section
               when the same name is in both.

Each student's code is kept after grading in
  tmp/<assignment>/<last>-<first>-<section>/
with the official SolutionTest.java and pom.xml already added, so you can
re-run their tests by hand. Running the grader again replaces the folder with
a fresh clone.

Before running for the first time (and after any pom.xml/Dockerfile change):
  npm install
  npm run build-sandbox
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.template || !args.roster || !args.registry || (!args.out && !args.student)) {
    printUsage();
    process.exit(1);
  }

  const templateDir = resolveRequiredPath('--template directory', args.template, 'dir');
  const rosterPath = resolveRequiredPath('--roster file', args.roster, 'file');
  const registryPath = resolveRequiredPath('--registry file', args.registry, 'file');
  // doesn't need to exist yet - this is written at the end
  const outPath = args.out ? path.resolve(args.out) : null;
  const timeout = args.timeout ? parseInt(args.timeout, 10) : 60000;

  if (!fs.existsSync(path.join(templateDir, 'SolutionTest.java'))) {
    console.error(`\nSolutionTest.java not found inside the template directory: ${templateDir}\n`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(templateDir, 'pom.xml'))) {
    console.error(`\npom.xml not found inside the template directory: ${templateDir}\n`);
    process.exit(1);
  }

  const roster = readRoster(rosterPath);
  let students = roster;
  if (args.student) {
    const registryIndex = indexRegistry(readRegistry(registryPath));
    students = selectStudents(roster, args.student, args.section, registryIndex);
    if (students.length === 0) {
      const where = args.section ? ` in section ${args.section}` : '';
      console.error(`\nNo student matching "${args.student}"${where} in the roster.`);
      console.error('Use their name ("Jane Doe"), Student Id, or GitHub username.\n');
      process.exit(1);
    }
    if (students.length > 1) {
      console.error(`\n"${args.student}" matches more than one student:`);
      for (const s of students) {
        console.error(`  - ${s.firstName} ${s.lastName}, Section ${s.section || 'blank'}`);
      }
      console.error('Add --section to pick one.\n');
      process.exit(1);
    }
  } else if (args.section) {
    const wanted = args.section.trim().toLowerCase();
    students = roster.filter((s) => String(s.section || '').trim().toLowerCase() === wanted);
    if (students.length === 0) {
      const sections = [...new Set(roster.map((s) => s.section || 'blank'))].join(', ');
      console.error(`\nNo students in section "${args.section}" in the roster. Sections found: ${sections}\n`);
      process.exit(1);
    }
  }

  console.log(`Template:  ${templateDir}`);
  console.log(`Roster:    ${rosterPath}`);
  console.log(`Registry:  ${registryPath}`);
  if (args.student) {
    const s = students[0];
    console.log(`Student:   ${s.firstName} ${s.lastName}, Section ${s.section || 'blank'}`);
  } else if (args.section) {
    console.log(`Section:   ${args.section} (${students.length} student(s))`);
  }
  console.log(`Output:    ${outPath || '(terminal only)'}\n`);

  const results = await gradeAssignment({
    templateDir,
    students,
    registryPath,
    timeout,
    onProgress: (i, total, student) => {
      const tag = student.studentId || `Section ${student.section || 'blank'}`;
      console.log(`[${i}/${total}] Grading ${student.firstName} ${student.lastName} (${tag})...`);
    },
  });

  if (outPath && (args.student || args.section)) await updateResultsCsv(results, outPath);
  else if (outPath) await writeResultsCsv(results, outPath);

  if (args.student) {
    const r = results[0];
    console.log(`\n${r.firstName} ${r.lastName}, Section ${r.section || 'blank'}`);
    console.log(`  Score:        ${r.score === '' ? '-' : `${r.score}%`}`);
    console.log(`  Tests passed: ${r.testsPassed === '' ? '-' : `${r.testsPassed} / ${r.testsTotal}`}`);
    console.log(`  Compiled:     ${r.compiled || '-'}`);
    console.log(`  Ownership:    ${r.ownershipMatch || '-'}`);
    if (r.notes) {
      console.log('  Notes:');
      for (const note of r.notes.split(/; | \| /)) console.log(`    - ${note}`);
    }
    if (r.codeFolder) console.log(`  Code kept in: ${r.codeFolder}`);
    if (outPath) console.log(`\nUpdated this student's row in ${outPath}`);
  } else if (args.section) {
    console.log(`\nGraded ${results.length} student(s) in section ${args.section}. Updated their rows in ${outPath}`);
    console.log(`Student code kept in tmp/${assignmentNameFor(templateDir)}/`);
  } else {
    console.log(`\nGraded ${results.length} student(s). Results written to ${outPath}`);
    console.log(`Student code kept in tmp/${assignmentNameFor(templateDir)}/`);
  }

  const mismatches = results.filter((r) => r.ownershipMatch === 'NO');
  if (mismatches.length) {
    console.log(`\n⚠ ${mismatches.length} ownership mismatch(es):`);
    for (const m of mismatches) {
      console.log(`  - ${m.firstName} ${m.lastName} (${m.studentId || `Section ${m.section}`}): expected "${m.expectedUsername}", repo owned by "${m.actualOwner}"`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
