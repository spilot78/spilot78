# Virtual Training Device Launcher

A lightweight CLI for soldiers to connect their profile, launch marksmanship scenarios, track performance, and receive feedback.

## Features
- Capture soldier name and rank to tag results.
- Launch curated marksmanship training scenarios.
- Evaluate performance against scenario pass criteria.
- Store results for after-action review with pass/fail status and feedback.

## Getting Started
1. Create a virtual environment (optional) and install `pytest` if you want to run tests.
2. Run the CLI from a terminal or your IDE:
   ```bash
   python app.py
   ```
3. Follow the prompts to enter your name, rank, select a scenario, and provide your score. Results are saved to `data/training_results.json`.

For IDE-specific steps (VS Code, PyCharm, etc.), see the [IDE launch guide](IDE_SETUP.md).

## User testing
For a step-by-step manual test plan (including expected outputs and log checks), see [USER_TESTING.md](USER_TESTING.md).

## Testing
Run the automated checks with:
```bash
pytest
```
