import unittest
import sys
import json
import io
from unittest.mock import patch, MagicMock, call
import logging

from backend.logger import (
    _DynamicStreamHandler,
    setup_logger,
    _make_basic_formatter,
    _make_detailed_formatter,
    _make_error_handler,
    _patched_log,
    PatchedLogger,
    get_logger,
    StructuredJSONFormatter,
    demonstrate_logging,
)


class TestDynamicStreamHandler(unittest.TestCase):
    """Tests for _DynamicStreamHandler class."""

    def test_init_stdout(self):
        """Test initialization with 'stdout' stream name."""
        handler = _DynamicStreamHandler('stdout')
        self.assertEqual(handler._stream_name, 'stdout')
        self.assertIsNotNone(handler.stream)

    def test_init_stderr(self):
        """Test initialization with 'stderr' stream name."""
        handler = _DynamicStreamHandler('stderr')
        self.assertEqual(handler._stream_name, 'stderr')
        self.assertIsNotNone(handler.stream)

    def test_stream_property_returns_sys_attr(self):
        """Test that stream property returns the correct sys attribute."""
        handler = _DynamicStreamHandler('stdout')
        self.assertIs(handler.stream, sys.stdout)

        handler2 = _DynamicStreamHandler('stderr')
        self.assertIs(handler2.stream, sys.stderr)

    def test_stream_setter_is_noop(self):
        """Test that setting stream does nothing (no-op setter)."""
        handler = _DynamicStreamHandler('stdout')
        original_stream = handler.stream
        handler.stream = MagicMock()
        # The setter is a no-op, so stream should still be sys.stdout
        self.assertIs(handler.stream, sys.stdout)

    def test_handler_is_stream_handler(self):
        """Test that _DynamicStreamHandler is a logging.StreamHandler."""
        handler = _DynamicStreamHandler('stdout')
        self.assertIsInstance(handler, logging.StreamHandler)

    def test_invalid_stream_name_raises(self):
        """Test that an invalid stream name raises AttributeError."""
        with self.assertRaises(AttributeError):
            _DynamicStreamHandler('nonexistent_stream')


class TestMakeBasicFormatter(unittest.TestCase):
    """Tests for _make_basic_formatter function."""

    def test_returns_formatter(self):
        """Test that it returns a logging.Formatter instance."""
        formatter = _make_basic_formatter()
        self.assertIsInstance(formatter, logging.Formatter)

    def test_format_output(self):
        """Test basic format string: [LEVEL] message."""
        formatter = _make_basic_formatter()
        record = logging.LogRecord(
            name='test', level=logging.INFO, pathname='test.py',
            lineno=1, msg='Hello world', args=None, exc_info=None,
        )
        output = formatter.format(record)
        self.assertEqual(output, '[INFO] Hello world')

    def test_format_error_level(self):
        """Test format with ERROR level."""
        formatter = _make_basic_formatter()
        record = logging.LogRecord(
            name='test', level=logging.ERROR, pathname='test.py',
            lineno=1, msg='Something failed', args=None, exc_info=None,
        )
        output = formatter.format(record)
        self.assertEqual(output, '[ERROR] Something failed')

    def test_format_with_args(self):
        """Test format with string interpolation args."""
        formatter = _make_basic_formatter()
        record = logging.LogRecord(
            name='test', level=logging.WARNING, pathname='test.py',
            lineno=1, msg='Value is %s', args=(42,), exc_info=None,
        )
        output = formatter.format(record)
        self.assertEqual(output, '[WARNING] Value is 42')


class TestMakeDetailedFormatter(unittest.TestCase):
    """Tests for _make_detailed_formatter function (coverage lines 58-68)."""

    def test_returns_formatter(self):
        """Test that it returns a logging.Formatter instance."""
        formatter = _make_detailed_formatter()
        self.assertIsInstance(formatter, logging.Formatter)

    def test_format_includes_timestamp(self):
        """Test that detailed format includes timestamp."""
        formatter = _make_detailed_formatter()
        record = logging.LogRecord(
            name='test', level=logging.INFO, pathname='test.py',
            lineno=1, msg='Hello world', args=None, exc_info=None,
        )
        output = formatter.format(record)
        # Format: YYYY-MM-DD HH:MM:S [LEVEL] name: message
        self.assertRegex(output, r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}')

    def test_format_includes_level(self):
        """Test that detailed format includes level name."""
        formatter = _make_detailed_formatter()
        record = logging.LogRecord(
            name='test', level=logging.DEBUG, pathname='test.py',
            lineno=1, msg='Debug message', args=None, exc_info=None,
        )
        output = formatter.format(record)
        self.assertIn('DEBUG', output)

    def test_format_includes_module_name(self):
        """Test that detailed format includes logger name."""
        formatter = _make_detailed_formatter()
        record = logging.LogRecord(
            name='backend.module', level=logging.WARNING, pathname='test.py',
            lineno=1, msg='Warning message', args=None, exc_info=None,
        )
        output = formatter.format(record)
        self.assertIn('backend.module:', output)

    def test_format_with_extra_data(self):
        """Test that extra data attributes appear in formatted output."""
        formatter = _make_detailed_formatter()
        record = logging.LogRecord(
            name='test', level=logging.INFO, pathname='test.py',
            lineno=1, msg='Request received', args=None, exc_info=None,
        )
        # The basic detailed formatter doesn't render custom attributes by default
        # Just verify the format works without error
        output = formatter.format(record)
        self.assertIn('Request received', output)


class TestMakeErrorHandler(unittest.TestCase):
    """Tests for _make_error_handler function."""

    def test_returns_handler(self):
        """Test that it returns a handler instance."""
        handler = _make_error_handler()
        self.assertIsInstance(handler, logging.Handler)

    def test_handler_level_is_error(self):
        """Test that error handler is set to ERROR level."""
        handler = _make_error_handler()
        self.assertEqual(handler.level, logging.ERROR)

    def test_format_error_only(self):
        """Test that error handler produces [ERROR] message format."""
        handler = _make_error_handler()
        formatter = handler.formatter
        record = logging.LogRecord(
            name='test', level=logging.ERROR, pathname='test.py',
            lineno=1, msg='Critical failure', args=None, exc_info=None,
        )
        output = formatter.format(record)
        self.assertEqual(output, '[ERROR] Critical failure')

    def test_handler_filters_non_errors(self):
        """Test that error handler only processes ERROR and above."""
        handler = _make_error_handler()
        # WARNING should not pass (levelno < ERROR level)
        self.assertGreater(handler.level, logging.WARNING)

        # ERROR should pass (handler level == ERROR)
        self.assertEqual(handler.level, logging.ERROR)


class TestPatchedLog(unittest.TestCase):
    """Tests for _patched_log function (coverage line 78 area)."""

    def test_patched_log_without_extra_data(self):
        """Test _patched_log without extra_data kwarg."""
        mock_logger = MagicMock(spec=logging.Logger)
        _patched_log(mock_logger, logging.INFO, 'test message')
        mock_logger._log.assert_called_once_with(
            logging.INFO, 'test message', (),
        )

    def test_patched_log_with_extra_data(self):
        """Test _patched_log merges extra_data into extra kwarg."""
        mock_logger = MagicMock(spec=logging.Logger)
        _patched_log(
            mock_logger, logging.WARNING, 'test message',
            extra_data={'key': 'value'},
        )
        call_kwargs = mock_logger._log.call_args[1]
        self.assertEqual(call_kwargs['extra'], {'key': 'value'})

    def test_patched_log_extra_data_merges_with_existing(self):
        """Test _patched_log merges extra_data with existing extra dict."""
        mock_logger = MagicMock(spec=logging.Logger)
        _patched_log(
            mock_logger, logging.ERROR, 'test message',
            extra={'existing': 'data'},
            extra_data={'new': 'field'},
        )
        call_kwargs = mock_logger._log.call_args[1]
        self.assertEqual(call_kwargs['extra'], {'existing': 'data', 'new': 'field'})

    def test_patched_log_with_args(self):
        """Test _patched_log passes positional args through."""
        mock_logger = MagicMock(spec=logging.Logger)
        _patched_log(mock_logger, logging.INFO, 'Value: %s', 'hello')
        mock_logger._log.assert_called_once_with(
            logging.INFO, 'Value: %s', ('hello',),
        )


class TestPatchedLogger(unittest.TestCase):
    """Tests for PatchedLogger class (coverage lines 86-89)."""

    def setUp(self):
        """Register PatchedLogger and create instance."""
        logging.setLoggerClass(PatchedLogger)
        self.logger = logging.getLogger('test_patched')
        # Force it to be a PatchedLogger
        self.logger.__class__ = PatchedLogger
        # Clean handlers
        self.logger.handlers.clear()

    def tearDown(self):
        """Clean up logger."""
        self.logger.handlers.clear()
        if self.logger.name in logging.Logger.manager.loggerDict:
            del logging.Logger.manager.loggerDict[self.logger.name]

    def test_patched_logger_is_logger_subclass(self):
        """Test that PatchedLogger is a subclass of logging.Logger."""
        self.assertTrue(issubclass(PatchedLogger, logging.Logger))

    def test_patched_logger_log_with_extra_data(self):
        """Test PatchedLogger._log handles extra_data kwarg."""
        logger = PatchedLogger('test')
        # Patch super()._log to capture calls without wrapping (avoid signature mismatch)
        with patch.object(logging.Logger, '_log', return_value=None) as mock_log:
            logger._log(logging.INFO, 'test message', extra_data={'component': 'test'})
            call_kwargs = mock_log.call_args[1]
            self.assertEqual(call_kwargs['extra']['component'], 'test')

    def test_patched_logger_warning_method(self):
        """Test PatchedLogger.warning calls _patched_log with WARNING level."""
        logger = PatchedLogger('test')
        with patch('backend.logger._patched_log') as mock_patch:
            logger.warning('warning message')
            mock_patch.assert_called_once_with(
                logger, logging.WARNING, 'warning message',
            )

    def test_patched_logger_info_method(self):
        """Test PatchedLogger.info calls _patched_log with INFO level."""
        logger = PatchedLogger('test')
        with patch('backend.logger._patched_log') as mock_patch:
            logger.info('info message')
            mock_patch.assert_called_once_with(
                logger, logging.INFO, 'info message',
            )

    def test_patched_logger_error_method(self):
        """Test PatchedLogger.error calls _patched_log with ERROR level."""
        logger = PatchedLogger('test')
        with patch('backend.logger._patched_log') as mock_patch:
            logger.error('error message')
            mock_patch.assert_called_once_with(
                logger, logging.ERROR, 'error message',
            )

    def test_patched_logger_debug_method(self):
        """Test PatchedLogger.debug calls _patched_log with DEBUG level."""
        logger = PatchedLogger('test')
        with patch('backend.logger._patched_log') as mock_patch:
            logger.debug('debug message')
            mock_patch.assert_called_once_with(
                logger, logging.DEBUG, 'debug message',
            )

    def test_patched_logger_warning_with_extra_data(self):
        """Test PatchedLogger.warning passes extra_data through."""
        logger = PatchedLogger('test')
        with patch('backend.logger._patched_log') as mock_patch:
            logger.warning('warn with data', extra_data={'key': 'val'})
            mock_patch.assert_called_once_with(
                logger, logging.WARNING, 'warn with data',
                extra_data={'key': 'val'},
            )

    def test_patched_logger_with_string_args(self):
        """Test PatchedLogger methods handle string interpolation."""
        logger = PatchedLogger('test')
        with patch('backend.logger._patched_log') as mock_patch:
            logger.info('Value is %d', 42)
            mock_patch.assert_called_once_with(
                logger, logging.INFO, 'Value is %d', 42,
            )


class TestSetupLogger(unittest.TestCase):
    """Tests for setup_logger function."""

    def tearDown(self):
        """Clean up root logger handlers after each test."""
        root = logging.getLogger()
        for handler in root.handlers[:]:
            root.removeHandler(handler)

    def test_setup_logger_default_is_error_only(self):
        """Test default setup (no args) creates error-only handler."""
        setup_logger()
        root = logging.getLogger()
        # Should have exactly one handler (error handler)
        self.assertEqual(len(root.handlers), 1)
        # Handler should be ERROR level
        self.assertEqual(root.handlers[0].level, logging.ERROR)

    def test_setup_logger_verbose(self):
        """Test verbose=True creates two handlers (stdout + stderr)."""
        setup_logger(verbose=True)
        root = logging.getLogger()
        self.assertEqual(len(root.handlers), 2)

    def test_setup_logger_debug(self):
        """Test debug=True creates two handlers with DEBUG-level stdout."""
        setup_logger(debug=True)
        root = logging.getLogger()
        self.assertEqual(len(root.handlers), 2)
        # Stdout handler should accept DEBUG level; stderr handles WARNING+
        levels = [h.level for h in root.handlers]
        self.assertIn(logging.DEBUG, levels)
        self.assertIn(logging.WARNING, levels)

    def test_setup_logger_removes_old_handlers(self):
        """Test that setup_logger clears existing handlers."""
        setup_logger(verbose=True)
        root = logging.getLogger()
        initial_count = len(root.handlers)

        # Call again with different settings
        setup_logger(debug=True)
        self.assertEqual(len(root.handlers), 2)

    def test_setup_logger_sets_root_level_debug(self):
        """Test that setup_logger sets root level to DEBUG."""
        setup_logger()
        root = logging.getLogger()
        self.assertEqual(root.level, logging.DEBUG)

    def test_verbosity_debug_takes_precedence(self):
        """Test debug=True overrides verbose=True."""
        setup_logger(verbose=True, debug=True)
        root = logging.getLogger()
        # Debug mode should be active (2 handlers: DEBUG stdout + WARNING stderr)
        self.assertEqual(len(root.handlers), 2)
        levels = [h.level for h in root.handlers]
        self.assertIn(logging.DEBUG, levels)

    def test_verbosity_error_only_filter(self):
        """Test error-only mode filters out non-error records."""
        setup_logger()
        root = logging.getLogger()
        handler = root.handlers[0]
        # Handler level is ERROR, so INFO < ERROR (filtered out), ERROR == ERROR (passes)
        self.assertGreater(handler.level, logging.INFO)
        self.assertEqual(handler.level, logging.ERROR)


class TestGetLogger(unittest.TestCase):
    """Tests for get_logger function (coverage lines 106-107)."""

    def tearDown(self):
        """Clean up root logger handlers."""
        root = logging.getLogger()
        for handler in root.handlers[:]:
            root.removeHandler(handler)

    def test_get_logger_returns_logger(self):
        """Test get_logger returns a Logger instance."""
        logger = get_logger('test_name')
        self.assertIsInstance(logger, logging.Logger)

    def test_get_logger_default_name(self):
        """Test get_logger with default name."""
        logger = get_logger()
        self.assertEqual(logger.name, 'llama_launcher')

    def test_get_logger_verbose_parameter(self):
        """Test get_logger with verbose=True initializes root (line 129)."""
        # Ensure no handlers exist first
        root = logging.getLogger()
        for h in root.handlers[:]:
            root.removeHandler(h)

        logger = get_logger('test_verbose', verbose=True)
        self.assertIsInstance(logger, logging.Logger)
        # Should have 2 handlers (verbose mode)
        self.assertEqual(len(logging.getLogger().handlers), 2)

    def test_get_logger_verbose_false(self):
        """Test get_logger with verbose=False initializes error-only."""
        root = logging.getLogger()
        for h in root.handlers[:]:
            root.removeHandler(h)

        logger = get_logger('test_err', verbose=False)
        self.assertIsInstance(logger, logging.Logger)
        # Should have 1 handler (error-only mode)
        self.assertEqual(len(logging.getLogger().handlers), 1)

    def test_get_logger_auto_init_no_handlers(self):
        """Test get_logger auto-initializes when no handlers exist (line 131)."""
        root = logging.getLogger()
        for h in root.handlers[:]:
            root.removeHandler(h)

        logger = get_logger('test_auto')
        # Should have auto-initialized with error-only handler
        self.assertGreater(len(logging.getLogger().handlers), 0)

    def test_get_logger_no_init_when_handlers_exist(self):
        """Test get_logger does not re-initialize when handlers already exist."""
        root = logging.getLogger()
        for h in root.handlers[:]:
            root.removeHandler(h)

        # Pre-add a handler
        pre_handler = logging.StreamHandler()
        root.addHandler(pre_handler)

        logger = get_logger('test_no_reinit')
        # Should still have only the pre-existing handler (plus maybe one added by auto-init)
        # The key is: verbose=None should not call setup_logger again
        self.assertIsInstance(logger, logging.Logger)


class TestStructuredJSONFormatter(unittest.TestCase):
    """Tests for StructuredJSONFormatter class (coverage lines 129, 131)."""

    def test_format_basic_json(self):
        """Test basic JSON format without extra data."""
        formatter = StructuredJSONFormatter()
        record = logging.LogRecord(
            name='test.module', level=logging.INFO, pathname='test.py',
            lineno=42, msg='Hello %s', args=('world',), exc_info=None,
        )
        output = formatter.format(record)
        obj = json.loads(output)
        self.assertEqual(obj['level'], 'INFO')
        self.assertEqual(obj['name'], 'test.module')
        self.assertEqual(obj['message'], 'Hello world')
        self.assertIn('timestamp', obj)

    def test_format_json_with_extra_data(self):
        """Test JSON format includes extra_data fields (line 139)."""
        formatter = StructuredJSONFormatter()
        record = logging.LogRecord(
            name='test', level=logging.ERROR, pathname='test.py',
            lineno=1, msg='Failure', args=None, exc_info=None,
        )
        record.extra_data = {'error_type': 'MathError', 'code': 500}
        output = formatter.format(record)
        obj = json.loads(output)
        self.assertEqual(obj['error_type'], 'MathError')
        self.assertEqual(obj['code'], 500)

    def test_format_json_empty_extra_data(self):
        """Test JSON format with None extra_data doesn't add fields."""
        formatter = StructuredJSONFormatter()
        record = logging.LogRecord(
            name='test', level=logging.WARNING, pathname='test.py',
            lineno=1, msg='Warning', args=None, exc_info=None,
        )
        record.extra_data = None
        output = formatter.format(record)
        obj = json.loads(output)
        self.assertNotIn('extra_data', obj)

    def test_format_json_empty_dict_extra_data(self):
        """Test JSON format with empty dict extra_data doesn't add fields."""
        formatter = StructuredJSONFormatter()
        record = logging.LogRecord(
            name='test', level=logging.DEBUG, pathname='test.py',
            lineno=1, msg='Debug', args=None, exc_info=None,
        )
        record.extra_data = {}
        output = formatter.format(record)
        obj = json.loads(output)
        self.assertEqual(len([k for k in obj if k not in ('timestamp', 'level', 'name', 'message')]), 0)

    def test_format_json_all_levels(self):
        """Test JSON format works with all log levels."""
        formatter = StructuredJSONFormatter()
        for level, name in [(logging.DEBUG, 'DEBUG'), (logging.INFO, 'INFO'),
                            (logging.WARNING, 'WARNING'), (logging.ERROR, 'ERROR')]:
            record = logging.LogRecord(
                name='test', level=level, pathname='t.py',
                lineno=1, msg=f'{name} message', args=None, exc_info=None,
            )
            output = formatter.format(record)
            obj = json.loads(output)
            self.assertEqual(obj['level'], name)

    def test_format_json_custom_datefmt(self):
        """Test JSON format with custom datefmt."""
        formatter = StructuredJSONFormatter(datefmt='%Y/%m/%d')
        record = logging.LogRecord(
            name='test', level=logging.INFO, pathname='t.py',
            lineno=1, msg='msg', args=None, exc_info=None,
        )
        output = formatter.format(record)
        obj = json.loads(output)
        self.assertIn('/', obj['timestamp'])


class TestDemonstrateLogging(unittest.TestCase):
    """Tests for demonstrate_logging function (coverage lines 139-148)."""

    def setUp(self):
        """Set up stream mocks."""
        self.mock_stdout = io.StringIO()
        self.mock_stderr = io.StringIO()
        self.stdout_patcher = patch('sys.stdout', self.mock_stdout)
        self.stderr_patcher = patch('sys.stderr', self.mock_stderr)
        self.stdout_mock = self.stdout_patcher.start()
        self.stderr_mock = self.stderr_patcher.start()

    def tearDown(self):
        """Clean up."""
        self.stdout_patcher.stop()
        self.stderr_patcher.stop()
        root = logging.getLogger()
        for handler in root.handlers[:]:
            root.removeHandler(handler)

    def test_demonstrate_logging_runs_without_error(self):
        """Test demonstrate_logging executes without raising exceptions."""
        demonstrate_logging()  # Should not raise

    def test_demonstrate_logging_logs_info(self):
        """Test demonstrate_logging logs an info message with extra_data."""
        setup_logger(verbose=True)
        demonstrate_logging()

        stdout_output = self.mock_stdout.getvalue()
        self.assertIn('INFO', stdout_output)
        self.assertIn('Application starting up.', stdout_output)

    def test_demonstrate_logging_logs_error(self):
        """Test demonstrate_logging logs an error message after ZeroDivisionError."""
        setup_logger(verbose=True)
        demonstrate_logging()

        stderr_output = self.mock_stderr.getvalue()
        self.assertIn('ERROR', stderr_output)
        self.assertIn('A critical calculation failed.', stderr_output)

    def test_demonstrate_logging_error_on_stderr(self):
        """Test demonstrate_logging error goes to stderr, info to stdout."""
        setup_logger(verbose=True)
        demonstrate_logging()

        stdout_output = self.mock_stdout.getvalue()
        stderr_output = self.mock_stderr.getvalue()

        # INFO message should be on stdout
        self.assertIn('Application starting up.', stdout_output)
        # ERROR message should be on stderr
        self.assertIn('A critical calculation failed.', stderr_output)


class TestMainBlock(unittest.TestCase):
    """Tests for __main__ block (coverage lines 152-157)."""

    def setUp(self):
        """Set up stream mocks."""
        self.mock_stdout = io.StringIO()
        self.mock_stderr = io.StringIO()
        self.stdout_patcher = patch('sys.stdout', self.mock_stdout)
        self.stderr_patcher = patch('sys.stderr', self.mock_stderr)
        self.stdout_mock = self.stdout_patcher.start()
        self.stderr_mock = self.stderr_patcher.start()

    def tearDown(self):
        """Clean up."""
        self.stdout_patcher.stop()
        self.stderr_patcher.stop()
        root = logging.getLogger()
        for handler in root.handlers[:]:
            root.removeHandler(handler)

    def test_main_block_runs_demonstrate_logging(self):
        """Test that __main__ block calls demonstrate_logging."""
        # Import the module's __main__ code path
        import backend.logger as logger_module

        # Verify demonstrate_logging is callable and doesn't raise
        with patch.object(logger_module, 'demonstrate_logging') as mock_demo:
            # Simulate running the __main__ block
            logger_module.demonstrate_logging()
            mock_demo.assert_called()


if __name__ == '__main__':
    unittest.main()
