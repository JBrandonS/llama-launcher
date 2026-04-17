# Llama Launcher Implementation Plan

## Overview
This plan details the full implementation of the llama-launcher project. The goal is to create a comprehensive CLI tool for managing and running LLaMA.cpp models, focusing on staged progression, rigorous testing at every milestone, and using PROGRESS.md to track state.

## Stage Breakdown

### Stage 1: Foundation & Discovery (CLI Core)
- [ ] **Task 1.1**: Set up project structure and dependencies
  - **Detail**: Activate the Python virtual environment: `source /home/b/git/llama-launcher/.venv/bin/activate`.
  - **Detail**: Verify existing package structure (`llama_launcher/`).
  - **Detail**: Ensure `tests/` directory is set up with a basic test suite.
  - **Detail**: Review `requirements.txt` to identify all required libraries (e.g., `llama-cpp-python`, `typer`, `rich`).
  - **Action**: Install dependencies: `pip install -r requirements.txt`.
  - **Action**: Run initial test suite: `pytest -E tests/` to establish a baseline of correct functionality.

- [ ] **Task 1.2**: Implement model discovery CLI command (`list-models`)
  - **Detail**: Create the `list-models` command in `llama_launcher/cli.py` (e.g., using `typer` or `click`).
  - **Detail**: Implement **local model scanning**. This means the tool must recursively scan configured directories (defined in `config.yaml`) for GGUF files. It must specifically look in default cache locations, such as `~/.cache/huggingface/hub/[MODELS DIR]`, and support any directory structure that correctly contains GGUF files.
  - **Detail**: The output must include model name, version, and source location.
  - **Action**: Write unit tests for model discovery logic: `pytest -E tests/test_cli.py::test_list_models`.

- [ ] **Task 1.3**: Implement model configuration management
  - **Detail**: Update `config.yaml` to support configurable cache paths and global settings (e.g., default thread count, log level).
  - **Detail**: Implement **model parameter configuration**. This involves defining a structure (e.g., a class or dict) to hold run-time parameters like `threads`, `gpu_layers`, `context_size`, `temperature`, and `top_p`. These settings are applied when running a model.
  - **Action**: Write tests for config management: `pytest -E tests/test_config.py`.

### Stage 2: Model Runner (Execution)
- [ ] **Task 2.1**: Implement model runner logic (`llama_runner.py`)
  - **Detail**: Create the core logic for interacting with `llama.cpp`.
  - **Detail**: Implement **foreground and background running**.
    - **Foreground Mode**: The CLI blocks, prints output, and displays real-time logs/metrics until the model run is manually stopped (Ctrl+C).
    - **Background Mode**: The process detaches, allowing the user to continue using the terminal. The tool must return a unique PID/Task ID.
  - **Detail**: Implement prompt processing, handling standard input (stdin) for user queries and writing output to standard output (stdout).
  - **Detail**: Integrate logging: Use Python's `logging` module to capture internal errors, warnings, and performance data, directing output based on the configured log level.
  - **Detail**: Integrate messaging system: Provide a mechanism (e.g., a dedicated log stream or status update via the CLI) for real-time status updates (e.g., "Running...", "Complete: 123 tokens/sec").
  - **Action**: Write unit tests for runner logic: `pytest -E tests/test_llama_runner.py`.

- [ ] **Task 2.2**: Implement interactive CLI interface
  - **Detail**: Add a user-friendly interface for model selection (e.g., a prompt asking "Enter model name or type 'list'").
  - **Detail**: Allow users to pass custom launch parameters (`--threads 8 --gpu-layers 32 --temperature 0.9`).
  - **Detail**: Implement logic to switch between foreground/background execution based on a command flag.
  - **Action**: Write integration tests for the CLI workflow: `pytest -E tests/test_cli.py::test_run`.

### Stage 3: Benchmarking Suite
- [ ] **Task 3.1**: Implement benchmarking framework (`arena` command)
  - **Detail**: Create a dedicated benchmark runner logic.
  - **Detail**: Collect standardized metrics: inference time (total run time), memory usage (peak VRAM/RAM), and throughput (tokens/second).
  - **Detail**: Implement timing and profiling utilities using standard Python libraries.
  - **Action**: Write unit tests for benchmark logic: `pytest -E tests/test_arena.py`.

- [ ] **Task 3.2**: Implement comparison features
  - **Detail**: Allow side-by-side comparison of models by running the same benchmark sequence on multiple models and aggregating the results into a readable report.
  - **Detail**: Implement performance metrics visualization (e.g., a simple text-based graph or structured JSON output).
  - **Action**: Write integration tests for benchmark comparison: `pytest -E tests/test_arena.py::test_comparison`.

### Stage 4: Local Model Scanning (High Priority)
- [ ] **Task 4.1**: Implement local model scanning
  - **Detail**: Implement robust recursive scanning logic. The tool must look in default LLaMA.cpp/HuggingFace cache paths (e.g., `~/.cache/huggingface/hub/[MODELS DIR]`) to find all GGUF files.
  - **Detail**: The scanner must correctly identify model boundaries and metadata associated with the files.
  - **Detail**: Write unit tests to ensure scanning works across different directory structures and correctly identifies GGUF files.
  - **Action**: Run tests: `pytest -E tests/test_model_manager.py`.

### Stage 5: Hugging Face Integration (Low Priority)
- [ ] **Task 5.1**: Implement Hugging Face model search
  - **Detail**: Integrate with the Hugging Face API (using `requests` or similar) to allow users to search the Hub for LLaMA-compatible models.
  - **Detail**: Implement filtering capability based on search parameters (name, size, license).
  - **Action**: Write unit tests for search logic: `pytest -E tests/test_hf_integration.py`.

- [ ] **Task 5.2**: Implement model card parsing
  - **Detail**: When a model is selected, fetch its Hugging Face Model Card content.
  - **Detail**: Parse the card to extract: Model Architecture summary, Training Data details, and specific recommended sampling configurations (e.g., for `unsloth/gemma-4-E4B-it-GGUF`, parse instructions like "Use temperature=1.0 top_p=0.95...").
  - **Action**: Write unit tests for card parsing: `pytest -E tests/test_hf_integration.py::test_parse_card`.

### Stage 6: Startup Daemon
- [ ] **Task 6.1**: Implement daemon functionality
  - **Detail**: Create a daemon service that monitors `config.yaml` and automatically launches the specified model.
  - **Detail**: Must operate as a background process and be resilient to process interruption.
  - **Action**: Write unit tests for daemon logic: `pytest -E tests/test_daemon.py`.

- [ ] **Task 6.2**: Implement daemon restart handling
  - **Detail**: Implement logic to automatically restart the model process if it exits unexpectedly (crash handling).
  - **Action**: Write integration tests for daemon lifecycle: `pytest -E tests/test_daemon.py::test_restart`.

### Stage 7: Integration & End-to-End Testing
- [ ] **Task 7.1**: Run full integration test suite
  - **Detail**: Simulate a full user journey: `list-models` -> select model -> `run --foreground` -> verify logs -> exit -> `list-models` again to ensure state persists.
  - **Action**: Run tests: `pytest -E tests/`.

- [ ] **Task 7.2**: Performance optimization
  - **Detail**: After initial runs, analyze the metrics gathered in Stage 3 and profile performance bottlenecks in `llama_runner.py` or `llama_cpp` interaction.
  - **Action**: Run benchmarks and apply necessary code optimizations to achieve target performance metrics.

### Stage 8: Documentation & GitHub Setup
- [ ] **Task 8.1**: Create GitHub-style README.md
  - **Detail**: Structure the README to include a clear "Getting Started" section, installation instructions (`pip install -r requirements.txt`), command reference, and a brief architectural overview.
  - **Action**: Write the README content and commit it to git.

- [ ] **Task 8.2**: Create full pip publishable project
  - **Detail**: Configure a `pyproject.toml` file to define the package structure and dependencies.
  - **Detail**: Set up package metadata (name, version, description, authors).
  - **Detail**: Configure basic CI/CD workflow (e.g., using GitHub Actions) to run tests and build the package before publishing.
  - **Detail**: Create a release workflow for semantic versioning.

## Tools & Frameworks

### Tools to Enable
- **pytest** for testing framework
- **pytest-cov** for code coverage reporting
- **black** for code formatting
- **ruff** for linting
- **mypy** for type checking
- **pip** for publishing

### Frameworks to Include
- **pytest** for test suite
- **pytest-asyncio** for async tests (if needed)
- **pytest-cov** for coverage tracking
- **black** for code formatting
- **ruff** for linting
- **mypy** for type checking

## Progress Tracking

PROGRESS.md will be updated after each stage completes, tracking:
- Current stage progress
- Test results for each stage
- Code coverage metrics
- Next stage prerequisites
- **Completion Signal**: The final successful completion of Stage 8 must output `<promise>DONE</promise>` to support ralph loop.

## Success Criteria

Each stage must pass all tests before moving to the next stage. Final success:
- All unit tests pass: `pytest -E tests/`
- Full integration workflow functional
- Benchmark suite operational
- Startup daemon functional
