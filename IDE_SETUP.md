# IDE launch guide

This project runs as a simple Python CLI. Use the steps below to open the repo in a Python-friendly IDE and run or debug the app.

## Prerequisites
- Python 3.10+ available on your system.
- (Optional) A virtual environment with `pytest` installed for running the tests.

## Open the project
1. Start your IDE (e.g., VS Code, PyCharm) and **open the repository root** (`/workspace/spilot78`).
2. Ensure the IDE uses a Python interpreter that can run the project (select your venv interpreter if you created one).

## Configure and run the CLI
1. Create a run/debug configuration that launches `app.py`:
   - **Script/module**: `app.py`
   - **Working directory**: the project root (`/workspace/spilot78`) so results save to `data/training_results.json`.
   - No additional environment variables are required.
2. Start the run/debug configuration. The console will prompt you to enter:
   - Soldier name
   - Soldier rank
   - Scenario ID from the printed list
   - Performance score (0-100)
3. After entering the inputs, the app prints pass/fail status and feedback, then writes the result to `data/training_results.json`.

## Run tests inside the IDE
- Configure a test run to execute `pytest` from the project root.
- Confirm the working directory is set to the repository root so imports resolve correctly.

## Troubleshooting
- If the IDE cannot find project modules, add the repository root to the Python path in your run/debug configuration.
- Delete `data/training_results.json` if you want a fresh log before the next run; the app will recreate it automatically.
