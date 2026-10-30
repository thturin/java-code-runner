# local-java-runner

A local, offline batch grader for Java assignments submitted as GitHub repos.

No AI, no external services. You run it on your own machine. For each student in
a roster spreadsheet it:

1. Confirms the student's repo is actually owned by their registered GitHub username.
2. Clones the repo.
3. Overwrites `SolutionTest.java` and `pom.xml` with the assignment's official
   copies (students can only ever affect their grade through `Solution.java` -
   editing the test file or `pom.xml` has no effect).
4. Runs `mvn clean test` inside a disposable Docker container with no network
   access and capped memory/CPU.
5. Turns the JUnit pass count into a percentage.
6. Writes one row per student to a CSV you can open in Excel or import into a
   Jupyter notebook.

## One-time setup

```bash
npm install
npm run build-sandbox   # builds the java-grading-sandbox Docker image (~1-2 min)
```

Re-run `npm run build-sandbox` only if you change
`docker/java-sandbox/pom.xml` or `Dockerfile`.

## Setting up an assignment

Each assignment is a folder under `assignments/` containing the official
`SolutionTest.java` and `pom.xml` - the exact files that get dropped into every
student's repo before grading. `assignments/example-assignment/template/`
is a working example (a trivial `add(a, b)` method) - copy that folder as a
starting point for a real assignment.

```
assignments/
  your-assignment/
    template/
      SolutionTest.java   # the official grading tests
      pom.xml              # copy docker/java-sandbox/pom.xml as a starting point
    student-template/       # what you actually hand to students - see below
    roster.xlsx               # you provide this (see below) - NOT committed to git
```

**Student-facing template repo:** `assignments/example-assignment/student-template/`
is what students actually receive - push that folder to a GitHub repo (or make
it a GitHub "template repository" so students can click "Use this template")
and share it with the class. It contains:

```
student-template/
  src/main/java/Solution.java   # starter stub - the ONLY file students edit
  src/test/java/SolutionTest.java   # identical copy of template/SolutionTest.java
  pom.xml                             # identical copy of template/pom.xml
  README.md                            # instructions for the student
  .gitignore
```

`SolutionTest.java` and `pom.xml` are plain copies of the grading template's
versions (not symlinked or generated) - if you edit the official test after
handing out the assignment, copy the updated files into `student-template/`
by hand so students see the same tests they'll be graded against. Students
may only edit `Solution.java` - the layout (package, class name `Solution`,
file paths) must stay exactly as given, since the grader overwrites files at
fixed paths and won't find a renamed/moved class.

## Spreadsheets

**Roster** (one per assignment, e.g. `assignments/your-assignment/roster.xlsx`):

| Last Name | First Name | Section | Student Id | Github Repository |
|---|---|---|---|---|
| Doe | Jane | Odd | 12345 | https://github.com/janedoe/hw1-template |

`Student Id` is optional in the roster - leave the column out (or blank) and
students are matched to the registry by first name + last name + section
instead.

**Username registry** (one shared file, reused across assignments, e.g. `registry.xlsx`):

| Last Name | First Name | Section | Student Id | Github Username |
|---|---|---|---|---|
| Doe | Jane | Odd | 12345 | janedoe |

Column headers are matched case-insensitively and ignoring spaces/punctuation,
so "Student ID" or "student_id" work too. Run `node scripts/create-sample-sheets.js`
any time to regenerate blank examples with the right headers
(`assignments/example-assignment/roster.example.xlsx` and `registry.example.xlsx`).

The grader joins the two sheets on `Student Id` - or, for roster rows with no
`Student Id`, on first name + last name + section (ignoring capitals and extra
spaces, so "Even" matches "even"). It then extracts the actual repo
owner from the `Github Repository` URL, and flags a mismatch if it doesn't
equal the registered `Github Username` - but still grades the repo either way,
so you see both signals in one pass rather than being blocked.

## Grading

Replace `your-assignment`, `roster.xlsx` and `registry.xlsx` below with your
actual assignment folder and spreadsheet filenames - these are examples, not
literal filenames to copy-paste as-is:

```bash
node src/index.js \
  --template assignments/your-assignment/template \
  --roster assignments/your-assignment/roster.xlsx \
  --registry registry.xlsx \
  --out assignments/your-assignment/results.csv
```

Optional: `--timeout <ms>` (default `60000`) - how long to let one student's
`mvn clean test` run before killing the container (catches infinite loops).

### Grading one student

Add `--student` to grade just one student. It accepts their name
(`"Jane Doe"` or `"Doe Jane"`), Student Id, or GitHub username. If the same
name is in both sections, add `--section Odd` or `--section Even`.

```bash
node src/index.js \
  --template assignments/your-assignment/template \
  --roster assignments/your-assignment/roster.xlsx \
  --registry registry.xlsx \
  --student "Jane Doe" --section Odd \
  --out assignments/your-assignment/results.csv
```

The score, failing tests and notes print in the terminal. `--out` is optional
here; when given, only that student's row in the CSV is replaced and every
other row is kept.

### Student code is kept

Each student's cloned repo is kept after grading at
`tmp/<assignment>/<last>-<first>-<section>/` (e.g.
`tmp/U1C2-Programming-Challenge/doe-jane-odd/`), with the official
`SolutionTest.java` and `pom.xml` already added. The `Code Folder` column in
the CSV gives the path. Grading a student again replaces their folder with a
fresh clone. Delete `tmp/<assignment>/` yourself when you no longer need it.
These folders contain the hidden tests, so don't share or push them.

To re-run a student's tests by hand inside the same sandbox the grader uses
(no network, and file ownership is handed back to you afterwards):

```bash
cd tmp/U1C2-Programming-Challenge/doe-jane-odd
docker run --rm --network none -v "$PWD":/workspace -w /workspace \
  java-grading-sandbox:latest \
  sh -c "mvn clean test; s=\$?; chown -R $(id -u):$(id -g) /workspace; exit \$s"
```

Plain `mvn clean test` in that folder also works, but runs the student's code
directly on your computer instead of in the sandbox.

Output CSV columns: `Last Name, First Name, Section, Student Id,
Github Repository, Expected Username, Actual Owner, Ownership Match,
Compiled, Tests Passed, Tests Total, Score (%), Notes, Code Folder`.

**Partial credit is uniform:** `Score = (tests passed / tests total) * 100`.
If some tests should count more than others, that would need per-test weights
added to `src/junitParser.js` - not implemented yet since it wasn't asked for.

## Testing it yourself with a dummy repo

1. Create a small public GitHub repo under your own account containing:
   ```
   src/main/java/Solution.java
   ```
   matching whatever template you're testing (for
   `assignments/example-assignment/template`, `Solution.java` needs an
   `add(int a, int b)` method - copy the template's own test file to see what
   it expects).
2. Copy `assignments/example-assignment/roster.example.xlsx` to `my-roster.xlsx`
   and `registry.example.xlsx` to `my-registry.xlsx`, then edit those copies
   with your own name/Student Id/GitHub username and your test repo's URL.
3. Run (this uses the exact filenames from step 2 - if you named your copies
   something else, use those names instead):
   ```bash
   node src/index.js \
     --template assignments/example-assignment/template \
     --roster my-roster.xlsx \
     --registry my-registry.xlsx \
     --out results.csv
   ```
4. Open `results.csv`.

## Project layout

```
src/
  excelReader.js      reads roster.xlsx / registry.xlsx
  github.js           parses owner/repo out of a GitHub URL
  gitClone.js          clones a student repo
  prepareSubmission.js  overwrites SolutionTest.java + pom.xml with the template's copies
  dockerRunner.js       runs mvn clean test in an isolated container
  junitParser.js        turns Maven/Surefire output into pass/fail counts + a score
  grader.js              orchestrates the above per student
  csvWriter.js            writes the results CSV
  index.js                 CLI entrypoint
docker/java-sandbox/        the grading container image (network disabled, resource-capped)
assignments/                 one folder per assignment (template + roster)
```

## Known gotcha: Docker Desktop and `/tmp`

Docker Desktop only shares certain host paths (typically your home directory)
into the VM it runs containers in - the OS temp directory (`/tmp` on Linux) is
often **not** shared, so a bind mount from there shows up empty inside the
container even though the files exist on your host. That's why student repos
are cloned into `tmp/` inside this project (`src/grader.js`'s `WORK_ROOT`)
rather than the OS temp dir. If you ever see Maven complain "no POM in this
directory" after moving this project somewhere unusual, check that the new
location is inside a path Docker Desktop is configured to share (Docker
Desktop → Settings → Resources → File sharing).
