#!/usr/bin/env python3
from __future__ import annotations


def check_prompt(prompt: str, metadata: dict | None = None) -> list[str]:
    """Validate a prompt against ZERA principles (Completeness, Conciseness, Correctness, Expression Style)."""
    warnings: list[str] = []

    has_context = "CONTEXT" in prompt.upper() or "context" in prompt.lower()
    has_goal = "GOAL" in prompt.upper() or "goal" in prompt.lower()
    has_request = "REQUEST" in prompt.upper() or "request" in prompt.lower()

    if not has_context:
        warnings.append("MISSING CONTEXT: Specify task, files involved, and patterns to match")
    if not has_goal:
        warnings.append("MISSING GOAL: What decision or action will this unblock?")
    if not has_request:
        warnings.append("MISSING REQUEST: Concrete instructions with scope boundaries")

    if "..." in prompt:
        warnings.append("VAGUE: Ellipsis suggests incomplete instructions")
    if "etc" in prompt.lower() or "et al" in prompt.lower():
        warnings.append("VAGUE: 'etc'/'et al' — enumerate explicitly")
    if "should" in prompt.lower() and "must" not in prompt.lower():
        warnings.append("AMBIGUOUS: Use 'must' for hard constraints, 'should' for soft ones")

    filler_patterns = [
        "i'd like you to", "could you please", "can you help me",
        "i wonder if", "perhaps you could", "maybe try",
    ]
    prompt_lower = prompt.lower()
    for filler in filler_patterns:
        if filler in prompt_lower:
            warnings.append(f"FILLER: Remove '{filler}' — use direct imperative language")

    if len(prompt.split()) > 300:
        warnings.append("TOO LONG: Consider splitting into focused subtasks")

    if "grep" in prompt_lower and "rg" in prompt_lower:
        warnings.append("CONFLICT: Using both grep and rg — pick one")
    if "find" in prompt_lower and "glob" in prompt_lower:
        warnings.append("CONFLICT: Using both find and glob — pick one")

    question_patterns = [
        "do you think", "what about", "how about",
        "i'm not sure if", "i don't know if",
    ]
    for qpat in question_patterns:
        if qpat in prompt_lower:
            warnings.append(f"UNCLEAR: '{qpat}' — state requirements directly, don't ask")

    return warnings


def fast_check(prompt_text: str) -> bool:
    """Returns True if prompt passes critical ZERA checks (MISSING or CONFLICT)."""
    warnings = check_prompt(prompt_text)
    return not any(w.startswith("MISSING") or w.startswith("CONFLICT") for w in warnings)


ANTI_PATTERNS = {
    "too_vague": "Find all auth patterns",  # no scope, format, or depth
    "too_vague_2": "Improve the code",  # doesn't specify what's wrong or target improvement
    "too_broad": "Refactor the entire project",  # scope creep
    "self_referential": "Fix the bug you created",  # agent can't self-review effectively
    "no_constraints": "Make it faster",  # no measurable target
}

GOOD_PATTERNS = {
    "specific_scope": "Find JWT auth middleware in src/api/routes/ and src/middleware/. Return file paths and line numbers.",
    "measurable": "Reduce model_manager.py init time from ~200ms to <50ms by deferring expensive imports.",
    "clear_constraints": "Fix null config handling in cli.py line 42. Must not change any other behavior. Add null check before dict access.",
    "decomposed": "Split into: 1) Add null check to config.py Config.load(). 2) Add test in tests/test_config.py.",
}
