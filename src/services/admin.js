export async function adminRequest(path, accessToken, options = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`/api/admin${path}`, { ...options, headers });
  const result = response.status === 204 ? {} : await response.json().catch(() => null);
  if (!result || typeof result !== "object") throw new Error("The admin service returned an invalid response.");
  if (!response.ok) throw new Error(result.message ?? "The request could not be completed.");
  return result;
}
