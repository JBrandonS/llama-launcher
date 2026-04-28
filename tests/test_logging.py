import unittest
import sys
from unittest.mock import patch, MagicMock
import logging
import io

# Import components from the project structure
from llama_launcher.exceptions import TransientProcessError
from llama_launcher.logger import get_logger, setup_logger


class TestLoggingAndExceptions(unittest.TestCase):

    def setUp(self):
        """Set up stream mocks and reconfigure logger before each test."""
        self.mock_stdout = io.StringIO()
        self.mock_stderr = io.StringIO()

        # Patch sys.stdout and sys.stderr to capture output
        self.stdout_patcher = patch('sys.stdout', self.mock_stdout)
        self.stderr_patcher = patch('sys.stderr', self.mock_stderr)

        self.stdout_mock = self.stdout_patcher.start()
        self.stderr_mock = self.stderr_patcher.start()

        # Reconfigure logger to verbose so INFO/WARNING are captured
        setup_logger(verbose=True)
        logging.getLogger("test_logger").setLevel(logging.DEBUG)

    def tearDown(self):
        """Clean up stream mocks after each test."""
        self.stdout_patcher.stop()
        self.stderr_patcher.stop()

    def test_1_info_to_stdout(self):
        """Test 1: Assert that a call to logger.info("Success") prints to standard output."""
        test_logger = get_logger(name="test_logger")
        test_logger.info("Success: Operation completed.")

        output = self.mock_stdout.getvalue()
        self.assertIn('INFO', output)
        self.assertIn('Success: Operation completed.', output)
        self.assertNotIn('ERROR', output)

    def test_2_error_to_stderr(self):
        """Test 2: Assert that a call to logger.error("Failure") prints to standard error."""
        test_logger = get_logger(name="test_logger")
        test_logger.error("Failure: Fatal process issue.")

        output = self.mock_stderr.getvalue()
        self.assertIn('ERROR', output)
        self.assertIn('Failure: Fatal process issue.', output)
        self.assertNotIn('INFO', output)

    def test_3_transient_process_error_logging(self):
        """Test 3: Assert that an intentional TransientProcessError is caught and logged with the appropriate level (WARNING)."""
        test_logger = get_logger(name="test_logger")
        try:
            raise TransientProcessError("External service timed out.")
        except TransientProcessError as e:
            test_logger.warning(f"Transient error encountered: {e}", extra_data={"error_type": "Transient", "exception": str(e)})

        # Check stderr because WARNING goes to stderr (human-readable format)
        output = self.mock_stderr.getvalue()
        self.assertIn('WARNING', output)
        self.assertIn('Transient error encountered: External service timed out.', output)
        # extra_data attaches to record but human-readable format doesn't render it


if __name__ == '__main__':
    unittest.main()
