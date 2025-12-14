from __future__ import annotations

from typing import Dict, List

from .models import Scenario


SCENARIOS: Dict[str, Scenario] = {
    "MKS-101": Scenario(
        id="MKS-101",
        name="Fundamental Marksmanship",
        description="Zeroing weapon, basic sight picture, and trigger control on static targets.",
        pass_score=75,
        guidance=[
            "Confirm zero at 25m before engaging longer ranges.",
            "Maintain consistent breathing to steady aim.",
            "Check sight alignment after each string.",
        ],
    ),
    "MKS-201": Scenario(
        id="MKS-201",
        name="Moving Target Engagement",
        description="Track and engage lateral moving targets at varied distances.",
        pass_score=80,
        guidance=[
            "Lead targets smoothly rather than snapping aim.",
            "Fire controlled pairs to maximize hit probability.",
            "Anticipate target speed changes between lanes.",
        ],
    ),
    "MKS-301": Scenario(
        id="MKS-301",
        name="Stress Shoot Evaluation",
        description="Timed engagement after physical exertion with immediate action drills.",
        pass_score=85,
        guidance=[
            "Control breathing after exertion before acquiring sights.",
            "Prioritize malfunction drills to minimize downtime.",
            "Reassess shot placement after every reload.",
        ],
    ),
}


def list_scenarios() -> List[Scenario]:
    """Return all available scenarios as an ordered list."""

    return list(SCENARIOS.values())


def get_scenario(scenario_id: str) -> Scenario:
    """Retrieve a scenario by its ID or raise a KeyError if missing."""

    return SCENARIOS[scenario_id]
