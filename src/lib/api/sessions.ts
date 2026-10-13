const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4200";

export interface ActiveAssessmentSession {
  id: string;
  userId: number | null;
  startedAt: string;
  stage1CompletedAt: string | null;
  stage2UnlockedAt: string | null;
  completedAt: string | null;
}

export interface AssessmentProgress {
  sessionId: string;
  stage1Completed: boolean;
  stage2Started: boolean;
  accessGranted: boolean;
  eligibleCenters: string[];
}

async function request<T>(endpoint: string): Promise<T> {
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

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

/**
 * Retrieves the current user's active assessment session.
 * Returns null when no active session exists.
 */
export function getActiveAssessmentSession(): Promise<ActiveAssessmentSession | null> {
  return request<ActiveAssessmentSession | null>("/sessions/active");
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
