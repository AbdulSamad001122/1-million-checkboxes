import { getOldData } from "../redis.connection.js";

const OIDC_USERINFO_ENDPOINT = "https://my-oidc.vercel.app/o/userinfo";

export async function verifyToken(token) {
  if (!token) return null;

  const cacheKey = `user-token:${token}`;

  try {
    const cachedUser = await getOldData.get(cacheKey);
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }

    const response = await fetch(OIDC_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const user = await response.json();


    await getOldData.set(cacheKey, JSON.stringify(user), "EX", 86400);

    return user;
  } catch (err) {
    console.error("Token verification error:", err);
    return null;
  }
}
