/** Customer-facing gate copy — must match plugins/hooks/until-commit-gate verbatim. */

export const SHELL_STOP_SUFFIX =
  ' The denied operation is a stop condition. Never try an alternate write path, shell redirection, or another tool.';

export type MessageParams = {
  planId: string;
  skipPath: string;
};

export function stateDirShellAgentMessage({ skipPath }: MessageParams): string {
  return (
    'UNTIL GATE: agents may not touch Until session state (that includes creating skip tokens). Only your partner can do that, from their own terminal after saying “Don’t use the Until Loop for this.”: touch \'' +
    skipPath +
    "'. Never present this as solo approval or an ordinary review path. Relay it only after that exact instruction; no hooks/gates/state talk."
  );
}

export const STATE_DIR_USER_MESSAGE =
  "Until can't waive its own process. If you said “Don’t use the Until Loop for this.”, the bypass has to come from you.";

export function stateDirFileWriteAgentMessage({ skipPath }: MessageParams): string {
  return (
    'UNTIL GATE: agents may not touch Until session state (that includes creating skip tokens via file tools). Only your partner can, from their own terminal after saying “Don’t use the Until Loop for this.”: touch \'' +
    skipPath +
    "'. Never present this as solo approval. Relay it only after that exact instruction."
  );
}

export function setupRequiredAgentMessage({ skipPath }: MessageParams): string {
  return (
    'UNTIL GATE: repository access setup is required and no plan was submitted. Stop before implementation. Present the setup link from the submit_plan response, wait for your partner to confirm setup, then retry submission. Plan acceptance or an implementation request does not waive this blocker. If the partner explicitly says “Don’t use the Until Loop for this.”, tell them once what they waive and give them this human-run command: touch \'' +
    skipPath +
    "'. Then stop until your partner confirms they ran that command. A missing skip file still denies implementation. Do not call submit_plan again for this change. Otherwise never surface the command. Relay blocks in Until Loop terms only."
  );
}

export const SETUP_REQUIRED_USER_MESSAGE =
  'Until still needs repository access before this plan can be submitted. Complete setup, then send continue — or say “Don’t use the Until Loop for this.”';

export function pendingUploadExpiredAgentMessage({ planId }: MessageParams): string {
  return (
    'UNTIL GATE: plan ' +
    planId +
    "'s upload authorization expired before the upload was confirmed. Stop before implementation. Retry submit_plan or update_plan to obtain a fresh upload action, execute it, then confirm the saved plan with get_plan. The expired pending-upload stage permits only read-only inspection."
  );
}

export function pendingUploadExpiredUserMessage({ planId }: MessageParams): string {
  return (
    'Until: plan ' +
    planId +
    "'s upload authorization expired — retry the submission to continue."
  );
}

export function reviewNotRequiredPendingAgentMessage({ planId }: MessageParams): string {
  return (
    'UNTIL GATE: plan ' +
    planId +
    " does not require peer review, but its upload has not been confirmed through get_plan yet. Run the exact upload command returned by submit_plan, then call get_plan. Do not request review or run a fresh-context subagent. Relay only: 'the plan is still saving; I need to confirm it landed before building.'"
  );
}

export function reviewNotRequiredPendingUserMessage({ planId }: MessageParams): string {
  return (
    'Until: plan ' +
    planId +
    ' is still saving — building starts after I confirm it landed.'
  );
}

export function unrecognizedReviewAgentMessage({ planId }: MessageParams): string {
  return (
    'UNTIL GATE: plan ' +
    planId +
    ' has no recognized saved review requirement. Implementation remains blocked. Confirm the current plan with get_plan; do not infer policy from reasons, membership, reviewer availability, or lifecycle fields, and do not request review.'
  );
}

export function unrecognizedReviewUserMessage({ planId }: MessageParams): string {
  return (
    'Until has not confirmed a recognized review requirement for plan ' +
    planId +
    ' — building stays paused.'
  );
}

export function changesRequestedAgentMessage({ planId }: MessageParams): string {
  return (
    'UNTIL GATE: review returned changes for plan ' +
    planId +
    '. Implementation remains blocked, but revision is the required next action and does not bypass review. Continue the planning conversation, inspect the repository read-only, and edit the canonical draft under ~/.until/plans/ or disposable planning artifacts under ~/.until/scratch/. Then call update_plan for this same plan, execute its issued upload action, confirm the saved revision with get_plan, and request a fresh human review. Do not edit a product checkout, commit, push, or open a pull request before approval.'
  );
}

export function changesRequestedUserMessage({ planId }: MessageParams): string {
  return (
    'Until: review returned changes for plan ' +
    planId +
    ' — revise the same plan and send it back for fresh review; building stays paused.'
  );
}

export function inFlightPeerReviewAgentMessage({ planId, skipPath }: MessageParams): string {
  return (
    'UNTIL GATE: plan ' +
    planId +
    " requires peer review and has NO approved verdict. Blocked until another human records approval. Legitimate moves: (1) load getting-a-review and route it to a teammate or connected review service; (2) revise with update_plan if changes were requested; (3) wait. A partner's go-ahead in chat or a Build click is not a verdict. If the partner explicitly says “Don’t use the Until Loop for this.”, tell them once what they waive and give them this human-run command: touch '" +
    skipPath +
    "'. Otherwise never surface it. Relay blocks in Until Loop terms only."
  );
}

export function inFlightPeerReviewUserMessage({ planId }: MessageParams): string {
  return (
    'Until: plan ' +
    planId +
    ' is awaiting peer review — building stays paused until another human approves it.'
  );
}

export function defaultClosedAgentMessage({ skipPath }: MessageParams): string {
  return (
    'UNTIL GATE: this repository is marked `.until-method` — every change here requires a submitted plan cleared by Until\'s review policy, and this conversation has none. No edits, no commits until then. The path forward is the method itself: load `brainstorming` to agree the shape with your partner, `writing-a-good-plan` to draft it, and submit_plan. A review-not-required plan proceeds after its upload is confirmed; a review-required plan proceeds after another human approves it. A direct instruction to make the change is the START of that conversation, not permission to bypass it. If your partner says “Don’t use the Until Loop for this.”, THEY must run this in their own terminal: touch \'' +
    skipPath +
    "' — When you relay this block, use Until Loop terms only ('this repo needs a submitted plan first') — no hooks/gates/state talk."
  );
}

export const DEFAULT_CLOSED_USER_MESSAGE =
  "Until: this repository asks for a submitted plan before any change, and this session doesn't have one yet — so we'll plan first.";

export type InFlightVariant =
  | 'setup_required'
  | 'pending_upload_expired'
  | 'review_not_required_pending'
  | 'review_requirement_unrecognized'
  | 'changes_requested'
  | 'peer_review';

export function inFlightMessages(
  variant: InFlightVariant,
  params: MessageParams,
): { agentMessage: string; userMessage: string } {
  switch (variant) {
    case 'setup_required':
      return {
        agentMessage: setupRequiredAgentMessage(params),
        userMessage: SETUP_REQUIRED_USER_MESSAGE,
      };
    case 'pending_upload_expired':
      return {
        agentMessage: pendingUploadExpiredAgentMessage(params),
        userMessage: pendingUploadExpiredUserMessage(params),
      };
    case 'review_not_required_pending':
      return {
        agentMessage: reviewNotRequiredPendingAgentMessage(params),
        userMessage: reviewNotRequiredPendingUserMessage(params),
      };
    case 'review_requirement_unrecognized':
      return {
        agentMessage: unrecognizedReviewAgentMessage(params),
        userMessage: unrecognizedReviewUserMessage(params),
      };
    case 'changes_requested':
      return {
        agentMessage: changesRequestedAgentMessage(params),
        userMessage: changesRequestedUserMessage(params),
      };
    default:
      return {
        agentMessage: inFlightPeerReviewAgentMessage(params),
        userMessage: inFlightPeerReviewUserMessage(params),
      };
  }
}
