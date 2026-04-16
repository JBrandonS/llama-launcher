# PLAN.md - Llama Launcher Advanced Interface

## 🎯 Goal
To transform the existing `llama-launcher` into a single-call, advanced, production-ready command-line interface (`llama-launcher`). This interface must provide seamless access to all `llama-cpp-python` functionalities while adding crucial advanced features like benchmarking, robust configuration management, and automated deployment services.

## 🧠 Core Requirements & Features (CoT Breakdown)
1.  **Unified CLI:** The primary entry point (`llama-launcher`) must handle all logic, avoiding scattered scripts.
2.  **Configuration:** Support both global default settings (in `config.yaml`) and override settings on a per-model basis (e.g., `--model-threads 4`).
3.  **Model Discovery:** Must list available models by querying the `llama-cpp-python` runtime AND scanning common paths like `~/.cache/huggingface/hub` for model files.
4.  **Benchmarking:** Implement single-model and multi-model benchmarking capabilities. This requires integrating an internal loop and potentially a dataset download utility (`-hf download`).
5.  **Service Management:** Implement logic to run the server in the background and generate/install a systemd service script (`.service`).
6.  **High-Rigor Mandate:** The entire process must strictly follow the `cli-project-builder` workflow: **Plan $\to$ Implement $\to$ Test $\to$ Review $\to$ Self-Correct $\to$ Finalize**.

## 🗺️ Phase Breakdown (Milestones)

**Phase 0: Infrastructure and Planning (Current Phase)**
*   *Status:* Planning.
*   *Deliverable:* This `PLAN.md` and initial project structure.
*   *Action:* Setup `venv`, `requirements.txt`, and base directories.

**Phase 1: Core CLI and Configuration (P1-CLI-CORE)**
*   *Focus:* `cli.py` and `config.py`.
*   *Tasks:* Implement argument parsing (using `argparse` or `click`), define the configuration loader, and integrate the basic `run_model` function.
*   *Test Mandate:* Test argument parsing and config loading logic.

**Phase 2: Model Discovery & Advanced Features (P2-ADVANCED-MODELING)**
*   *Focus:* `model_manager.py`.
*   *Tasks:* Implement `list_models` (CLI query + filesystem scan). Implement single-model benchmarking logic. Implement the dataset download mechanism (supporting `-hf download`).
*   *Test Mandate:* Test model listing for both runtime and local files. Test benchmark calculation logic.

**Phase 3: Operational Features (P3-OPERATIONS)**
*   *Focus:* `system_ops.py`.
*   *Tasks:* Implement daemon/background service runner. Implement the systemd script generator. Implement the multi-model benchmarking loop.
*   *Test Mandate:* Test systemd script generation for correct formatting. Test background process management (non-blocking).

**Phase 4: Finalization and Review (P4-FINAL-DOCS)**
*   *Focus:* Integration and polish.
*   *Tasks:* Integrate all modules into the main CLI. Conduct a final self-correction review. Write the final `README.md` including the required dedication.
*   *Test Mandate:* Full integration and regression testing across all features.

## ⚠️ Risks and Mitigation
*   **Risk:** `llama-cpp-python` CLI might not expose a simple way to list files in `~/.cache/huggingface/hub`.
    *   *Mitigation:* Rely on `glob` or `os.walk` in the `model_manager` to scan the directory, as a fallback.
*   **Risk:** Benchmarking requires time-consuming operations.
    *   *Mitigation:* Use `subagent-driven-development` to parallelize benchmarking runs where possible.

## 🛠️ Required Dependencies
- `llama-cpp-python` (for runtime access)
- `requests` (for server status/API)
- `huggingface_hub` (for potential download/interaction)
- `click` or `argparse` (for CLI interface)
- `pytest` (for testing)

## 🔑 Success Criteria
The project is successful when:
1.  `llama-launcher` executes successfully without arguments, displaying a list of available models and configuration options.
2.  All features listed in the Goal are functional and pass their respective integration tests.
3.  The code meets the high-rigor standard: modular, well-tested, and documented.
