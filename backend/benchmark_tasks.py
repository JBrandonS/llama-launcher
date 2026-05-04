"""Multi-benchmark evaluation system for llama.cpp models.

Supports 6 benchmark types:
  1. throughput   — tokens/sec via llama-cli generation
  2. perplexity   — language modeling quality via llama-perplexity on wikitext-2
  3. mmlu         — 5-subject multiple-choice knowledge test
  4. gsm8k        — grade-school math reasoning (5-shot)
  5. hellaswag    — commonsense reasoning (multiple choice)
  6. aime         — competition math (integer answers, 0-shot)

Each benchmark runs via llama-cli (or llama-perplexity for perplexity),
parses responses, and returns structured metrics.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import re
import shutil
import subprocess
import time
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional


# ── Benchmark definitions ───────────────────────────────────────────────

@dataclass
class BenchmarkTask:
    """A single benchmark task (one prompt + expected answer)."""
    id: str
    prompt: str
    gold_answer: str  # the correct answer string
    category: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BenchmarkResult:
    """Result from running one benchmark task on a model."""
    task_id: str
    prompt: str
    gold_answer: str
    model_output: str
    correct: bool = False
    score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


# ── Benchmark datasets (small subsets for local evaluation) ─────────────

def _get_mmlu_subset() -> List[BenchmarkTask]:
    """Small MMLU subset covering 5 subjects, 3 questions each."""
    return [
        # Computer Science
        BenchmarkTask("mmlu_cs_0", "Question: Which data structure uses LIFO order?\nOptions:\nA) Queue\nB) Stack\nC) Array\nD) Linked List\nAnswer:",
                      "B"),
        BenchmarkTask("mmlu_cs_1", "Question: What does HTML stand for?\nOptions:\nA) HyperText Markup Language\nB) High Tech Modern Language\nC) Hyperlink and Text Markup Language\nD) Home Tool Markup Language\nAnswer:",
                      "A"),
        BenchmarkTask("mmlu_cs_2", "Question: Which sorting algorithm has the best average-case time complexity?\nOptions:\nA) Bubble Sort O(n²)\nB) Merge Sort O(n log n)\nC) Insertion Sort O(n²)\nD) Selection Sort O(n²)\nAnswer:",
                      "B"),

        # Mathematics
        BenchmarkTask("mmlu_math_0", "Question: What is the derivative of x²?\nOptions:\nA) x\nB) 2x\nC) 2\nD) x²\nAnswer:",
                      "B"),
        BenchmarkTask("mmlu_math_1", "Question: What is the value of π to two decimal places?\nOptions:\nA) 3.14\nB) 3.16\nC) 3.12\nD) 3.18\nAnswer:",
                      "A"),
        BenchmarkTask("mmlu_math_2", "Question: What is the square root of 144?\nOptions:\nA) 10\nB) 11\nC) 12\nD) 13\nAnswer:",
                      "C"),

        # Physics
        BenchmarkTask("mmlu_phys_0", "Question: What is the speed of light in vacuum (approx)?\nOptions:\nA) 3 × 10⁶ m/s\nB) 3 × 10⁸ m/s\nC) 3 × 10¹⁰ m/s\nD) 3 × 10¹⁰ km/s\nAnswer:",
                      "B"),
        BenchmarkTask("mmlu_phys_1", "Question: Newton's second law states that F = ?\nOptions:\nA) ma\nB) mv\nC) m/a\nD) m + a\nAnswer:",
                      "A"),
        BenchmarkTask("mmlu_phys_2", "Question: What is the unit of electric current?\nOptions:\nA) Volt\nB) Ohm\nC) Ampere\nD) Watt\nAnswer:",
                      "C"),

        # Biology
        BenchmarkTask("mmlu_bio_0", "Question: What is the basic unit of life?\nOptions:\nA) Atom\nB) Molecule\nC) Cell\nD) Tissue\nAnswer:",
                      "C"),
        BenchmarkTask("mmlu_bio_1", "Question: DNA stands for?\nOptions:\nA) Deoxyribonucleic Acid\nB) Dioxyribonuclear Acid\nC) Deoxyribose Nucleic Atom\nD) Dynamic Nuclear Acid\nAnswer:",
                      "A"),
        BenchmarkTask("mmlu_bio_2", "Question: Which organelle produces energy in cells?\nOptions:\nA) Nucleus\nB) Ribosome\nC) Mitochondria\nD) Golgi apparatus\nAnswer:",
                      "C"),

        # History
        BenchmarkTask("mmlu_hist_0", "Question: Who was the first President of the United States?\nOptions:\nA) Thomas Jefferson\nB) George Washington\nC) John Adams\nD) Benjamin Franklin\nAnswer:",
                      "B"),
        BenchmarkTask("mmlu_hist_1", "Question: In which year did World War II end?\nOptions:\nA) 1943\nB) 1944\nC) 1945\nD) 1946\nAnswer:",
                      "C"),
        BenchmarkTask("mmlu_hist_2", "Question: The French Revolution began in which year?\nOptions:\nA) 1776\nB) 1789\nC) 1799\nD) 1804\nAnswer:",
                      "B"),
    ]


def _get_gsm8k_subset() -> List[BenchmarkTask]:
    """Small GSM8K subset — grade-school math word problems."""
    return [
        BenchmarkTask("gsm8k_0", "Problem: Sarah has 5 apples. She buys 3 more at the store. How many apples does she have now?\nAnswer:",
                      "8"),
        BenchmarkTask("gsm8k_1", "Problem: A rectangle has a length of 12 cm and a width of 5 cm. What is its area?\nAnswer:",
                      "60"),
        BenchmarkTask("gsm8k_2", "Problem: Tom saves $10 per week. How much does he save in 4 weeks?\nAnswer:",
                      "40"),
        BenchmarkTask("gsm8k_3", "Problem: There are 24 cookies in a box. If 6 friends share them equally, how many does each get?\nAnswer:",
                      "4"),
        BenchmarkTask("gsm8k_4", "Problem: A car travels at 60 mph for 2 hours. How far does it travel?\nAnswer:",
                      "120"),
    ]


def _get_hellaswag_subsets() -> List[BenchmarkTask]:
    """Small HellaSwag subset — commonsense reasoning / sentence completion."""
    return [
        BenchmarkTask("hellaswag_0",
                      "Context: The chef carefully prepared the ingredients. He started by\nOptions:\nA) chopping the vegetables and then seasoning them before cooking.\nB) flying to the kitchen to get the recipe from the internet.\nC) painting the walls of the restaurant blue.\nD) jumping out of the window to escape the noise.\nAnswer:",
                      "A"),
        BenchmarkTask("hellaswag_1",
                      "Context: After a long day at work, Maria decided to\nOptions:\nA) take a shower and relax on the couch with a good book.\nB) immediately start running a marathon across the city.\nC) build a house from scratch in her backyard.\nD) learn how to fly an airplane over the weekend.\nAnswer:",
                      "A"),
        BenchmarkTask("hellaswag_2",
                      "Context: The teacher explained the concept clearly. The students\nOptions:\nA) nodded along and took notes as she continued.\nB) immediately started a fire in the classroom.\nC) transformed into dragons and flew out the window.\nD) began speaking in ancient Sumerian without warning.\nAnswer:",
                      "A"),
    ]


def _get_aime_subsets() -> List[BenchmarkTask]:
    """Small AIME subset — competition math problems."""
    return [
        BenchmarkTask("aime_0", "Problem: What is the value of 1 + 2 + 3 + ... + 10?\nFind your answer.",
                      "55"),
        BenchmarkTask("aime_1", "Problem: If x² - 5x + 6 = 0, what is the larger root of x?\nFind your answer.",
                      "3"),
        BenchmarkTask("aime_2", "Problem: A regular hexagon has side length 4. What is its perimeter?\nFind your answer.",
                      "24"),
    ]


def _get_wikitext_2_sample() -> str:
    """Small wikitext-2 sample for perplexity evaluation."""
    return (
        "The quark was invented by Murray Gell-Mann . He named it after a line in James Joyce 's novel Finnegans Wake : `` Three quarks for Muster Mark ! ''\n"
        "The standard model of particle physics is a theory that describes the strong , weak , and electromagnetic fundamental forces of the universe .\n"
        "The theory is one of three major pillars of modern physics , along with general relativity and quantum mechanics .\n"
        "Neutrinos are subatomic particles which have no charge and very little mass . They pass through ordinary matter almost without interaction .\n"
        "The Higgs boson is a particle in the Standard Model of particle physics . It was predicted in 1964 , and found in 2012 at CERN ."
    )


# ── Benchmark types registry ───────────────────────────────────────────

BENCHMARK_TYPES: Dict[str, Dict[str, Any]] = {
    "throughput": {
        "label": "Throughput",
        "description": "Tokens generated per second (speed test)",
        "tasks_fn": lambda: [BenchmarkTask(
            "throughput_gen",
            "Write a short story about a robot learning to paint. Include details about colors, emotions, and creativity.",
            "N/A",
            category="performance",
            metadata={"n_predict": 256, "seed": 42}
        )],
    },
    "perplexity": {
        "label": "Perplexity",
        "description": "Language modeling quality (lower is better)",
        "tasks_fn": lambda: [BenchmarkTask(
            "ppl_wikitext",
            _get_wikitext_2_sample(),
            "N/A",
            category="quality",
            metadata={}
        )],
    },
    "mmlu": {
        "label": "MMLU (Knowledge)",
        "description": "5-subject multiple-choice knowledge test (accuracy %)",
        "tasks_fn": _get_mmlu_subset,
    },
    "gsm8k": {
        "label": "GSM8K (Math)",
        "description": "Grade-school math reasoning (exact match %)",
        "tasks_fn": _get_gsm8k_subset,
    },
    "hellaswag": {
        "label": "HellaSwag",
        "description": "Commonsense reasoning (accuracy %)",
        "tasks_fn": _get_hellaswag_subsets,
    },
    "aime": {
        "label": "AIME (Competition Math)",
        "description": "Competition-level math problems (exact match %)",
        "tasks_fn": _get_aime_subsets,
    },
}


def get_available_benchmarks() -> List[Dict[str, str]]:
    """Return list of available benchmark type info."""
    return [
        {"id": k, "label": v["label"], "description": v["description"]}
        for k, v in BENCHMARK_TYPES.items()
    ]


def get_tasks_for_benchmark(benchmark_id: str) -> List[BenchmarkTask]:
    """Get the task list for a given benchmark type."""
    if benchmark_id not in BENCHMARK_TYPES:
        raise ValueError(f"Unknown benchmark type: {benchmark_id}")
    return BENCHMARK_TYPES[benchmark_id]["tasks_fn"]()


# ── Execution engines ───────────────────────────────────────────────────

def _run_llama_cli(model_path: str, prompt: str, n_predict: int = 256,
                   threads: int = 8, temp: float = 0.1, seed: int = -1) -> str:
    """Run llama-cli with a prompt and return generated text."""
    cmd = [
        "llama-cli",
        "-m", model_path,
        "--prompt", prompt,
        "-n", str(n_predict),
        "-t", str(threads),
        "--temp", str(temp),
        "--seed", str(seed),
        "--log-disable",  # suppress logging noise
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"llama-cli failed (rc={result.returncode}): {result.stderr[:500]}")
    return result.stdout


def _run_llama_perplexity(model_path: str, text: str) -> Dict[str, float]:
    """Run llama-perplexity and parse perplexity score."""
    # Write text to a temp file (llama-perplexity reads from file)
    tmpfile = Path("/tmp/llama_launcher_ppl.txt")
    tmpfile.write_text(text)

    cmd = [
        "llama-perplexity",
        "-m", model_path,
        "-f", str(tmpfile),
        "--threads", "8",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    tmpfile.unlink(missing_ok=True)

    if result.returncode != 0:
        raise RuntimeError(f"llama-perplexity failed (rc={result.returncode}): {result.stderr[:500]}")

    # Parse perplexity from output: "Final estimate: PPL = X.XXXX +/- Y.YYYY"
    match = re.search(r'Final estimate:\s+PPL\s*=\s*([0-9.]+)', result.stdout)
    if not match:
        # Try alternate format
        match = re.search(r'ppl\s*=\s*([0-9.]+)', result.stdout, re.IGNORECASE)

    if match:
        ppl = float(match.group(1))
        return {"perplexity": ppl, "raw_output": result.stdout}
    else:
        # Fallback: try to extract any number after PPL
        match = re.search(r'PPL\s*=\s*([0-9.]+)', result.stdout)
        if match:
            return {"perplexity": float(match.group(1)), "raw_output": result.stdout}
        raise RuntimeError(f"Could not parse perplexity from output:\n{result.stdout[:500]}")


def _eval_throughput(model_path: str, task: BenchmarkTask) -> BenchmarkResult:
    """Run throughput benchmark."""
    t0 = time.perf_counter()
    output = _run_llama_cli(
        model_path, task.prompt,
        n_predict=task.metadata.get("n_predict", 256),
        threads=8, temp=0.1, seed=task.metadata.get("seed", -1)
    )
    elapsed = time.perf_counter() - t0

    # Count generated tokens (rough: words ≈ tokens for English)
    token_count = len(output.split())
    throughput = round(token_count / elapsed, 2) if elapsed > 0 else 0

    return BenchmarkResult(
        task_id=task.id, prompt=task.prompt, gold_answer=task.gold_answer,
        model_output=output, score=throughput,
        metadata={"elapsed_seconds": round(elapsed, 3), "tokens_generated": token_count,
                  "throughput_tok_per_sec": throughput}
    )


def _eval_perplexity(model_path: str, task: BenchmarkTask) -> BenchmarkResult:
    """Run perplexity benchmark."""
    result = _run_llama_perplexity(model_path, task.prompt)
    ppl = result["perplexity"]

    # For perplexity, lower is better. Normalize to 0-1 scale (1 - log2(ppl)/10)
    normalized = max(0.0, min(1.0, 1.0 - (ppl / 100.0)))

    return BenchmarkResult(
        task_id=task.id, prompt=task.prompt[:200], gold_answer=task.gold_answer,
        model_output="", score=normalized,
        metadata={"perplexity": ppl, "raw_result": result.get("raw_output", "")}
    )


def _extract_mc_choice(text: str) -> Optional[str]:
    """Extract a single-letter choice (A/B/C/D) from model output."""
    # Look for standalone letters A-D
    match = re.search(r'\b([A-D])\b', text.strip())
    if match:
        return match.group(1).upper()
    # Look for "Answer: X" pattern
    match = re.search(r'[Aa]nswer[:\s]*[=]?\s*([A-D])', text.strip(), re.IGNORECASE)
    if match:
        return match.group(1).upper()
    # Look for first occurrence of A), B), C), D)
    match = re.search(r'\b([A-D])\)', text.strip())
    if match:
        return match.group(1).upper()
    return None


def _extract_number(text: str) -> Optional[str]:
    """Extract a numeric answer from model output."""
    # Look for a standalone number (int or float)
    match = re.search(r'(?<![a-zA-Z])(-?\d+(?:\.\d+)?)(?![a-zA-Z])', text.strip())
    if match:
        return match.group(1)
    return None


def _eval_multiple_choice(model_path: str, task: BenchmarkTask,
                          few_shot: int = 0) -> BenchmarkResult:
    """Run a multiple-choice benchmark (MMLU, HellaSwag)."""
    # Build prompt with few-shot examples if needed
    prompt = task.prompt

    output = _run_llama_cli(
        model_path, prompt, n_predict=16, threads=8, temp=0.1, seed=42
    )

    predicted = _extract_mc_choice(output)
    correct = predicted == task.gold_answer

    return BenchmarkResult(
        task_id=task.id, prompt=task.prompt[:200], gold_answer=task.gold_answer,
        model_output=output.strip(), correct=correct,
        score=1.0 if correct else 0.0,
        metadata={"predicted_choice": predicted}
    )


def _eval_math(model_path: str, task: BenchmarkTask) -> BenchmarkResult:
    """Run a math benchmark (GSM8K, AIME)."""
    output = _run_llama_cli(
        model_path, task.prompt, n_predict=128, threads=8, temp=0.1, seed=42
    )

    predicted = _extract_number(output)
    correct = predicted == task.gold_answer

    return BenchmarkResult(
        task_id=task.id, prompt=task.prompt[:200], gold_answer=task.gold_answer,
        model_output=output.strip(), correct=correct,
        score=1.0 if correct else 0.0,
        metadata={"predicted_answer": predicted}
    )


# ── Benchmark runner ───────────────────────────────────────────────────

def run_benchmark_task(
    model_path: str,
    benchmark_id: str,
    task: BenchmarkTask,
) -> BenchmarkResult:
    """Run a single benchmark task and return the result."""
    if benchmark_id == "throughput":
        return _eval_throughput(model_path, task)
    elif benchmark_id == "perplexity":
        return _eval_perplexity(model_path, task)
    elif benchmark_id == "mmlu":
        return _eval_multiple_choice(model_path, task)
    elif benchmark_id == "gsm8k":
        return _eval_math(model_path, task)
    elif benchmark_id == "hellaswag":
        return _eval_multiple_choice(model_path, task)
    elif benchmark_id == "aime":
        return _eval_math(model_path, task)
    else:
        raise ValueError(f"Unknown benchmark type: {benchmark_id}")


def run_benchmark_suite(
    model_path: str,
    benchmark_ids: List[str],
    n_tasks_per_benchmark: int = 3,
    threads: int = 8,
    seed: int = 42,
) -> Dict[str, Any]:
    """Run a full benchmark suite across multiple benchmark types.

    Returns a dict with per-benchmark aggregate scores and per-task results.
    """
    all_results: Dict[str, List[BenchmarkResult]] = {}
    aggregates: Dict[str, Dict[str, Any]] = {}

    for bid in benchmark_ids:
        tasks = get_tasks_for_benchmark(bid)
        # Limit to n_tasks_per_benchmark if more available
        tasks = tasks[:n_tasks_per_benchmark]

        results: List[BenchmarkResult] = []
        for task in tasks:
            try:
                result = run_benchmark_task(model_path, bid, task)
                results.append(result)
            except Exception as e:
                # Record failure
                results.append(BenchmarkResult(
                    task_id=task.id, prompt=task.prompt[:200],
                    gold_answer=task.gold_answer, model_output="",
                    score=0.0, correct=False,
                    metadata={"error": str(e)}
                ))

        all_results[bid] = results

        # Compute aggregate
        info = BENCHMARK_TYPES[bid]
        if bid == "throughput":
            avg_tps = sum(r.metadata.get("throughput_tok_per_sec", 0) for r in results) / max(len(results), 1)
            aggregates[bid] = {
                "label": info["label"],
                "score": round(avg_tps, 2),
                "unit": "tokens/sec",
                "higher_is_better": True,
                "tasks_run": len(results),
                "task_results": [asdict(r) for r in results],
            }
        elif bid == "perplexity":
            avg_ppl = sum(r.metadata.get("perplexity", 100.0) for r in results) / max(len(results), 1)
            aggregates[bid] = {
                "label": info["label"],
                "score": round(avg_ppl, 2),
                "unit": "perplexity (lower is better)",
                "higher_is_better": False,
                "tasks_run": len(results),
                "task_results": [asdict(r) for r in results],
            }
        else:
            # Multiple choice / math: accuracy %
            correct_count = sum(1 for r in results if r.correct)
            accuracy = round(correct_count / max(len(results), 1) * 100, 1)
            aggregates[bid] = {
                "label": info["label"],
                "score": accuracy,
                "unit": "% correct",
                "higher_is_better": True,
                "tasks_run": len(results),
                "correct": correct_count,
                "task_results": [asdict(r) for r in results],
            }

    return {
        "model_path": model_path,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "benchmarks": aggregates,
        "all_results": all_results,
    }


def run_multi_model_benchmark(
    model_paths: List[str],
    benchmark_ids: List[str],
    n_tasks_per_benchmark: int = 3,
) -> Dict[str, Any]:
    """Run benchmarks on multiple models and return a comparison report."""
    results_by_model: Dict[str, Dict[str, Any]] = {}

    for model_path in model_paths:
        print(f"Running benchmarks on: {model_path}")
        result = run_benchmark_suite(model_path, benchmark_ids, n_tasks_per_benchmark)
        results_by_model[model_path] = result

    return {
        "models": list(results_by_model.keys()),
        "results": results_by_model,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# ── Results persistence ────────────────────────────────────────────────

_RESULTS_DIR = Path.home() / ".cache" / "llama-launcher" / "benchmark_results"


def save_benchmark_result(report: Dict[str, Any], name: str = "") -> str:
    """Save benchmark result to disk and return the file path."""
    _RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    if not name:
        model_name = Path(report["model_path"]).stem if "model_path" in report else "unknown"
        ts = time.strftime("%Y%m%d_%H%M%S")
        name = f"{model_name}_{ts}"

    filepath = _RESULTS_DIR / f"{name}.json"
    filepath.write_text(json.dumps(report, indent=2, default=str))
    return str(filepath)


def load_benchmark_results() -> List[Dict[str, Any]]:
    """Load all saved benchmark result summaries."""
    _RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    for json_file in sorted(_RESULTS_DIR.glob("*.json")):
        try:
            data = json.loads(json_file.read_text())
            results.append({
                "file": str(json_file),
                "name": json_file.stem,
                "timestamp": data.get("timestamp", ""),
                "model_path": data.get("model_path", ""),
                "benchmarks": {k: v.get("score", 0) for k, v in data.get("benchmarks", {}).items()},
            })
        except (json.JSONDecodeError, KeyError):
            continue

    return results


def load_benchmark_result(file_path: str) -> Dict[str, Any]:
    """Load a full benchmark result from disk."""
    filepath = Path(file_path)
    if not filepath.exists():
        raise FileNotFoundError(f"Benchmark result not found: {file_path}")
    return json.loads(filepath.read_text())
