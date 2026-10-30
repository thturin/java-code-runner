'use strict';

// Parses `mvn clean test` / Surefire stdout into structured pass/fail counts.
// (Same approach as edu-platform's dockerExecutionService.js parseJUnitOutput.)
function parseJUnitOutput(output) {
  const results = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    skipped: 0,
    details: [],
  };

  // "Tests run: X, Failures: Y, Errors: Z, Skipped: W"
  const summaryMatch = output.match(
    /Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/
  );

  if (summaryMatch) {
    results.totalTests = parseInt(summaryMatch[1], 10);
    results.failed = parseInt(summaryMatch[2], 10);
    results.errors = parseInt(summaryMatch[3], 10);
    results.skipped = parseInt(summaryMatch[4], 10);
    results.passed = results.totalTests - results.failed - results.errors - results.skipped;
  }

  // Both exceptions and assertion failures show up as [ERROR] lines, e.g.:
  //   [ERROR]   SolutionTest.testFoo:42 » ArrayIndexOutOfBounds ...
  //   [ERROR]   SolutionTest.testFoo:42 expected:<5> but was:<3>
  const errorLines = output.match(/\[ERROR\]\s+SolutionTest\.\w+:\d+.+/g) || [];
  results.details = errorLines.map((line) => line.replace(/\[ERROR\]\s+/, '').trim());

  return results;
}

// Uniform partial credit: percentage of tests that passed. Returns null when
// the project never got as far as running any tests (e.g. it didn't compile)
// so callers can tell "0% because 0 of N tests passed" apart from "no score".
function scorePercent(testResults) {
  if (!testResults || testResults.totalTests === 0) return null;
  return Math.round((testResults.passed / testResults.totalTests) * 10000) / 100;
}

module.exports = { parseJUnitOutput, scorePercent };
