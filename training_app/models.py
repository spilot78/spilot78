from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class Soldier:
    """Represents the soldier operating the virtual training device."""

    name: str
    rank: str

    def display_name(self) -> str:
        return f"{self.rank.title()} {self.name.title()}"


@dataclass
class Scenario:
    """Single training scenario definition."""

    id: str
    name: str
    description: str
    pass_score: int
    guidance: List[str] = field(default_factory=list)

    def feedback(self, score: int) -> str:
        if score >= self.pass_score:
            return "Excellent work. You met the required standard for this scenario."
        shortfall = self.pass_score - score
        hints = " ".join(self.guidance)
        return (
            f"You missed the pass mark by {shortfall} point(s). Focus on: {hints}".strip()
            or "Review the scenario guidance to improve."
        )


@dataclass
class TrainingResult:
    """Outcome of a scenario run."""

    soldier: Soldier
    scenario: Scenario
    score: int
    passed: bool
    feedback: str
    recorded_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "soldier": self.soldier.display_name(),
            "scenario": self.scenario.name,
            "score": self.score,
            "passed": self.passed,
            "feedback": self.feedback,
            "recorded_at": self.recorded_at.isoformat() + "Z",
        }


def evaluate_scenario(soldier: Soldier, scenario: Scenario, score: int) -> TrainingResult:
    """Create a result object based on performance against a scenario."""

    passed = score >= scenario.pass_score
    feedback = scenario.feedback(score)
    return TrainingResult(
        soldier=soldier,
        scenario=scenario,
        score=score,
        passed=passed,
        feedback=feedback,
    )
