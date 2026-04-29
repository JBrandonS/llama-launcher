# tests/ — Test Module Knowledge Base

**Parent:** ../AGENTS.md
**Commit:** d48f2b16d255bf57a6e760eac2cf101a351d2fa0
**Branch:** main

`/home/b/.config/opencode/SOUL.md` must be loaded at start of every AI task session

## MODULE SCOPE
Test suite for llama-launcher — 7 `unittest.TestCase` files (Python backend), Vitest unit tests (frontend), Playwright E2E tests. All backend tests use `unittest.TestCase` despite `pyproject.toml` listing pytest.

## MODULE STRUCTURE
```
tests/
├── test_config.py          # Pydantic config loading, tri-source priority
├── test_model_manager.py   # Model detection, HF search, benchmark parsing
├── test_process_manager.py # PID file management, start/stop/status
├── test_llama_runner.py    # CLI arg generation, subprocess mocking
├── test_config_store.py    # Named config persistence
├── test_benchmark.py       # Benchmark output parsing, metric collection
├── test_download.py        # HuggingFace snapshot download helpers
├── playwright.config.ts    # Playwright E2E configuration
└── e2e/                    # Playwright end-to-end tests
```

## KEY SYMBOLS
| Symbol | Type | File | Role |
|--------|------|------|------|
| `TestConfig` | class | test_config.py | Config loading priority tests (CLI > env > YAML > defaults) |
| `TestModelManager` | class | test_model_manager.py | Model detection, registry, HF search |
| `TestProcessManager` | class | test_process_manager.py | PID file CRUD, server lifecycle |
| `TestLlamaRunner` | class | test_llama_runner.py | CLI arg generation, subprocess mocking |
| `TestConfigStore` | class | test_config_store.py | Named config persistence, JSON I/O |
| `TestBenchmark` | class | test_benchmark.py | Benchmark output parsing, metric collection |
| `TestDownload` | class | test_download.py | HF snapshot download helpers |
| `playwright.config.ts` | file | playwright.config.ts | Playwright E2E configuration |

## CONVENTIONS
- **Framework:** `unittest.TestCase` for backend, Vitest for frontend, Playwright for E2E
- **Test naming:** `test_<function_name>` for functions, `test_<method_name>` for methods
- **Mocking:** `unittest.mock.patch` for subprocess, HTTP, filesystem operations
- **Fixtures:** `setUp()` / `tearDown()` for test setup/teardown (not pytest fixtures)
- **Temp files:** Use `tempfile.TemporaryDirectory()` for PID/config file tests
- **E2E tests:** Playwright tests in `tests/e2e/`, test UI interactions, API responses
- **No pytest:** Despite `pyproject.toml` listing pytest, all tests use `unittest.TestCase`
- **Coverage:** Tests should cover normal paths, edge cases, and error conditions

## ANTI-PATTERNS
- **No pytest fixtures** — use `setUp()` / `tearDown()` instead
- **No `unittest.mock` without `patch`** — always use `@patch` or `with patch()` for mocks
- **No hardcoded paths** — use `Path.home()` / `tempfile` for test directories
- **No real subprocess calls** — always mock `subprocess.run` or use `LlamaRunner.run_model_mock()`
- **No real HTTP calls** — mock `httpx` or use test servers
- **No shared mutable state** — each test must be independent

## DEPENDENCIES
| Dependency | Usage |
|------------|-------|
| `unittest` | All backend tests |
| `unittest.mock` | Subprocess, HTTP, filesystem mocking |
| `tempfile` | Test directory/file management |
| `pytest` | Listed in pyproject.toml but NOT used (legacy) |
| `vitest` | Frontend unit tests |
| `@playwright/test` | E2E testing |
| `jsdom` | DOM environment for Vitest |

## COMMANDS
```bash
# Run all backend tests
python -m unittest discover tests/

# Run specific test file
python -m unittest tests/test_config.py

# Run frontend tests
cd ui && npm run test

# Run E2E tests
cd ui && npm run test:e2e
```
