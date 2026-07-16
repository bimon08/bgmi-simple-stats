/** Wrapper around fetch that attaches the collaborator sync key as a Bearer token when present. */
export function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const collabKey = typeof window !== "undefined" ? localStorage.getItem("sc_collab_key") : null;
  if (collabKey) {
    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${collabKey}`);
    }
    return fetch(url, { ...init, headers });
  }
  return fetch(url, init);
}
