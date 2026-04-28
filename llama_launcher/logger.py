import logging
import sys


class _DynamicStreamHandler(logging.StreamHandler):
    """StreamHandler that writes to a named sys attribute (stdout or stderr)."""

    def __init__(self, stream_name):
        self._stream_name = stream_name
        super().__init__(getattr(sys, stream_name))

    @property
    def stream(self):
        return getattr(sys, self._stream_name)

    @stream.setter
    def stream(self, value):
        pass


_VERBOSITY = 0


def setup_logger(verbose: bool = False, debug: bool = False) -> None:
    """Configure the root logger with human-readable formatting."""
    global _VERBOSITY

    if debug:
        _VERBOSITY = 2
    elif verbose:
        _VERBOSITY = 1
    else:
        _VERBOSITY = 0

    root = logging.getLogger()
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    root.setLevel(logging.DEBUG)

    if _VERBOSITY == 0:
        root.addHandler(_make_error_handler())

    elif _VERBOSITY == 1:
        sh = _DynamicStreamHandler('stdout')
        sh.setLevel(logging.INFO)
        sh.addFilter(lambda r: r.levelno < logging.WARNING)
        sh.setFormatter(_make_basic_formatter())

        eh = _DynamicStreamHandler('stderr')
        eh.setLevel(logging.WARNING)
        eh.setFormatter(_make_basic_formatter())

        root.addHandler(sh)
        root.addHandler(eh)

    else:
        sh = _DynamicStreamHandler('stdout')
        sh.setLevel(logging.DEBUG)
        sh.addFilter(lambda r: r.levelno < logging.WARNING)
        sh.setFormatter(_make_detailed_formatter())

        eh = _DynamicStreamHandler('stderr')
        eh.setLevel(logging.WARNING)
        eh.setFormatter(_make_detailed_formatter())

        root.addHandler(sh)
        root.addHandler(eh)


def _make_basic_formatter() -> logging.Formatter:
    """Clean format: [LEVEL] message -- no timestamps, no module names."""
    return logging.Formatter('[%(levelname)s] %(message)s', datefmt='%H:%M:%S')


def _make_detailed_formatter() -> logging.Formatter:
    """Verbose format with timestamps and module names."""
    return logging.Formatter(
        '%(asctime)s [%(levelname)-7s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )


def _make_error_handler() -> logging.Handler:
    """Handler for ERROR-level messages only, to stderr."""
    eh = _DynamicStreamHandler('stderr')
    eh.setLevel(logging.ERROR)
    eh.setFormatter(logging.Formatter('[%(levelname)s] %(message)s'))
    return eh


def _patched_log(logger_instance, level, msg, *args, **kwargs):
    extra = kwargs.pop('extra_data', None)
    if extra is not None:
        extra_kw = kwargs.get('extra', {})
        kwargs['extra'] = {**extra_kw, **extra}
    logger_instance._log(level, msg, args, **kwargs)


class PatchedLogger(logging.Logger):
    """Support 'extra_data' kwarg for backward compatibility with legacy code."""

    def _log(self, level, msg, args=None, *args2, **kwargs):
        extra = kwargs.pop('extra_data', None)
        if extra is not None:
            existing_extra = kwargs.get('extra', {})
            kwargs['extra'] = {**existing_extra, **extra}
        super()._log(level, msg, args, *args2, **kwargs)

    def warning(self, msg, *args, **kwargs):
        _patched_log(self, logging.WARNING, msg, *args, **kwargs)

    def info(self, msg, *args, **kwargs):
        _patched_log(self, logging.INFO, msg, *args, **kwargs)

    def error(self, msg, *args, **kwargs):
        _patched_log(self, logging.ERROR, msg, *args, **kwargs)

    def debug(self, msg, *args, **kwargs):
        _patched_log(self, logging.DEBUG, msg, *args, **kwargs)


logging.setLoggerClass(PatchedLogger)


def get_logger(name: str = 'llama_launcher', verbose: bool | None = None) -> logging.Logger:
    """Get a named logger, initializing the root logger if needed."""
    if verbose is not None:
        setup_logger(verbose=verbose)
    elif not logging.getLogger().handlers:
        setup_logger()
    return logging.getLogger(name)


class StructuredJSONFormatter(logging.Formatter):
    """JSON-formatted log lines (for external logging, tests, etc.)."""

    def format(self, record: logging.LogRecord) -> str:
        extra = getattr(record, 'extra_data', None)
        obj = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "name": record.name,
            "message": record.getMessage(),
        }
        if extra:
            obj.update(extra)
        return __import__('json').dumps(obj)


def demonstrate_logging():
    get_logger().info("Application starting up.", extra_data={"component": "startup"})

    try:
        result = 1 / 0
    except ZeroDivisionError:
        get_logger().error("A critical calculation failed.", extra_data={"error_type": "MathError"})


if __name__ == "__main__":
    demonstrate_logging()
