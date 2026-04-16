# 🚀 Llama Launcher CLI

## Overview
Llama Launcher is a CLI application designed to provide an interactive and robust interface for managing and running large language models powered by `llama.cpp`. It supports local model detection, searching models on Hugging Face, and executing models with full configuration options.

## 📦 Prerequisites
- Python 3.10+
- The `llama.cpp` executable (compiled and available in your system PATH, or linked appropriately).

## ⚙️ Setup and Installation
1.  **Clone the Repository:**
    ```bash
    git clone <repository-url> ~/git/llama-launcher
    cd ~/git/llama-launcher
    ```
2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: The environment may require `--break-system-packages` on some Linux distributions.)*
3.  **Configuration:**
    The default configuration is located in `config.yaml`. Adjust `default_model_path` and `default_hf_search_query` as needed.

## 🧠 Usage
### 1. Listing Models (Discovery)
This command scans your local model directories and searches Hugging Face for recommended models.
```bash
python llama_launcher/cli.py list-models
```

### 2. Running a Model (Execution)
Run a model by specifying its path and an optional prompt. Custom `llama.cpp` options can be passed via the `--options` flag (e.g., `temp=0.8,n_ctx=4096`).

```bash
# Example: Run a specific local model with a prompt
python llama_launcher/cli.py run --model /path/to/my_model.gguf --prompt "Explain quantum computing in simple terms."

# Example: Run with custom options
python llama_launcher/cli.py run --model /path/to/my_model.gguf --prompt "Write a poem about AI" --options "temp=0.9,n_ctx=4096"
```

## 🧪 Testing
The project includes a comprehensive test suite in the `tests/` directory. You can run tests using:
```bash
pytest tests/
```