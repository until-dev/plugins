/** Port of plugins/hooks/session_stage.py — get_plan → local session stage. */

import type { SessionState } from './policy.ts';

const PLAN_ID_RE = /^UNTIL-[0-9]+$/;
const CHANGES_REQUESTED_AFTER_APPROVAL = 'changes_requested_after_approval';
const RECOGNIZED_REQUIREMENTS = new Set(['required', 'not_required']);
const DEFAULT_UPLOAD_WINDOW_MS = 15 * 60 * 1000;

function planStatus(result: Record<string, unknown>): string {
  const status = result.status ?? result.lifecycle_stage ?? '';
  return typeof status === 'string' ? status.toLowerCase() : '';
}

function lifecycleStage(result: Record<string, unknown>): string {
  const lifecycle = result.lifecycle;
  if (!lifecycle || typeof lifecycle !== 'object') return '';
  const stage = (lifecycle as Record<string, unknown>).stage;
  return typeof stage === 'string' ? stage.toLowerCase() : '';
}

function lifecycleReason(result: Record<string, unknown>): string {
  const lifecycle = result.lifecycle;
  if (!lifecycle || typeof lifecycle !== 'object') return '';
  const reason = (lifecycle as Record<string, unknown>).reason;
  return typeof reason === 'string' ? reason : '';
}

function reviewPolicy(
  result: Record<string, unknown>,
): [string, string] | null {
  const review = result.review;
  if (!review || typeof review !== 'object') return null;
  const requirement = (review as Record<string, unknown>).requirement;
  if (typeof requirement !== 'string') return null;
  const reason = (review as Record<string, unknown>).policy_reason;
  return [requirement, typeof reason === 'string' ? reason : ''];
}

function hasRecognizedPolicy(policy: [string, string] | null): boolean {
  return policy !== null && RECOGNIZED_REQUIREMENTS.has(policy[0]);
}

function opensUploadWindow(result: Record<string, unknown>): boolean {
  if (planStatus(result) === 'pending_upload') return true;
  const upload = result.upload;
  const nextAction = result.next_action;
  if (!upload || typeof upload !== 'object') return false;
  if (!nextAction || typeof nextAction !== 'object') return false;
  const command = (nextAction as Record<string, unknown>).command;
  return typeof command === 'string' && command.trim().length > 0;
}

function uploadExpiry(result: Record<string, unknown>): string | null {
  try {
    const upload = result.upload as Record<string, unknown>;
    const expiresAt = upload.expires_at;
    if (typeof expiresAt !== 'string') return null;
    const parsed = new Date(expiresAt.replace('Z', '+00:00'));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getTimezoneOffset() !== undefined ? expiresAt : null;
  } catch {
    return null;
  }
}

function defaultUploadExpiry(now: Date): string {
  return new Date(now.getTime() + DEFAULT_UPLOAD_WINDOW_MS)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
}

function applyUploadFields(
  state: SessionState,
  result: Record<string, unknown>,
  prior: SessionState | null,
  now: Date,
): void {
  let command: unknown;
  try {
    command = (result.next_action as Record<string, unknown>).command;
  } catch {
    command = null;
  }
  if (typeof command === 'string' && command.trim()) {
    state.pending_upload_command = command;
  } else if (prior?.pending_upload_command) {
    state.pending_upload_command = prior.pending_upload_command;
  } else {
    delete state.pending_upload_command;
  }

  const expiresAt = uploadExpiry(result);
  if (expiresAt) {
    state.pending_upload_expires_at = expiresAt;
  } else if (prior?.pending_upload_expires_at) {
    state.pending_upload_expires_at = prior.pending_upload_expires_at;
  } else {
    state.pending_upload_expires_at = defaultUploadExpiry(now);
  }
}

function clearUploadFields(state: SessionState): void {
  delete state.pending_upload_command;
  delete state.pending_upload_expires_at;
}

function nonemptyPrincipalId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const stripped = value.trim();
  return stripped ? stripped : null;
}

function hasClearingApproval(result: Record<string, unknown>): boolean {
  const authorId = nonemptyPrincipalId(result.author_principal_id);
  if (authorId === null) return false;
  const reviews = result.reviews;
  if (!Array.isArray(reviews)) return false;
  for (const review of reviews) {
    if (!review || typeof review !== 'object') continue;
    const r = review as Record<string, unknown>;
    if (r.status !== 'approved') continue;
    const decidedAt = r.decided_at;
    if (typeof decidedAt !== 'string' || !decidedAt.trim()) continue;
    if (r.type !== 'human') continue;
    if (r.reviewer_principal_kind !== 'human') continue;
    const reviewerId = nonemptyPrincipalId(r.reviewer_principal_id);
    if (reviewerId === null || reviewerId === authorId) continue;
    return true;
  }
  return false;
}

function isRevisionStage(result: Record<string, unknown>): boolean {
  const stage = lifecycleStage(result);
  if (stage === 'changes_requested') return true;
  return (
    stage === 'needs_attention' &&
    lifecycleReason(result) === CHANGES_REQUESTED_AFTER_APPROVAL
  );
}

function requestedPlanId(toolInput: Record<string, unknown> | null): string | null {
  if (!toolInput) return null;
  const requestedId = toolInput.id;
  return typeof requestedId === 'string' ? requestedId : null;
}

function untrackedChangesRequestedSeed(
  prior: SessionState | null,
  toolInput: Record<string, unknown> | null,
  result: Record<string, unknown>,
): SessionState | null {
  if (prior !== null) return null;
  const requestedId = requestedPlanId(toolInput);
  const resultId = result.id;
  if (
    typeof requestedId === 'string' &&
    requestedId === resultId &&
    PLAN_ID_RE.test(requestedId) &&
    lifecycleStage(result) === 'changes_requested'
  ) {
    return { plan_id: requestedId };
  }
  return null;
}

export function sessionStateFromGetPlan(
  prior: SessionState | null,
  toolInput: Record<string, unknown> | null,
  result: Record<string, unknown>,
  now: Date,
): SessionState | null {
  const resultId = result.id;
  if (typeof resultId !== 'string') return null;

  let effectivePrior = prior;
  if (effectivePrior === null) {
    effectivePrior = untrackedChangesRequestedSeed(prior, toolInput, result);
    if (effectivePrior === null) return null;
  }

  const trackedId = effectivePrior.plan_id;
  if (typeof trackedId !== 'string' || resultId !== trackedId) return null;

  const state: SessionState = { plan_id: trackedId };
  const policy = reviewPolicy(result);
  if (policy) {
    state.review_requirement = policy[0];
    state.review_policy_reason = policy[1];
  } else {
    state.review_requirement = '';
    state.review_policy_reason = '';
  }

  if (opensUploadWindow(result)) {
    state.stage = 'pending_upload';
    applyUploadFields(state, result, effectivePrior, now);
    return state;
  }

  if (policy && policy[0] === 'not_required') {
    state.stage = 'review_not_required';
    clearUploadFields(state);
    return state;
  }

  if (isRevisionStage(result)) {
    state.stage = 'changes_requested';
    clearUploadFields(state);
    return state;
  }

  if (hasRecognizedPolicy(policy) && hasClearingApproval(result)) {
    state.stage = 'approved';
    clearUploadFields(state);
    return state;
  }

  const lifecycle = lifecycleStage(result);
  if (lifecycle === 'implementing' || lifecycle === 'done') {
    state.stage = 'approved';
    clearUploadFields(state);
    return state;
  }

  state.stage = 'submitted';
  clearUploadFields(state);
  return state;
}

export const PLAN_ID_PATTERN = PLAN_ID_RE;
export const PLAN_ID_SEARCH = /(?<![A-Za-z0-9_-])UNTIL-[0-9]+(?![A-Za-z0-9_-])/g;

export function findPlanId(obj: unknown): string | null {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const record = obj as Record<string, unknown>;
    const pid = record.id;
    if (typeof pid === 'string' && PLAN_ID_RE.test(pid)) return pid;
    for (const value of Object.values(record)) {
      const found = findPlanId(value);
      if (found) return found;
    }
  } else if (Array.isArray(obj)) {
    for (const value of obj) {
      const found = findPlanId(value);
      if (found) return found;
    }
  } else if (typeof obj === 'string') {
    const match = obj.match(PLAN_ID_SEARCH);
    if (match) return match[0] ?? null;
  }
  return null;
}

export function findReviewPolicy(
  obj: unknown,
): [string, string] | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  return reviewPolicy(obj as Record<string, unknown>);
}

export function opensUploadWindowFromResult(
  result: Record<string, unknown>,
): boolean {
  return opensUploadWindow(result);
}

export function replaceUploadAuthorization(
  state: SessionState,
  result: Record<string, unknown>,
  retainExisting: boolean,
  now: Date,
): void {
  applyUploadFields(state, result, retainExisting ? state : null, now);
  if (!retainExisting && !state.pending_upload_command) {
    delete state.pending_upload_command;
  }
}

export function applyReviewPolicyToState(
  state: SessionState,
  result: Record<string, unknown>,
): [string, string] | null {
  const policy = reviewPolicy(result);
  if (policy) {
    state.review_requirement = policy[0];
    state.review_policy_reason = policy[1];
  }
  return policy;
}

export function planStatusFromResult(result: Record<string, unknown>): string {
  return planStatus(result);
}
