# Comprehensive Improvements Plan

## Overview
This plan covers all items from 07_improvements_*/08_todo plus new user requests.
All work follows strict TDD: write failing test first → watch it fail → minimal code → watch it pass.

## Task Group A: Fix All Failing Tests (Alias Removal)
**Source:** 08_todo Item 7 + 9 failing alias tests
- Remove all alias code from backend (api_server.py, context.py, model_manager.py)
- Delete model_aliases.json
- Update LaunchPage to use TemplateLoader.resolveAlias directly
- All 9 failing tests should pass after removal

## Task Group B: Max Tokens Validation Fix
**Source:** 07_improvements_07.md
- Frontend validates n_predict: -1 to 4096
- Backend _clamp_n_predict: -1 or 1..4096
- Ensure both agree on the -1 (unlimited) case

## Task Group C: Template Save/Load with INI Support + File Picker
**Source:** 08_todo Items 3, 10
- Add saveTemplateAsIni / loadTemplateFromIni to templateLoader.ts
- Add file picker buttons in LaunchPage for saving/loading templates
- Support both .ini and .json formats

## Task Group D: Show Currently Running Model
**Source:** User request
- Display which model is currently being used even when not running
- Show on Models page and/or Launch page

## Task Group E: Dashboard GPU Metrics Improvements
**Source:** 07_improvements_03.md + user request
- Improve GPU memory display with per-GPU breakdown
- Add GPU temperature and power draw to overview
- Better error handling when no GPU detected

## Task Group F: Benchmark Tab
**Source:** User new request
- Create new BenchmarkPage component at ui/src/modules/benchmark/
- Add benchmark API endpoint for running model benchmarks
- Compare model performance vs standard benchmarks
- Display results in a table/chart format
- Add route to App.tsx and sidebar nav

## Task Group G: Auto-build UI + pynvml + logging path + settings cleanup
**Source:** 08_todo Items 1, 2, 11, 12
- Auto-build UI in launcher.py
- Add pynvml to pyproject.toml
- Change logging paths to ~/.cache/llama-launcher/
- Clean up SettingsPage

## Task Group H: E2E Tests (3 new)
- E2E test for template save/load with INI format
- E2E test for benchmark tab
- E2E test for GPU metrics display
