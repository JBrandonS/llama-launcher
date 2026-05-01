# backend/llama_runner.py
import asyncio
import logging
import subprocess
from typing import Dict, Any, List, Optional
from backend.config import LlamaConfig

# Default values matching the frontend DEFAULT_FORM
DEFAULT_ARGS: Dict[str, Any] = {
    'gpu_layers': -1,
    'context_size': 0,
    'threads': 0,
    'temp': 0.8,
    'top_k': 40,
    'top_p': 0.95,
    'min_p': 0.05,
    'typical_p': 1.0,
    'penalty_range': 64,
    'repeat_penalty': 1.1,
    'repeat_last_n': 0,
    'presence_penalty': 0.0,
    'frequency_penalty': 0.0,
    'mirostat': 0,
    'mirostat_tau': 5.0,
    'mirostat_eta': 0.1,
    'seed': -1,
    'n_predict': 256,
    'num_keep': -1,
    'rope_freq_scale': 1.0,
    'grammar_file': '',
    'batch_size': 2048,
    'cache_reuse': 0,
    'host': '127.0.0.1',
    'cors': False,
    'flash_attn': False,
    'no_mmap': False,
    'mlock': False,
    'numa': False,
    'cont_batching': False,
    'rope_scaling': 'none',
    'rope_freq_base': 1000000,
    'embedding': False,
    'logits_all': False,
    'speculative': False,
    'draft_model': '',
    'prompt_cache': '',
    'keep_live': 0,
}

def _values_equal(a: Any, b: Any, tolerance: float = 1e-9) -> bool:
    """Compare two values, using tolerance for floats."""
    if isinstance(a, float) and isinstance(b, float):
        return abs(a - b) < tolerance
    return a == b

class LlamaRunner:
    """Handles the execution of llama.cpp."""

    def __init__(self, config: LlamaConfig):
        self.config = config
        self.llama_cli = self._find_llama_executable()

    @staticmethod
    def _find_llama_executable() -> str:
        import shutil
        for name in ("llama-server", "llama-cli", "llama.cpp/main", "main", "llama_cpp_server"):
            if shutil.which(name):
                return name
        return "llama-server"
    @staticmethod
    def _clamp_n_predict(value: int) -> int:
        """Clamp n_predict to llama.cpp valid range: -1 (unlimited) or 1..4096."""
        if value == -1:
            return value
        if value < 1:
            logging.warning(f'n_predict {value} < 1, clamping to 1')
            return 1
        if value > 4096:
            logging.warning(f'n_predict {value} > 4096, clamping to 4096')
            return 4096
        return value



    def generate_command(
        self, model_path: str, custom_options: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Constructs the full command line arguments for llama.cpp.
        """
        # Start with the executable path
        command = [self.llama_cli, "-m", model_path]

        # Apply default options
        _ATTR_MAP = {
            "n_ctx": "n_ctx",
            "n_gpu_layers": "n_gpu_layers",
            "temperature": "temp",
            "threads": "threads",
            "top_k": "top_k",
            "top_p": "top_p",
            "n_predict": "n_predict",
        }
        options = {}
        for attr, key in _ATTR_MAP.items():
            options[key] = getattr(self.config, attr)

        # Merge custom options (from UI form)
        if custom_options:
            options.update(custom_options)

        # ── Flag map: key → (cli_flag, value_transform_fn) ──
        # Boolean flags: transform returns (flag_str, should_include)
        # Value flags: transform returns (flag_str, str(value))
        def _bool_flag(flag: str, val: Any) -> tuple[str, bool]:
            return (f"--{flag}", bool(val))

        def _val_flag(flag: str, val: Any) -> tuple[str, str]:
            return (f"--{flag}", str(val))

        _FLAG_MAP: Dict[str, Any] = {
            # Existing fields
            "n_ctx":       (lambda v: ("--ctx-size", str(v)), None),
            "n_gpu_layers":(lambda v: ("--n-gpu-layers", str(v)), None),
            "temp":        (lambda v: ("--temp", str(v)), None),
            "top_k":       (lambda v: ("--top-k", str(v)), None),
            "top_p":       (lambda v: ("--top-p", str(v)), None),
            "n_predict":   (lambda v: ("--n-predict", str(LlamaRunner._clamp_n_predict(v))), None),
            "threads":     (lambda v: ("--threads", str(v)), None),
            # Network
            "host":        (lambda v: ("--host", str(v)), None),
            "cors":        (_bool_flag("cors", None), None),
            "cors_allow_origin": (lambda v: ("--cors-allow-origin", str(v)), None),
            "api_key":     (lambda v: ("--api-key", str(v)), None),
            # Performance
            "flash_attn":  (lambda v: ("--flash-attn", str(v)), None),
            "no_mmap":     (_bool_flag("no-mmap", None), None),
            "mlock":       (_bool_flag("mlock", None), None),
            "numa":        (lambda v: ("--numa", str(v)) if v else (None, None), None),
            "cont_batching": (_bool_flag("cont-batching", None), None),
            # RoPE
            "rope_scaling": (lambda v: ("--rope-scaling", str(v)) if v else (None, None), None),
            "rope_freq_base": (lambda v: ("--rope-freq-base", str(v)), None),
            # Advanced
            "embedding":   (_bool_flag("embedding", None), None),
            "logits_all":  (_bool_flag("logits-all", None), None),
            "speculative": (_bool_flag("speculative", None), None),
            "draft_model": (lambda v: ("--draft", str(v)), None),
            "prompt_cache":(lambda v: ("--prompt-cache", str(v)), None),
            "keep_live":   (lambda v: ("--keep-live", str(v)), None),
        }

        # Build CLI args — skip values matching defaults
        cli_args = []
        for key, value in options.items():
            if key not in _FLAG_MAP:
                continue
            # Skip if value equals the default
            default = DEFAULT_ARGS.get(key)
            if default is not None and _values_equal(value, default):
                continue
            transform_fn = _FLAG_MAP[key][0]
            flag, flag_val = transform_fn(value)
            if flag is None:
                continue
            # Boolean flags: only add if truthy
            if flag in ("--cors", "--no-mmap", "--mlock", "--cont-batching",
                        "--embedding", "--logits-all", "--speculative"):
                if value:
                    cli_args.append(flag)
            elif key == "keep_live":
                # Only add if > 0
                if int(value) > 0:
                    cli_args.extend([flag, str(value)])
            elif key == "rope_freq_base":
                # Only add if > 0
                if int(value) > 0:
                    cli_args.extend([flag, str(value)])
            else:
                # Value flags: only add if non-empty/non-zero
                if flag_val and str(flag_val).strip():
                    cli_args.extend([flag, str(flag_val)])

        command.extend(cli_args)
        return command

    @staticmethod
    def get_command_preview(model_path: str, options: Dict[str, Any]) -> str:
        """Generate a CLI command string for preview (without defaults)."""
        runner = LlamaRunner.__new__(LlamaRunner)
        runner.config = type('PreviewConfig', (), {attr: DEFAULT_ARGS.get(attr, 0) for attr in DEFAULT_ARGS})()
        runner.llama_cli = runner._find_llama_executable()
        # Merge defaults with provided options
        merged = {**DEFAULT_ARGS, **options}
        cmd = runner.generate_command(model_path, merged)
        return ' '.join(cmd)

    def run_model(
        self, model_path: str, custom_options: Optional[Dict[str, Any]] = None
    ) -> subprocess.Popen:
        """
        Executes the llama.cpp command using Popen to allow for interactive output streaming.
        Returns the process object.
        """
        command = self.generate_command(model_path, custom_options)
        logging.info(f"Executing command: {' '.join(command)}")

        try:
            # Use Popen to capture stdout and stderr separately for streaming
            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            return process
        except FileNotFoundError:
            raise RuntimeError(
                f"Llama.cpp executable not found at {self.llama_cli}. Ensure llama.cpp is compiled and in the PATH."
            )
        except Exception as e:
            raise RuntimeError(f"Failed to start llama.cpp process: {e}")

    def run_model_sync(
        self, model_path: str, prompt: str, custom_options: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Executes the llama.cpp command synchronously and returns the full generated text.
        """
        command = self.generate_command(model_path, custom_options)
        logging.info(f"Executing synchronous command: {' '.join(command)}")

        try:
            # Use run to execute and wait for the process to complete
            process = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,  # Raise CalledProcessError for non-zero exit codes
                input=prompt + "\n",  # Feed the prompt via stdin
            )
            # The output might contain logging and the generated text. We assume the relevant output is in stdout.
            return process.stdout
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                f"Llama.cpp execution failed (Return Code {e.returncode}). Stderr: {e.stderr}"
            )
        except FileNotFoundError:
            raise RuntimeError(
                f"Llama.cpp executable not found at {self.llama_cli}. Ensure llama.cpp is compiled and in the PATH."
            )
        except Exception as e:
            raise RuntimeError(f"Failed to run llama.cpp process synchronously: {e}")

    async def run_model_async(
        self, model_path: str, prompt: str, custom_options: Dict[str, Any] = None
    ) -> str:
        """
        Executes the llama.cpp command asynchronously and returns the full generated text.
        Uses asyncio.create_subprocess_exec for non-blocking process management.
        """
        command = self.generate_command(model_path, custom_options)
        logging.info(f"Executing async command: {' '.join(command)}")

        try:
            loop = asyncio.get_event_loop()
            # Use run_in_executor to run subprocess in thread pool (subprocess is not async-native)
            def run_subprocess():
                return subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    check=True,
                    input=prompt + "\n",
                )
            
            output = await loop.run_in_executor(None, run_subprocess)
            return output.stdout
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                f"Llama.cpp execution failed (Return Code {e.returncode}). Stderr: {e.stderr}"
            )
        except FileNotFoundError:
            raise RuntimeError(
                f"Llama.cpp executable not found at {self.llama_cli}. Ensure llama.cpp is compiled and in the PATH."
            )
        except Exception as e:
            raise RuntimeError(f"Failed to run llama.cpp process asynchronously: {e}")

    def run_model_mock(self, model_path: str, prompt: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        MOCK implementation of model execution for testing and scaffolding purposes.
        This function simulates a successful run without invoking subprocess.
        Returns a deterministic dict containing execution metadata.
        """
        if not model_path:
            raise ValueError("Model path must be provided for mock execution.")
        if not prompt:
            raise ValueError("Prompt must be provided for mock execution.")

        if options is None:
            options = {}
            
        return {
            "status": "success",
            "model_path": model_path,
            "prompt": prompt,
            "options": options,
            "output": f"Mock generated response for prompt: '{prompt}'",
            "tokens": 128
        }