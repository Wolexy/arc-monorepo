const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface AdminUser {
  id: number;
  email: string;
  role: string;
  emailVerified: boolean;
  accountEnabled: boolean;
  stage2AccessGranted: boolean;
  accessGranted: boolean;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    const message = Array.isArray(error.message)
      ? error.message.join(", ")
      : error.message;

    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.json();
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await fetch(`${API_URL}/admin/users`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  return handleResponse<AdminUser[]>(response);
}

export async function updateAccountStatus(
  userId: number,
  accountEnabled: boolean,
): Promise<{ success: boolean; accountEnabled: boolean }> {
  const response = await fetch(`${API_URL}/admin/users/${userId}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountEnabled }),
  });

  return handleResponse(response);
}

export async function grantStage2Access(userId: number): Promise<unknown> {
  const response = await fetch(`${API_URL}/admin/grant/${userId}`, {
    method: "POST",
    credentials: "include",
  });

  return handleResponse(response);
}

export async function revokeStage2Access(userId: number): Promise<unknown> {
  const response = await fetch(`${API_URL}/admin/revoke/${userId}`, {
    method: "POST",
    credentials: "include",
  });

  return handleResponse(response);
}
