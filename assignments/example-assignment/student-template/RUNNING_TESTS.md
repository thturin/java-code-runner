# How to Run the Tests

This guide walks through checking your work locally before you submit.
Running the tests yourself is the same check your instructor's grading tool
runs - if it passes for you, it'll pass for grading too (as long as you
haven't moved/renamed anything - see below).

## 1. Prerequisites

You need two things installed:

- **Java 17 or newer**
- **Maven**

Check what you already have by running these in a terminal:

```bash
java -version
mvn -version
```

If `java -version` shows a version below 17, or the command isn't found, you
need to install/update Java. Same for `mvn -version` and Maven.

### Installing Java 17+

- **Mac:** `brew install openjdk@17`
- **Windows:** download the installer from [Adoptium](https://adoptium.net/) (Temurin 17)
- **Linux (Debian/Ubuntu):** `sudo apt install openjdk-17-jdk`

### Installing Maven

- **Mac:** `brew install maven`
- **Windows:** download from [maven.apache.org](https://maven.apache.org/download.cgi) and follow their install guide
- **Linux (Debian/Ubuntu):** `sudo apt install maven`

## 2. Running the tests

From a terminal, `cd` into the project folder (the one containing `pom.xml`),
then run:

```bash
mvn clean test
```

The first time you run this it may take a little while as Maven downloads
dependencies (JUnit, etc.) - that's normal and only happens once.

## 3. Reading the output

Scroll to the bottom of the output. You'll see one of two things:

**Success:**
```
[INFO] BUILD SUCCESS
```
with a summary line above it like:
```
Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
```
All tests passed.

**Failure:**
```
[INFO] BUILD FAILURE
```
with a summary line showing how many tests failed, e.g.:
```
Tests run: 3, Failures: 1, Errors: 0, Skipped: 0
```
and one or more `[ERROR]` lines identifying exactly which test failed and why, e.g.:
```
[ERROR]   SolutionTest.testNegativeNumbers:18 expected: <-1> but was: <2>
```
This tells you: the test named `testNegativeNumbers`, on line 18 of
`SolutionTest.java`, expected your method to return `-1` but it actually
returned `2`. Use that to find the bug in `Solution.java`.

Your grade is `(tests passed / total tests) * 100` - so partial credit is
normal. Fix one failing test at a time and re-run `mvn clean test`.

## 4. Running just one test (optional)

Once you have multiple tests and only want to focus on one:

```bash
mvn test -Dtest=SolutionTest#testNegativeNumbers
```

## Troubleshooting

| Problem | Likely cause |
|---|---|
| `mvn: command not found` | Maven isn't installed, or isn't on your PATH. Reinstall/check step 1. |
| `[ERROR] ... package does not exist` or `cannot find symbol` | Usually a syntax error in `Solution.java`, or you renamed/moved the class. Keep the class named `Solution` in `src/main/java/Solution.java`. |
| Every test fails immediately with no `[ERROR]` detail lines, just a compile error | Your code doesn't compile - fix the syntax error Maven reports before the tests can even run. |
| `Tests run: 0` | The test file isn't being found/compiled - make sure you haven't moved or renamed `SolutionTest.java` or `pom.xml`. |

If you're stuck after checking the above, ask your instructor - include the
full output of `mvn clean test` when you do, it makes debugging much faster.
