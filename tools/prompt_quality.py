#!/usr/bin/env python3
"""
Spell Check MCP Server — Quality gate for all prompts and code before they're sent.

Provides:
  - spell_check(text, lang='en') → list of spelling errors with suggestions
  - spell_check_file(path, lang='en') → list of spelling errors in a file
  - check_prompt_quality(text) → ZERA framework validation + spell check combined
  - spell_and_fix(text, lang='en') → returns corrected text with changes listed
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

try:
    from spellchecker import SpellChecker
except ImportError:
    sys.exit("ERROR: pyspellchecker not installed. Run: pip install pyspellchecker")

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    sys.exit("ERROR: mcp SDK not installed. Run: pip install mcp")

mcp = FastMCP("prompt-quality")

# Global spellcheckers keyed by language
_spell_cache: dict[str, SpellChecker] = {}


def _get_spell_checker(lang: str = "en") -> SpellChecker:
    if lang not in _spell_cache:
        _spell_cache[lang] = SpellChecker(language=lang)
    return _spell_cache[lang]


@mcp.tool()
def spell_check(text: str, lang: str = "en") -> list[dict[str, Any]]:
    """Find spelling errors in text. Returns list of errors with word, position, and suggestions."""
    checker = _get_spell_checker(lang)
    misspelled = checker.word_frequency.word_freq  # trigger frequency loading
    errors = []
    words = text.split()
    pos = 0
    for word in words:
        clean = word.strip(".,!?;:\"'()[]{}.,!?;:\"'()[]{}—–-")
        if clean and checker.unknown([clean]):
            suggestions = checker.corrections([clean])[0].suggest if checker.corrections([clean]) else []
            errors.append({
                "word": clean,
                "suggestions": suggestions[:5],
                "confidence": float(checker.word_frequency.word_prob(clean)) if clean in checker.word_frequency.word_freq else 0.0,
            })
        pos += len(word) + 1
    return errors


@mcp.tool()
def spell_check_file(path: str, lang: str = "en") -> list[dict[str, Any]]:
    """Find spelling errors in a file. Returns list with file, line number, and errors."""
    filepath = Path(path)
    if not filepath.exists():
        return [{"error": f"File not found: {path}"}]

    checker = _get_spell_checker(lang)
    errors = []
    try:
        text = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        return [{"error": str(e)}]

    for line_num, line in enumerate(text.splitlines(), 1):
        # Skip code comments, URLs, and technical terms
        stripped = line.strip()
        if stripped.startswith(("#", "//", "/*", "*/", "```")):
            continue
        # Skip import lines, type annotations, and code blocks
        if any(kw in stripped for kw in ["import ", "from ", "-> ", "def ", "class ", "const ", "let ", "var "]):
            continue
        words = line.split()
        pos = 0
        for word in words:
            clean = word.strip(".,!?;:\"'()[]{}.,!?;:\"'()[]{}—–-")
            if clean and len(clean) > 2 and checker.unknown([clean]):
                errors.append({
                    "line": line_num,
                    "word": clean,
                    "suggestions": list(checker.corrections([clean])[0].suggest)[:5] if checker.corrections([clean]) else [],
                })
    return errors


@mcp.tool()
def spell_and_fix(text: str, lang: str = "en") -> dict[str, Any]:
    """Spell-check text and return corrected version with change list."""
    checker = _get_spell_checker(lang)
    changes = []
    corrected_words = []
    words = text.split()
    for word in words:
        clean = word.strip(".,!?;:\"'()[]{}.,!?;:\"'()[]{}—–-")
        if clean and len(clean) > 2 and checker.unknown([clean]):
            corrections = checker.corrections([clean])
            if corrections and corrections[0]:
                replacement = str(corrections[0])
                changes.append({"original": clean, "replacement": replacement})
                corrected_words.append(replacement)
            else:
                corrected_words.append(word)
        else:
            corrected_words.append(word)
    return {
        "original": text,
        "corrected": " ".join(corrected_words),
        "changes": changes,
        "total_changes": len(changes),
    }


@mcp.tool()
def check_prompt_quality(text: str, lang: str = "en") -> dict[str, Any]:
    """Full prompt quality check: ZERA principles + spell check combined."""
    warnings = []
    prompt_lower = text.lower()

    has_context = "CONTEXT" in text.upper() or "context" in prompt_lower
    has_goal = "GOAL" in text.upper() or "goal" in prompt_lower
    has_request = "REQUEST" in text.upper() or "request" in prompt_lower

    if not has_context:
        warnings.append({"type": "MISSING", "section": "CONTEXT", "detail": "Specify task, files involved, and patterns to match"})
    if not has_goal:
        warnings.append({"type": "MISSING", "section": "GOAL", "detail": "What decision or action will this unblock?"})
    if not has_request:
        warnings.append({"type": "MISSING", "section": "REQUEST", "detail": "Concrete instructions with scope boundaries"})

    filler_patterns = ["i'd like you to", "could you please", "can you help me", "i wonder if", "perhaps you could", "maybe try"]
    for filler in filler_patterns:
        if filler in prompt_lower:
            warnings.append({"type": "FILLER", "detail": f"Remove '{filler}' — use direct imperative language"})

    if "..." in text:
        warnings.append({"type": "VAGUE", "detail": "Ellipsis suggests incomplete instructions"})
    if "etc" in prompt_lower:
        warnings.append({"type": "VAGUE", "detail": "'etc' — enumerate explicitly"})
    if "should" in prompt_lower and "must" not in prompt_lower:
        warnings.append({"type": "AMBIGUOUS", "detail": "Use 'must' for hard constraints"})

    if len(text.split()) > 300:
        warnings.append({"type": "CONCISENESS", "detail": "Too long — consider splitting into focused subtasks"})

    question_patterns = ["do you think", "what about", "how about", "i'm not sure if"]
    for qpat in question_patterns:
        if qpat in prompt_lower:
            warnings.append({"type": "UNCLEAR", "detail": f"'{qpat}' — state requirements directly"})

    # Spell check on the text
    checker = _get_spell_checker(lang)
    spell_errors = []
    words = text.split()
    for word in words:
        clean = word.strip(".,!?;:\"'()[]{}.,!?;:\"'()[]{}—–-")
        if clean and len(clean) > 2 and checker.unknown([clean]):
            spell_errors.append({
                "word": clean,
                "suggestions": list(checker.corrections([clean])[0].suggest)[:3] if checker.corrections([clean]) else [],
            })

    return {
        "zera_issues": warnings,
        "spell_errors": spell_errors,
        "total_zera_issues": len(warnings),
        "total_spell_errors": len(spell_errors),
        "pass": len(warnings) == 0 and len(spell_errors) == 0,
    }


def main():
    """CLI interface for spell-check server."""
    parser = argparse.ArgumentParser(description="Spell Check MCP Server — CLI interface")
    subparsers = parser.add_subparsers(dest="command")

    # spell command
    spell_parser = subparsers.add_parser("spell", help="Check spelling of text")
    spell_parser.add_argument("text", help="Text to check")
    spell_parser.add_argument("--lang", default="en", help="Language code (default: en)")

    # file command
    file_parser = subparsers.add_parser("file", help="Check spelling of a file")
    file_parser.add_argument("path", help="File path to check")
    file_parser.add_argument("--lang", default="en", help="Language code (default: en)")

    # fix command
    fix_parser = subparsers.add_parser("fix", help="Spell-check and fix text")
    fix_parser.add_argument("text", help="Text to fix")
    fix_parser.add_argument("--lang", default="en", help="Language code (default: en)")

    # quality command
    quality_parser = subparsers.add_parser("quality", help="Full prompt quality check (ZERA + spell)")
    quality_parser.add_argument("text", help="Prompt text to check")
    quality_parser.add_argument("--lang", default="en", help="Language code (default: en)")

    args = parser.parse_args()

    if args.command == "spell":
        result = spell_check(args.text, args.lang)
        print(f"Found {len(result)} spelling error(s):")
        for err in result:
            print(f"  '{err['word']}' → suggestions: {err['suggestions']}")
        sys.exit(0 if not result else 1)

    elif args.command == "file":
        result = spell_check_file(args.path, args.lang)
        if "error" in result[0]:
            print(f"Error: {result[0]['error']}")
            sys.exit(2)
        print(f"Found {len(result)} spelling error(s) in {args.path}:")
        for err in result:
            print(f"  Line {err['line']}: '{err['word']}' → suggestions: {err['suggestions']}")
        sys.exit(0 if not result else 1)

    elif args.command == "fix":
        result = spell_and_fix(args.text, args.lang)
        if result["changes"]:
            print("Original:")
            print(f"  {result['original']}")
            print(f"\nCorrected:")
            print(f"  {result['corrected']}")
            print(f"\nChanges ({result['total_changes']}):")
            for c in result["changes"]:
                print(f"  {c['original']} → {c['replacement']}")
        else:
            print("No spelling errors found.")
        sys.exit(1 if result["changes"] else 0)

    elif args.command == "quality":
        result = check_prompt_quality(args.text, args.lang)
        status = "PASS" if result["pass"] else "FAIL"
        print(f"Prompt Quality: {status}")
        print(f"  ZERA issues: {result['total_zera_issues']}")
        print(f"  Spell errors: {result['total_spell_errors']}")
        if result["zera_issues"]:
            print("\nZERA Issues:")
            for issue in result["zera_issues"]:
                print(f"  [{issue['type']}] {issue.get('detail', issue)}")
        if result["spell_errors"]:
            print("\nSpelling Errors:")
            for err in result["spell_errors"]:
                print(f"  '{err['word']}' → {err['suggestions']}")
        sys.exit(0 if result["pass"] else 1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
