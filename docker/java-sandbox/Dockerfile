# Sandbox image used to run one student's Maven/JUnit test suite in isolation.
# Network is disabled at container-run time (see src/dockerRunner.js), so every
# dependency this image will ever need must be pre-downloaded into the Maven
# cache (~/.m2) at BUILD time, while the build itself still has internet access.
FROM eclipse-temurin:17-jdk-alpine

RUN apk add --no-cache maven

WORKDIR /workspace

# This pom.xml is a throwaway copy used only to warm the Maven cache during
# the image build. The real pom.xml + test file are mounted in at grading
# time by src/dockerRunner.js (see ../../assignments/*/template).
COPY pom.xml /tmp/pom.xml

# A dummy source + test pair forces Surefire to resolve every transitive
# dependency it needs (JUnit platform launcher, console reporter, etc.) -
# just listing junit-jupiter as a dependency isn't enough to pull those in.
RUN mkdir -p /tmp/src/main/java /tmp/src/test/java && \
    echo 'public class Dummy {}' > /tmp/src/main/java/Dummy.java && \
    echo 'import org.junit.jupiter.api.Test; import static org.junit.jupiter.api.Assertions.*; public class DummyTest { @Test public void test() { assertTrue(true); } }' > /tmp/src/test/java/DummyTest.java

# Actually run the tests once so every plugin/dependency Maven touches ends
# up cached, then throw the scratch project away to keep the image small.
RUN cd /tmp && mvn clean test && cd / && rm -rf /tmp/*

# Build: npm run build-sandbox
#   (equivalent to: docker build -t java-grading-sandbox:latest ./docker/java-sandbox)
# Rebuild whenever docker/java-sandbox/pom.xml's dependencies change.
