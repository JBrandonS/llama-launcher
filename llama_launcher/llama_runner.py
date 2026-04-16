# llama_launcher/llama_runner.py

import subprocess
import logging
from typing import Dict, Any, List
from llama_launcher.config import LlamaConfig


class LlamaRunner:
    """Handles the execution of llama.cpp."""

    def __init__(self, config: LlamaConfig):
        self.config = config
        # Assuming llama.cpp is available in the environment PATH
        self.llama_cli = "llama.cpp/main"

    def generate_command(
        self, model_path: str, custom_options: Dict[str, Any] = None
    ) -> List[str]:
        """
        Constructs the full command line arguments for llama.cpp.
        """
        # Start with the executable path
        command = [self.llama_cli, "-m", model_path]

        # Apply default options
        options = {
            k: getattr(self.config, k)
            for k in ["n_ctx", "n_gpu_layers", "temp", "top_k", "top_p", "n_predict"]
        }

        # Merge custom options
        if custom_options:
            options.update(custom_options)

        # Map Python attributes to CLI flags
        cli_args = []
        for key, value in options.items():
            if key == "n_ctx":
                cli_args.append(f"--n-ctx {value}")
            elif key == "n_gpu_layers":
                cli_args.append(f"--n-gpu-layers {value}")
            elif key == "temp":
                cli_args.append(f"--temp {value}")
            elif key == "top_k":
                cli_args.append(f"--top-k {value}")
            elif key == "top_p":
                cli_args.append(f"--top-p {value}")
            elif key == "n_predict":
                cli_args.append(f"--n-predict {value}")
            # Add other llama.cpp flags here as needed

        command.extend(cli_args)
        return command

    def run_model(
        self, model_path: str, custom_options: Dict[str, Any] = None
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
        self, model_path: str, prompt: str, custom_options: Dict[str, Any] = None
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
