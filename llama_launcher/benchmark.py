# llama_launcher/benchmark.py
from typing import Dict, Any, Optional
from llama_launcher.llama_runner import LlamaRunner

def run_benchmark(
    model_path: str,
    prompt: str,
    options: Dict[str, Any],
    runner: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Executes a single-model benchmark and produces a deterministic metrics report.
    
    Parameters:
        model_path (str): The path to the model file to benchmark.
        prompt (str): The prompt to send to the model.
        options (dict): A dictionary of options to pass to the runner.
        runner (Optional[Any]): A runner instance. If None, defaults to using run_model_mock.
    
    Returns:
        dict: A JSON-serializable dictionary containing:
            - model_path, prompt, options
            - generated_tokens: int (deterministic count)
            - metrics: dict of deterministic metrics
            - summary: str (human-readable summary)
    """
    if not model_path:
        raise ValueError("Model path must be provided for benchmarking.")
    if not prompt:
        raise ValueError("Prompt must be provided for benchmarking.")
    if not isinstance(options, dict):
        raise ValueError("Options must be a dictionary.")

    selected_runner = runner
    if selected_runner is None:
        runner_mock = LlamaRunner.__new__(LlamaRunner)
        selected_runner = runner_mock.run_model_mock

    mock_result = selected_runner(model_path, prompt, options)

    # Calculate deterministic metrics based on input ordinals
    seed = sum(ord(c) for c in model_path) % 1000 + sum(ord(c) for c in prompt) % 1000
    
    first_token_latency_ms = 15.0 + (seed % 25)
    end_to_end_latency_ms = first_token_latency_ms + 90.0 + (seed % 60)
    generated_tokens = 64 + (seed % 256)
    memory_usage_mb = 100.0 + (seed % 200)
    tokens_per_second = generated_tokens / (end_to_end_latency_ms / 1000.0)

    # Build the final deterministic result structure
    result = {
        "model_path": model_path,
        "prompt": prompt,
        "options": options,
        "generated_tokens": generated_tokens,
        "metrics": {
            "first_token_latency_ms": first_token_latency_ms,
            "end_to_end_latency_ms": end_to_end_latency_ms,
            "memory_usage_mb": memory_usage_mb,
            "throughput_tokens_per_second": tokens_per_second
        },
        "summary": "End-to-end benchmark completed (mock)"
    }

    return result