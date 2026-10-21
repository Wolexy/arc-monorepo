const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4200";

export interface EnergyStatement {
  id: number;
  groupId: number;
  personalityType: "GUT" | "HEART" | "HEAD";
  text: string;
}

export interface EnergyGroup {
  groupId: number;
  groupNo: number;
  totalGroups: number;
  statements: EnergyStatement[];
}

export interface Ranking {
  statementId: number;
  rankId: number;
}

export interface EnergyGroupSubmission {
  sessionId: string;
  energyStatementGroupId: number;
  rankings: Ranking[];
}

export interface EnergyAssessmentResult {
  gut: number;
  heart: number;
  head: number;
  dominant: string | null;
  eligibleCenters: string[];
}

export interface ActiveAssessmentSession {
  id: string;
  [key: string]: unknown;
}

export interface NextEnergyGroupCompleted {
  completed: true;
  stage: string;
  message: string;
}

export type NextEnergyGroupResponse = EnergyGroup | NextEnergyGroupCompleted;

/**
 * Error thrown for non-2xx responses. It is still an Error, so existing
 * callers that read error.message keep working; status lets pages tell
 * 401, 403 and 409 apart.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  // NestJS sends an empty HTTP 200 body when a handler returns null.
  // Only endpoints documented to return null may opt in to this.
  emptyBodyAsNull = false,
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;

    try {
      const body = await response.json();

      if (typeof body.message === "string") {
        message = body.message;
      } else if (Array.isArray(body.message)) {
        message = body.message.join(", ");
      }
    } catch {
      // Keep the default message if the response is not JSON.
    }

    throw new ApiError(message, response.status);
  }

  if (!emptyBodyAsNull) {
    return response.json() as Promise<T>;
  }

  const responseText = await response.text();

  if (!responseText.trim()) {
    if (response.status === 200) {
      return null as T;
    }

    throw new Error(
      `Empty response body from ${endpoint} (HTTP ${response.status}).`,
    );
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(
      `Invalid JSON response from ${endpoint} (HTTP ${response.status}).`,
    );
  }
}

/**
 * Starts a new assessment or resumes an existing incomplete session.
 */
export function startAssessment(): Promise<ActiveAssessmentSession> {
  return request<ActiveAssessmentSession>("/sessions/start", {
    method: "POST",
  });
}

/**
 * Loads the next unanswered Energy statement group.
 */
export function getNextEnergyGroup(
  sessionId: string,
): Promise<NextEnergyGroupResponse> {
  return request<NextEnergyGroupResponse>(
    `/energy/next/${encodeURIComponent(sessionId)}`,
  );
}

/**
 * Submits rankings for one Energy statement group.
 */
export function submitEnergyGroup(
  submission: EnergyGroupSubmission,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/energy/submit", {
    method: "POST",
    body: JSON.stringify(submission),
  });
}

/**
 * Calculates the Energy Center results after all groups are answered.
 */
export function finishEnergyAssessment(
  sessionId: string,
): Promise<EnergyAssessmentResult> {
  return request<EnergyAssessmentResult>(
    `/energy/finish/${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
    },
  );
}
// call backend GET /energy/result/:sessionId
export function getSavedEnergyResult(
  sessionId: string,
): Promise<EnergyAssessmentResult | null> {
  return request<EnergyAssessmentResult | null>(
    `/energy/result/${encodeURIComponent(sessionId)}`,
    {},
    true,
  );
}

/**
 * Records the first time the user viewed their saved Stage 1 results.
 * The backend sets the timestamp once and never overwrites it.
 */
export function markStage1ResultsViewed(
  sessionId: string,
): Promise<{ sessionId: string; stage1ResultsViewedAt: string }> {
  return request<{ sessionId: string; stage1ResultsViewedAt: string }>(
    `/sessions/stage1-results-viewed/${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
    },
  );
}

export interface Stage2Access {
  allowed: boolean;
  reason?: string;
}

/**
 * Asks the backend whether this session may start Stage 2.
 * Read-only: it does not create a personality session.
 */
export function getStage2Access(sessionId: string): Promise<Stage2Access> {
  return request<Stage2Access>(
    `/personality/access/${encodeURIComponent(sessionId)}`,
  );
}

/* ------------------------------------------------------------------
   Stage 2: Personality Assessment
------------------------------------------------------------------- */

export type EnergyCenterCode = "GUT" | "HEART" | "HEAD";

// The backend also returns personalityTypeId; it is the scoring key and is
// deliberately left out so the browser never reads it.
export interface PersonalityQuestion {
  id: number;
  energyCenter: EnergyCenterCode;
  text: string;
  questionOrder: number;
}

export interface PersonalityRankChoice {
  id: number;
  label: string;
  score: number;
}

export interface StartPersonalityResponse {
  started: true;
  centers: EnergyCenterCode[];
}

export type NextPersonalityCenterResponse =
  | { completed: false; next: EnergyCenterCode }
  | { completed: true };

export type NextPersonalityQuestionResponse =
  | { question: PersonalityQuestion; options: PersonalityRankChoice[] }
  | {
      completed: true;
      stage: "PERSONALITY";
      energyCenter: EnergyCenterCode;
      message: string;
    };

export type SubmitPersonalityAnswerResponse =
  | { answered: number }
  | { completed: true; message: string };

export interface FinalPersonalityScore {
  personalityTypeId: number;
  totalScore: number;
}

export interface PersonalityDominantType {
  personalityTypeId: number;
  code?: string;
  name?: string;
  title?: string;
  score: number;
  overview: string;
  strengths: string;
  weaknesses: string;
  growthPath: string;
}

export interface PersonalityRunnerUp {
  personalityTypeId: number;
  code?: string;
  name?: string;
  title?: string;
  score: number;
}

export interface PersonalityReport {
  sessionId: string;
  dominantTypes: PersonalityDominantType[];
  runnerUp: PersonalityRunnerUp | null;
  confidence: { score: number; level: string; reason?: string };
}

/**
 * Creates (or reuses) the personality sessions for every eligible center.
 * The backend returns 409 once Stage 2 has been completed.
 */
export function startPersonalityAssessment(
  sessionId: string,
): Promise<StartPersonalityResponse> {
  return request<StartPersonalityResponse>(
    `/personality/start/${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
    },
  );
}

/**
 * Asks the backend which eligible center comes next.
 */
export function getNextPersonalityCenter(
  sessionId: string,
): Promise<NextPersonalityCenterResponse> {
  return request<NextPersonalityCenterResponse>(
    `/personality/next-center/${encodeURIComponent(sessionId)}`,
  );
}

/**
 * Loads the next unanswered question for a center, in backend order.
 */
export function getNextPersonalityQuestion(
  sessionId: string,
  center: EnergyCenterCode,
): Promise<NextPersonalityQuestionResponse> {
  return request<NextPersonalityQuestionResponse>(
    `/personality/${encodeURIComponent(sessionId)}/${center}/next`,
  );
}

/**
 * Saves one answer. The final answer of a center also completes it.
 */
export function submitPersonalityAnswer(
  sessionId: string,
  center: EnergyCenterCode,
  questionId: number,
  rankChoiceId: number,
): Promise<SubmitPersonalityAnswerResponse> {
  return request<SubmitPersonalityAnswerResponse>(
    `/personality/${encodeURIComponent(sessionId)}/${center}/answer`,
    {
      method: "POST",
      body: JSON.stringify({ questionId, rankChoiceId }),
    },
  );
}

/**
 * Stores the final Stage 2 results once every eligible center is done.
 * Repeating it returns the stored results without recalculating them.
 */
export function finalizePersonalityAssessment(
  sessionId: string,
): Promise<FinalPersonalityScore[]> {
  return request<FinalPersonalityScore[]>(
    `/personality/${encodeURIComponent(sessionId)}/final`,
    {
      method: "POST",
    },
  );
}

/**
 * Loads the saved Stage 2 report.
 */
export function getPersonalityReport(
  sessionId: string,
): Promise<PersonalityReport> {
  return request<PersonalityReport>(
    `/personality/${encodeURIComponent(sessionId)}/report`,
  );
}