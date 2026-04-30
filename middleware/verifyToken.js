const OIDC_USERINFO_ENDPOINT = "https://my-oidc.vercel.app/o/userinfo";

export async function verifyToken(token) {
  if (!token) return null;

  try {
    const response = await fetch(OIDC_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}
