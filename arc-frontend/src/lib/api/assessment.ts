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

    throw new Error(message);
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