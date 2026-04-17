# AGENTS.md: Llama Launcher Context

## ⚙️ Setup & Dependencies
-   **Prerequisites:** Requires Python 3.10+ and a compiled `llama.cpp` executable in the system PATH.
-   **Install:** Run `pip install -r requirements.txt` to install all dependencies (`llama-cpp-python`, `huggingface_hub`, etc.).
-   **Configuration:** Global settings (e.g., default model paths) are managed in `config.yaml`.

## 🚀 Core Workflow Commands
-   **Discovery (List Models):** Use `python llama_launcher/cli.py list-models` to scan local GGUF models and search Hugging Face.
-   **Execution (Run Model):** Execute models via `python llama_launcher/cli.py run --model <path> --prompt "<query>" --options "<settings>"`.
-   **Testing:** The full test suite is located in the `tests/` directory and runs via `pytest tests/`.

## 🧩 Architecture Notes
-   The core model interaction and execution logic resides in `llama_runner.py`.
-   Models must be in GGUF format.

(End of file - total 17 lines)