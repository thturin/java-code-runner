import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

// Example grading test file for the "add two numbers" example assignment.
// This exact file gets copied into every student's cloned repo before
// grading, overwriting whatever they had - so editing this file has no
// effect on a student's grade.
public class SolutionTest {

    @Test
    public void testPositiveNumbers() {
        Solution s = new Solution();
        assertEquals(5, s.add(2, 3));
    }

    @Test
    public void testNegativeNumbers() {
        Solution s = new Solution();
        assertEquals(-1, s.add(2, -3));
    }

    @Test
    public void testZero() {
        Solution s = new Solution();
        assertEquals(0, s.add(0, 0));
    }
}
