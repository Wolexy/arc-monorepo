import { ApiError } from "./assessment";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4200";

export interface ActiveAssessmentSession {
  id: string;
  userId: number | null;
  startedAt: string;
  stage1CompletedAt: string | null;
  stage1ResultsViewedAt: string | null;
  stage2UnlockedAt: string | null;
  completedAt: string | null;
}

export interface AssessmentProgress {
  sessionId: string;
  stage1Completed: boolean;
  stage1ResultsViewed: boolean;
  stage2Started: boolean;
  accessGranted: boolean;
  eligibleCenters: string[];
}

async function request<T>(
  endpoint: string,
  // NestJS sends an empty HTTP 200 body when a handler returns null.
  // Only endpoints documented to return null may opt in to this.
  emptyBodyAsNull = false,
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

    // Still an Error for existing callers; status lets pages detect 401.
    throw new ApiError(message, response.status);
  }
//Debuggging
  //return response.json() as Promise<T>;
const responseText = await response.text();

if (!responseText.trim()) {
  if (emptyBodyAsNull && response.status === 200) {
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
 * Retrieves the current user's active assessment session.
 * Returns null when no active session exists.
 */
export function getActiveAssessmentSession(): Promise<ActiveAssessmentSession | null> {
  return request<ActiveAssessmentSession | null>("/sessions/active", true);
}

/**
 * Retrieves progress for a specific assessment session.
 */
export function getAssessmentProgress(
  sessionId: string,
): Promise<AssessmentProgress> {
  return request<AssessmentProgress>(
    `/sessions/progress/${encodeURIComponent(sessionId)}`,
  );
}
