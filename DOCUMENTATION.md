# Llama Launcher Documentation

## 🚀 Overview
Llama Launcher is a CLI tool designed to simplify the deployment and benchmarking of various Large Language Models (LLMs) using `llama.cpp`.

## 🗂️ Model Discovery and Management
The launcher supports two primary methods for finding models:

1.  **Local Models:**
    *   The `ModelManager` automatically scans predefined directories (configured in `config.py`) for GGUF files.
    *   It uses a simple naming convention (`file_path.stem.replace("-", "_")`) to generate a shortcut name.
    *   The `list-models` command displays these local shortcuts.
2.  **Hugging Face Models:**
    *   The `ModelManager` can search Hugging Face repositories using the `list-models` command, provided a search query is configured.
    *   Models can be downloaded using `ModelManager.download_model`.

## 🛠️ Configuration
All runtime and discovery paths are managed by `config.py`. Key configuration points include:
*   `local_model_search_paths`: A list of directories where the launcher looks for local GGUF models.
*   `default_hf_search_query`: The default query used when listing models from Hugging Face.

## ⚔️ The Model Arena
The new `arena` command facilitates model benchmarking:
1.  **Execution:** Run `llama-launcher arena` to start the selection process.
2.  **Selection:** The tool lists all available local models and prompts the user to select models by number.
3.  **Benchmarking:** The `ModelManager.run_benchmark` method executes a standardized prompt across all selected models using synchronous calls to `llama_runner.run_model_sync`.
4.  **Output:** A summary, including the generated output and word count for each model, is printed upon completion.

## 🐛 Troubleshooting and Iteration
*   **Model Not Found:** Ensure the model path is correct or the shortcut name matches the detected model name.
*   **API Errors:** If Hugging Face search fails, check network connectivity or the configured query.
*   **Failure Handling:** The launcher is designed to stop and report errors during critical steps (e.g., model execution, API calls) and requires reevaluation before proceeding.
