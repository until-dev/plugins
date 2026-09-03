import {
  DEFAULT_CLOSED_USER_MESSAGE,
  SHELL_STOP_SUFFIX,
  STATE_DIR_USER_MESSAGE,
  defaultClosedAgentMessage,
  inFlightMessages,
  stateDirFileWriteAgentMessage,
  stateDirShellAgentMessage,
  type InFlightVariant,
  type MessageParams,
} from './messages.ts';
import { dirname } from 'node:path';
import {
  containedPath,
  isShapeDoc,
  pendingUploadCommandMatches,
  targetsStateDir,
} from './path-math.ts';
import { isMutatingShell } from './shell.ts';
import {
  applyReviewPolicyToState,
  findPlanId,
  findReviewPolicy,
  opensUploadWindowFromResult,
  planStatusFromResult,
  replaceUploadAuthorization,
  sessionStateFromGetPlan,
} from './session-stage.ts';

export type UntilMcpTool =
  | 'submit_plan'
  | 'update_plan'
  | 'delete_plan'
  | 'request_review'
  | 'get_plan';

export type SessionState = {
  plan_id?: string;
  stage?: string;
  review_requirement?: string;
  review_policy_reason?: string;
  pending_upload_command?: string;
  pending_upload_expires_at?: string;
};

export type ToolKind = 'shell' | 'file-write' | 'spawn' | 'other';

export type ClassifiedTool = {
  kind: ToolKind;
  command?: string;
  targetPath?: string;
  cwd?: string;
};

export type GateFacts = {
  state: SessionState | null;
  skipped: boolean;
  untilMethodRoot: string | null;
  untilRoot: string;
  stateDir: string;
  skipPath: string;
  now: Date;
};

export type GateDecision =
  | { allow: true }
  | { allow: false; agentMessage: string; userMessage: string };

export type ReduceResult =
  | { action: 'write'; state: SessionState }
  | { action: 'delete' }
  | { action: 'noop' };

const PLAN_ID_RE = /^UNTIL-[0-9]+$/;

function untilHome(facts: GateFacts): string {
  return dirname(facts.untilRoot);
}

export function pendingUploadHasExpired(
  state: SessionState | null,
  now: Date,
): boolean {
  try {
    const expiresAt = state?.pending_upload_expires_at;
    if (typeof expiresAt !== 'string') return true;
    const deadline = new Date(expiresAt.replace('Z', '+00:00'));
    if (Number.isNaN(deadline.getTime())) return true;
    return now >= deadline;
  } catch {
    return true;
  }
}

function messageParams(facts: GateFacts): MessageParams {
  const tracked = facts.state?.plan_id;
  const planId =
    typeof tracked === 'string' && PLAN_ID_RE.test(tracked)
      ? tracked
      : 'unavailable';
  return { planId, skipPath: facts.skipPath };
}

function resolveInFlightVariant(facts: GateFacts): InFlightVariant {
  const state = facts.state ?? {};
  const hasValidPlan =
    typeof state.plan_id === 'string' && PLAN_ID_RE.test(state.plan_id);
  const reviewRequirement = state.review_requirement;
  const pendingUpload = hasValidPlan && state.stage === 'pending_upload';
  const pendingUploadExpired =
    pendingUpload && pendingUploadHasExpired(state, facts.now);
  const setupRequired = Boolean(state) && state.stage === 'setup_required';
  const changesRequested = hasValidPlan && state.stage === 'changes_requested';
  const buildAllowed =
    hasValidPlan &&
    (state.stage === 'approved' || state.stage === 'review_not_required');
  const inFlight = setupRequired || (hasValidPlan && !buildAllowed);

  if (setupRequired) return 'setup_required';
  if (pendingUploadExpired) return 'pending_upload_expired';
  if (inFlight && reviewRequirement === 'not_required') {
    return 'review_not_required_pending';
  }
  if (
    inFlight &&
    reviewRequirement !== 'required' &&
    reviewRequirement !== 'not_required'
  ) {
    return 'review_requirement_unrecognized';
  }
  if (changesRequested) return 'changes_requested';
  return 'peer_review';
}

function inFlightDeny(
  facts: GateFacts,
  appendShellSuffix: boolean,
): GateDecision {
  const params = messageParams(facts);
  const { agentMessage, userMessage } = inFlightMessages(
    resolveInFlightVariant(facts),
    params,
  );
  return {
    allow: false,
    agentMessage: appendShellSuffix
      ? agentMessage + SHELL_STOP_SUFFIX
      : agentMessage,
    userMessage,
  };
}

function defaultClosedDeny(
  facts: GateFacts,
  appendShellSuffix: boolean,
): GateDecision {
  const params = messageParams(facts);
  return {
    allow: false,
    agentMessage: appendShellSuffix
      ? defaultClosedAgentMessage(params) + SHELL_STOP_SUFFIX
      : defaultClosedAgentMessage(params),
    userMessage: DEFAULT_CLOSED_USER_MESSAGE,
  };
}

function stateDirDeny(
  facts: GateFacts,
  viaFileWrite: boolean,
): GateDecision {
  const params = messageParams(facts);
  return {
    allow: false,
    agentMessage: viaFileWrite
      ? stateDirFileWriteAgentMessage(params)
      : stateDirShellAgentMessage(params),
    userMessage: STATE_DIR_USER_MESSAGE,
  };
}

function gateContext(facts: GateFacts) {
  const state = facts.state;
  const trackedPlanId = state?.plan_id;
  const hasValidPlan =
    typeof trackedPlanId === 'string' && PLAN_ID_RE.test(trackedPlanId);
  const approved = hasValidPlan && state?.stage === 'approved';
  const reviewNotRequired =
    hasValidPlan && state?.stage === 'review_not_required';
  const pendingUpload = hasValidPlan && state?.stage === 'pending_upload';
  const pendingUploadExpired =
    pendingUpload && pendingUploadHasExpired(state, facts.now);
  const setupRequired = Boolean(state) && state?.stage === 'setup_required';
  const buildAllowed = approved || reviewNotRequired;
  const inFlight = setupRequired || (hasValidPlan && !buildAllowed);
  return {
    hasValidPlan,
    buildAllowed,
    inFlight,
    pendingUpload,
    pendingUploadExpired,
  };
}

export function decideGate(
  facts: GateFacts,
  tool: ClassifiedTool,
): GateDecision {
  const ctx = gateContext(facts);

  if (tool.kind === 'shell') {
    const cmd = tool.command ?? '';
    const home = untilHome(facts);
    if (targetsStateDir(cmd, tool.cwd, facts.untilRoot, facts.stateDir, home)) {
      return stateDirDeny(facts, false);
    }
    if (
      ctx.pendingUpload &&
      !ctx.pendingUploadExpired &&
      pendingUploadCommandMatches(facts.state, cmd)
    ) {
      return { allow: true };
    }
    if (ctx.buildAllowed || facts.skipped) return { allow: true };
    const markedRepo = facts.untilMethodRoot;
    if (ctx.inFlight && isMutatingShell(cmd)) {
      return inFlightDeny(facts, true);
    }
    if (markedRepo && isMutatingShell(cmd)) {
      return defaultClosedDeny(facts, true);
    }
    return { allow: true };
  }

  if (tool.kind === 'spawn') {
    if (ctx.buildAllowed || facts.skipped) return { allow: true };
    const markedRepo = facts.untilMethodRoot;
    if (ctx.inFlight) return inFlightDeny(facts, false);
    if (markedRepo) return defaultClosedDeny(facts, false);
    return { allow: true };
  }

  if (tool.kind === 'file-write') {
    const target = tool.targetPath ?? '';
    const cwd = tool.cwd;
    const home = untilHome(facts);
    if (target) {
      const untilTarget = containedPath(
        target,
        facts.untilRoot,
        cwd,
        home,
      );
      if (
        untilTarget === facts.untilRoot ||
        containedPath(target, facts.stateDir, cwd, home)
      ) {
        return stateDirDeny(facts, true);
      }
      if (untilTarget) return { allow: true };
      if (!ctx.inFlight && isShapeDoc(target, cwd, home, facts.untilMethodRoot)) {
        return { allow: true };
      }
    }
    if (ctx.buildAllowed || facts.skipped) return { allow: true };
    if (ctx.inFlight) {
      return inFlightDeny(facts, false);
    }
    const markedRepo = facts.untilMethodRoot;
    if (markedRepo) {
      return defaultClosedDeny(facts, false);
    }
    return { allow: true };
  }

  return { allow: true };
}

export function reduceSession(
  prior: SessionState | null,
  tool: UntilMcpTool,
  toolInput: Record<string, unknown> | null,
  result: Record<string, unknown>,
  now: Date,
): ReduceResult {
  switch (tool) {
    case 'submit_plan': {
      const pid = findPlanId(result);
      if (
        planStatusFromResult(result) === 'source_control_setup_required' &&
        !prior?.plan_id
      ) {
        return { action: 'write', state: { stage: 'setup_required' } };
      }
      if (pid) {
        const stage = opensUploadWindowFromResult(result)
          ? 'pending_upload'
          : 'submitted';
        const state: SessionState = { plan_id: pid, stage };
        if (stage === 'pending_upload') {
          replaceUploadAuthorization(state, result, false, now);
        }
        applyReviewPolicyToState(state, result);
        return { action: 'write', state };
      }
      return { action: 'noop' };
    }
    case 'update_plan': {
      const stage = opensUploadWindowFromResult(result)
        ? 'pending_upload'
        : 'submitted';
      let state: SessionState;
      if (prior === null) {
        const pid = findPlanId(result);
        if (!pid) return { action: 'noop' };
        state = { plan_id: pid };
      } else {
        state = { ...prior };
      }
      state.stage = stage;
      if (stage === 'pending_upload') {
        replaceUploadAuthorization(state, result, false, now);
      } else {
        delete state.pending_upload_command;
        delete state.pending_upload_expires_at;
      }
      return { action: 'write', state };
    }
    case 'delete_plan': {
      const trackedId = prior?.plan_id;
      if (
        toolInput &&
        typeof trackedId === 'string' &&
        toolInput.id === trackedId &&
        result.id === trackedId &&
        result.deleted === true
      ) {
        return { action: 'delete' };
      }
      return { action: 'noop' };
    }
    case 'request_review': {
      const trackedId = prior?.plan_id;
      if (
        prior !== null &&
        toolInput &&
        typeof trackedId === 'string' &&
        toolInput.plan_id === trackedId &&
        result.status === 'requested'
      ) {
        const state: SessionState = { ...prior, stage: 'submitted' };
        delete state.pending_upload_command;
        delete state.pending_upload_expires_at;
        return { action: 'write', state };
      }
      return { action: 'noop' };
    }
    case 'get_plan': {
      const newState = sessionStateFromGetPlan(prior, toolInput, result, now);
      if (newState !== null) {
        return { action: 'write', state: newState };
      }
      return { action: 'noop' };
    }
    default:
      return { action: 'noop' };
  }
}

export function mapUntilMcpTool(toolName: string): UntilMcpTool | null {
  const lower = toolName.toLowerCase();
  if (lower.includes('submit_plan')) return 'submit_plan';
  if (lower.includes('update_plan')) return 'update_plan';
  if (lower.includes('delete_plan')) return 'delete_plan';
  if (lower.includes('request_review')) return 'request_review';
  if (lower.includes('get_plan')) return 'get_plan';
  return null;
}

export function parseMcpResult(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    Array.isArray((data as Record<string, unknown>).content)
  ) {
    for (const item of (data as Record<string, unknown>).content as unknown[]) {
      if (
        item &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).type === 'text' &&
        typeof (item as Record<string, unknown>).text === 'string'
      ) {
        try {
          return JSON.parse((item as Record<string, unknown>).text as string);
        } catch {
          continue;
        }
      }
    }
  }
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

export { findReviewPolicy };
