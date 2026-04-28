class LlamaLauncherError(Exception):
    """Base exception class for Llama Launcher."""
    pass

class ConfigurationError(LlamaLauncherError):
    """Raised for issues related to configuration loading (e.g., Pydantic/YAML parsing failures)."""
    pass

class TransientProcessError(LlamaLauncherError):
    """Raised for external subprocess or I/O errors that might succeed on retry."""
    pass

class PermanentExecutionError(LlamaLauncherError):
    """Raised for fatal errors that cannot be resolved by retrying (e.g., incorrect model paths)."""
    pass
