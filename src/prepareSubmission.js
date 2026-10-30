'use strict';

const fs = require('fs').promises;
const path = require('path');

const TEST_RELATIVE_PATH = path.join('src', 'test', 'java', 'SolutionTest.java');
const POM_RELATIVE_PATH = 'pom.xml';
const SOLUTION_RELATIVE_PATH = path.join('src', 'main', 'java', 'Solution.java');

// Overwrites the grading-critical files in a freshly cloned student repo with
// the instructor's canonical copies from the assignment template, so a
// student can't affect their own grade by editing the test file or pom.xml.
// The student's own src/main/java/Solution.java is never written to.
async function injectTemplateFiles(repoDir, templateDir) {
  const testSrc = path.join(templateDir, 'SolutionTest.java');
  const pomSrc = path.join(templateDir, 'pom.xml');

  const testDest = path.join(repoDir, TEST_RELATIVE_PATH);
  const pomDest = path.join(repoDir, POM_RELATIVE_PATH);

  await fs.mkdir(path.dirname(testDest), { recursive: true });
  await fs.copyFile(testSrc, testDest);
  await fs.copyFile(pomSrc, pomDest);
}

async function studentFileExists(repoDir) {
  try {
    await fs.access(path.join(repoDir, SOLUTION_RELATIVE_PATH));
    return true;
  } catch {
    return false;
  }
}

module.exports = { injectTemplateFiles, studentFileExists };
