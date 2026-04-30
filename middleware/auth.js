const OIDC_USERINFO_ENDPOINT = "https://my-oidc.vercel.app/o/userinfo";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const response = await fetch(OIDC_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = await response.json();
    next();
  } catch (err) {
    return res.status(500).json({ error: "Auth check failed" });
  }
}
