# User Testing Guide

Follow these steps to manually validate the Virtual Training Device Launcher from a soldier's perspective.

## Prerequisites
- Python 3.9+ installed.
- From the project root, run the CLI with `python app.py`.
- Delete any prior `data/training_results.json` if you want a clean log for testing.

## Test Cases

### 1. Capture identity and cancel
- Launch the app and enter a sample name and rank (e.g., `Taylor` / `Sergeant`).
- When asked for the scenario ID, press Enter to cancel.
- **Expected:** The app prints "No scenario selected. Exiting." and no log file is created or modified.

### 2. Reject an invalid scenario ID
- Launch the app and enter a sample name and rank.
- Enter an invalid scenario ID such as `BAD-1`.
- **Expected:** The app prints "Scenario 'BAD-1' not found. Exiting." and does not write to `data/training_results.json`.

### 3. Run a passing attempt
- Launch the app and enter a name and rank.
- Choose `MKS-101` when prompted, then enter a score of `85`.
- **Expected:**
  - Results section shows `PASS`.
  - Feedback states the soldier met the standard.
  - `data/training_results.json` is created with a new entry showing the soldier display name, scenario name, score `85`, and `passed: true`.

### 4. Run a failing attempt with guidance
- Launch the app and enter a name and rank.
- Choose `MKS-201`, then enter a score of `60`.
- **Expected:**
  - Results section shows `FAIL`.
  - Feedback highlights the shortfall from the pass mark and includes guidance bullet points (lead smoothly, controlled pairs, anticipate speed changes).
  - The log file gains a new entry with `passed: false` and recorded feedback.

### 5. Score validation guardrails
- When prompted for a performance score, enter text such as `abc`, then `-5`, then `101`.
- **Expected:** The CLI repeats the prompt until a valid numeric score between 0 and 100 is provided.

### 6. Verify cumulative logging
- After running multiple scenarios, open `data/training_results.json`.
- **Expected:** Each run appends a new JSON object to the array without overwriting prior entries. Timestamps are in ISO format with a trailing `Z`.

## Tips for smooth testing
- Use different names/ranks to confirm the display format (e.g., `Sgt Taylor`).
- Keep the terminal history handy to rerun scenarios quickly.
- Remove `data/training_results.json` between tests if you want to start fresh.
