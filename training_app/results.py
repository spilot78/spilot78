from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from .models import TrainingResult

DEFAULT_LOG_PATH = Path("data/training_results.json")


def record_results(results: Iterable[TrainingResult], path: Path = DEFAULT_LOG_PATH) -> None:
    """Append new results to a JSON log for after-action review."""

    path.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if path.exists():
        with path.open("r", encoding="utf-8") as file:
            try:
                existing = json.load(file)
            except json.JSONDecodeError:
                existing = []
    payload = existing + [result.to_dict() for result in results]
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)
