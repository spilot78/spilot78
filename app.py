from __future__ import annotations

from typing import Optional

from training_app.models import Soldier, evaluate_scenario
from training_app.results import record_results
from training_app.scenarios import get_scenario, list_scenarios


def prompt_soldier() -> Soldier:
    name = input("Enter your name: ").strip()
    rank = input("Enter your rank: ").strip()
    return Soldier(name=name, rank=rank)


def prompt_scenario() -> Optional[str]:
    print("\nAvailable training scenarios:")
    for scenario in list_scenarios():
        print(f"- {scenario.id}: {scenario.name} (Pass: {scenario.pass_score})")
        print(f"  {scenario.description}")
    scenario_id = input("\nEnter scenario ID to launch (or press Enter to cancel): ").strip().upper()
    return scenario_id or None


def prompt_score() -> int:
    while True:
        raw = input("Enter your performance score (0-100): ").strip()
        if raw.isdigit():
            score = int(raw)
            if 0 <= score <= 100:
                return score
        print("Please provide a numeric score between 0 and 100.")


def run_cli() -> None:
    print("=== Virtual Training Device Launcher ===")
    soldier = prompt_soldier()
    scenario_id = prompt_scenario()
    if not scenario_id:
        print("No scenario selected. Exiting.")
        return
    try:
        scenario = get_scenario(scenario_id)
    except KeyError:
        print(f"Scenario '{scenario_id}' not found. Exiting.")
        return

    score = prompt_score()
    result = evaluate_scenario(soldier, scenario, score)
    record_results([result])

    status = "PASS" if result.passed else "FAIL"
    print("\n=== Results ===")
    print(f"Soldier: {result.soldier.display_name()}")
    print(f"Scenario: {scenario.name}")
    print(f"Score: {result.score} | Outcome: {status}")
    print(f"Feedback: {result.feedback}")
    print("Result logged to data/training_results.json")


if __name__ == "__main__":
    run_cli()
