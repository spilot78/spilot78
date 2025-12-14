from training_app.models import Soldier, evaluate_scenario
from training_app.results import record_results
from training_app.scenarios import get_scenario, list_scenarios


def test_scenarios_available():
    scenario_ids = {scenario.id for scenario in list_scenarios()}
    assert {"MKS-101", "MKS-201", "MKS-301"}.issubset(scenario_ids)


def test_evaluate_scenario_pass():
    soldier = Soldier(name="Jane Doe", rank="sergeant")
    scenario = get_scenario("MKS-101")
    result = evaluate_scenario(soldier, scenario, score=90)

    assert result.passed is True
    assert "met the required standard" in result.feedback


def test_evaluate_scenario_fail(tmp_path):
    soldier = Soldier(name="John Doe", rank="private")
    scenario = get_scenario("MKS-201")
    result = evaluate_scenario(soldier, scenario, score=65)

    assert result.passed is False
    assert "Focus on" in result.feedback


def test_record_results(tmp_path):
    soldier = Soldier(name="Alex Smith", rank="captain")
    scenario = get_scenario("MKS-301")
    result = evaluate_scenario(soldier, scenario, score=88)

    log_path = tmp_path / "log.json"
    record_results([result], path=log_path)

    content = log_path.read_text()
    assert soldier.display_name() in content
    assert scenario.name in content
