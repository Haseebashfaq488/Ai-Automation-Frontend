export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://upstairs-earring-craftwork.ngrok-free.dev";

/**
 * Returns default headers required for API communication and bypassing ngrok free-tier interstitials.
 */
export function getHeaders(customHeaders = {}) {
  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...customHeaders,
  };
}

/**
 * Wrapper around native fetch that ensures ngrok skip headers and base URLs are applied.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  return fetch(url, {
    ...options,
    headers: getHeaders(options.headers),
  });
}
