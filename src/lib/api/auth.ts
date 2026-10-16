const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not configured");
}

export interface RegisterResponse {
  message: string;
}

export interface LoginResponse {
  user: {
    id: number;
    email: string;
    role: string;
    accessGranted: boolean; // Temporary backward compatibility
    stage2AccessGranted: boolean;
    accountEnabled: boolean;
    emailVerified: boolean;
  };
}

export interface CurrentUser {
  id: number;
  email: string;
  role: string;
  accessGranted: boolean; // Temporary backward compatibility
  stage2AccessGranted: boolean;
  accountEnabled: boolean;
  emailVerified: boolean;
}

export interface VerifyEmailResponse {
  message: string;
}

export async function register(
  email: string,
  password: string,
  confirmPassword: string,
): Promise<RegisterResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      confirmPassword,
    }),
  });

  if (!response.ok) {
    const error = await response.json();

    console.log("REGISTER ERROR:", error);

    throw new Error(
      Array.isArray(error.message)
        ? error.message.join(", ")
        : error.message || "Registration failed",
    );
  }
  return response.json();
}

export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const response = await fetch(
    `${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`,
  );

  if (!response.ok) {
    const error = await response.json();

    throw new Error(
      Array.isArray(error.message)
        ? error.message.join(", ")
        : error.message || "Email verification failed",
    );
  }

  return response.json();
}


//Login function to authenticate a user with email and password. It sends a POST request to the API and handles errors appropriately, providing user-friendly messages for invalid credentials or other issues.//
export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    const message = Array.isArray(error.message)
      ? error.message.join(", ")
      : error.message;

    if (message === "Invalid credentials") {
      throw new Error(
        "Invalid email or password. Please check your details and try again.",
      );
    }

    throw new Error(message || "Login failed");
  }
  return response.json();
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await fetch(`${API_URL}/users/me`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();

    throw new Error(
      Array.isArray(error.message)
        ? error.message.join(", ")
        : error.message || "Not authenticated",
    );
  }
  return response.json();
}

export async function logout(): Promise<{ message: string }> {
  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("Server logout request failed:", error);
  }

  // The server may reject logout when the account is disabled
  // or the session is no longer valid. The caller must still
  // clear the frontend authentication state.
  return { message: "Logged out locally." };
}
