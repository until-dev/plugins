"""Pure get_plan → local session stage for until-track-state."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

DEFAULT_UPLOAD_WINDOW = timedelta(minutes=15)
PLAN_ID_RE = re.compile(r"^UNTIL-[0-9]+$")
CHANGES_REQUESTED_AFTER_APPROVAL = "changes_requested_after_approval"
RECOGNIZED_REQUIREMENTS = frozenset({"required", "not_required"})


def _plan_status(result: dict) -> str:
    status = result.get("status") or result.get("lifecycle_stage") or ""
    return status.lower() if isinstance(status, str) else ""


def _lifecycle_stage(result: dict) -> str:
    lifecycle = result.get("lifecycle")
    if not isinstance(lifecycle, dict):
        return ""
    stage = lifecycle.get("stage")
    return stage.lower() if isinstance(stage, str) else ""


def _lifecycle_reason(result: dict) -> str:
    lifecycle = result.get("lifecycle")
    if not isinstance(lifecycle, dict):
        return ""
    reason = lifecycle.get("reason")
    return reason if isinstance(reason, str) else ""


def _review_policy(result: dict) -> tuple[str, str] | None:
    review = result.get("review")
    if not isinstance(review, dict):
        return None
    requirement = review.get("requirement")
    if not isinstance(requirement, str):
        return None
    reason = review.get("policy_reason")
    return requirement, reason if isinstance(reason, str) else ""


def _has_recognized_policy(policy: tuple[str, str] | None) -> bool:
    return policy is not None and policy[0] in RECOGNIZED_REQUIREMENTS


def _opens_upload_window(result: dict) -> bool:
    if _plan_status(result) == "pending_upload":
        return True
    upload = result.get("upload")
    next_action = result.get("next_action")
    if not isinstance(upload, dict) or not isinstance(next_action, dict):
        return False
    command = next_action.get("command")
    return isinstance(command, str) and bool(command.strip())


def _upload_expiry(result: dict) -> str | None:
    try:
        expires_at = result["upload"]["expires_at"]
        parsed = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except (KeyError, TypeError, ValueError, AttributeError):
        return None
    return expires_at if parsed.tzinfo is not None else None


def _default_upload_expiry() -> str:
    deadline = datetime.now(timezone.utc) + DEFAULT_UPLOAD_WINDOW
    return deadline.strftime("%Y-%m-%dT%H:%M:%SZ")


def _apply_upload_fields(state: dict, result: dict, prior: dict | None) -> None:
    try:
        command = result["next_action"]["command"]
    except (KeyError, TypeError):
        command = None
    if isinstance(command, str) and command.strip():
        state["pending_upload_command"] = command
    elif prior and prior.get("pending_upload_command"):
        state["pending_upload_command"] = prior["pending_upload_command"]
    else:
        state.pop("pending_upload_command", None)

    expires_at = _upload_expiry(result)
    if expires_at:
        state["pending_upload_expires_at"] = expires_at
    elif prior and prior.get("pending_upload_expires_at"):
        state["pending_upload_expires_at"] = prior["pending_upload_expires_at"]
    else:
        state["pending_upload_expires_at"] = _default_upload_expiry()


def _clear_upload_fields(state: dict) -> None:
    state.pop("pending_upload_command", None)
    state.pop("pending_upload_expires_at", None)


def _nonempty_principal_id(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped if stripped else None


def _has_clearing_approval(result: dict) -> bool:
    author_id = _nonempty_principal_id(result.get("author_principal_id"))
    if author_id is None:
        return False
    reviews = result.get("reviews")
    if not isinstance(reviews, list):
        return False
    for review in reviews:
        if not isinstance(review, dict):
            continue
        status = review.get("status")
        decided_at = review.get("decided_at")
        review_type = review.get("type")
        reviewer_kind = review.get("reviewer_principal_kind")
        reviewer_id = _nonempty_principal_id(review.get("reviewer_principal_id"))
        if status != "approved":
            continue
        if not isinstance(decided_at, str) or not decided_at.strip():
            continue
        if review_type != "human":
            continue
        if reviewer_kind != "human":
            continue
        if reviewer_id is None or reviewer_id == author_id:
            continue
        return True
    return False


def _is_revision_stage(result: dict) -> bool:
    stage = _lifecycle_stage(result)
    if stage == "changes_requested":
        return True
    return (
        stage == "needs_attention"
        and _lifecycle_reason(result) == CHANGES_REQUESTED_AFTER_APPROVAL
    )


def _requested_plan_id(tool_input: dict | None) -> str | None:
    if not isinstance(tool_input, dict):
        return None
    requested_id = tool_input.get("id")
    return requested_id if isinstance(requested_id, str) else None


def _untracked_changes_requested_seed(
    prior: dict | None, tool_input: dict | None, result: dict
) -> dict | None:
    if prior is not None:
        return None
    requested_id = _requested_plan_id(tool_input)
    result_id = result.get("id")
    if (
        isinstance(requested_id, str)
        and requested_id == result_id
        and PLAN_ID_RE.fullmatch(requested_id)
        and _lifecycle_stage(result) == "changes_requested"
    ):
        return {"plan_id": requested_id}
    return None


def session_state_from_get_plan(
    prior: dict | None,
    tool_input: dict | None,
    result: dict,
) -> dict | None:
    if not isinstance(result, dict):
        return None

    result_id = result.get("id")
    if not isinstance(result_id, str):
        return None

    if prior is None:
        # Revision seed still applies when reviews[] still holds a leftover
        # approval: revision stages beat clearing approval. Other untracked
        # lookups (including untracked clearance) write nothing.
        prior = _untracked_changes_requested_seed(prior, tool_input, result)
        if prior is None:
            return None

    tracked_id = prior.get("plan_id")
    if not isinstance(tracked_id, str) or result_id != tracked_id:
        return None

    state: dict = {"plan_id": tracked_id}

    # Full replacement from this response only — never retain prior policy.
    # Always include both policy fields; absent review → empty strings.
    policy = _review_policy(result)
    if policy:
        state["review_requirement"], state["review_policy_reason"] = policy
    else:
        state["review_requirement"] = ""
        state["review_policy_reason"] = ""

    if _opens_upload_window(result):
        state["stage"] = "pending_upload"
        _apply_upload_fields(state, result, prior)
        return state

    if policy and policy[0] == "not_required":
        state["stage"] = "review_not_required"
        _clear_upload_fields(state)
        return state

    if _is_revision_stage(result):
        state["stage"] = "changes_requested"
        _clear_upload_fields(state)
        return state

    # Review-based clearance fails closed: recognized policy plus non-empty
    # other-human principal IDs. implementing/done still clear without a
    # matching review (and without re-checking policy here).
    if _has_recognized_policy(policy) and _has_clearing_approval(result):
        state["stage"] = "approved"
        _clear_upload_fields(state)
        return state

    lifecycle = _lifecycle_stage(result)
    if lifecycle in ("implementing", "done"):
        state["stage"] = "approved"
        _clear_upload_fields(state)
        return state

    state["stage"] = "submitted"
    _clear_upload_fields(state)
    return state
