# Assignment: Example Assignment

## What to do

Implement the method(s) in `src/main/java/Solution.java`. That is the **only**
file you should edit.

Do not rename, move, or edit any other file (`SolutionTest.java`, `pom.xml`,
the package structure). Grading works by replacing those files with the
official copies before running your submission, so changes to them have no
effect on your grade - and if you rename or move `Solution.java` itself,
grading won't be able to find it and you'll receive a 0.

## Checking your work

You can run the official tests yourself at any time:

```bash
mvn clean test
```

This requires Java 17+ and Maven installed locally. The output will tell you
exactly which tests pass and fail - use that to debug before submitting.

**New to `mvn`, or not sure what's installed?** See [RUNNING_TESTS.md](./RUNNING_TESTS.md)
for setup steps, how to read the test output, and troubleshooting.

## Submitting

1. Push your completed code to your own GitHub repository:

   ```bash
   git add .
   git commit -m "Complete assignment"
   git push
   ```

   Run these from inside the project folder (the one with `pom.xml` in it).
   If `git push` asks you to log in, use the same GitHub account you've
   registered with your instructor.

2. Add your repository's URL to the class submission sheet, using the exact
   GitHub account you've registered with your instructor.

Your grade is based on the percentage of official tests that pass.

**Note:** make sure your work is actually pushed before you submit the URL -
grading pulls whatever is on GitHub, not what's still only on your computer.
Running `mvn clean test` one more time right after `git push` (in a fresh
clone, if you want to be extra sure) confirms what was actually submitted.
