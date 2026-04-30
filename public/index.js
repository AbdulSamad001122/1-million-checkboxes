const socket = io();

const container = document.getElementById("container");
const CHECK_BOXES_COUNT = 10000;

const OIDC_CONFIG = {
  clientId: "216cfa820c82bd1e63de305ca321b137",
  clientSecret: "4655ce3f36e7bf4fe3dab7299ea568390eabd5825d1d50c3e5619bc5c4d51bec",
  redirectUri: window.location.origin + "/",
  authorizeEndpoint: "https://my-oidc.vercel.app/o/authorize",
  tokenEndpoint: "https://my-oidc.vercel.app/o/token",
  userInfoEndpoint: "https://my-oidc.vercel.app/o/userinfo",
};

let isAuthenticated = false;
let userProfile = null;

function getAuthToken() {
  return localStorage.getItem("id_token") || localStorage.getItem("access_token");
}

function clearAuthTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("id_token");
  localStorage.removeItem("oidc_state");
}

window.addEventListener("load", async () => {
  document.getElementById("login-btn").addEventListener("click", login);
  document.getElementById("logout-btn").addEventListener("click", logout);

  await checkAuth();

  createCheckboxes();
  fetchOldCheckboxes();
  updateUI();
});

function login() {
  const state = Math.random().toString(36).substring(7);
  localStorage.setItem("oidc_state", state);

  const authUrl = `${OIDC_CONFIG.authorizeEndpoint}?client_id=${OIDC_CONFIG.clientId}&redirect_uri=${encodeURIComponent(OIDC_CONFIG.redirectUri)}&response_type=code&state=${state}`;
  window.location.href = authUrl;
}

function logout() {
  clearAuthTokens();
  isAuthenticated = false;
  userProfile = null;
  updateUI();
}

async function checkAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const state = urlParams.get("state");

  const spinner = document.getElementById("auth-spinner");
  const loginBtn = document.getElementById("login-btn");

  if (code) {
    const savedState = localStorage.getItem("oidc_state");
    if (state !== savedState) {
      console.error("State mismatch! Expected", savedState, "but got", state);
      spinner.style.display = "none";
      loginBtn.style.display = "inline-block";
      return;
    }

    spinner.style.display = "inline-block";
    loginBtn.style.display = "none";

    try {
      const response = await fetch(OIDC_CONFIG.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          client_id: OIDC_CONFIG.clientId,
          client_secret: OIDC_CONFIG.clientSecret,
          redirect_uri: OIDC_CONFIG.redirectUri,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) localStorage.setItem("access_token", data.access_token);
        if (data.id_token) localStorage.setItem("id_token", data.id_token);
        window.history.replaceState({}, document.title, "/");
      } else {
        console.error("Token exchange failed:", await response.text());
      }
    } catch (err) {
      console.error("Token exchange failed:", err);
    } finally {
      spinner.style.display = "none";
    }
  }

  const token = getAuthToken();

  if (token) {
    try {
      const response = await fetch(OIDC_CONFIG.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        userProfile = await response.json();
        isAuthenticated = true;
        console.log("User profile loaded:", userProfile);
      } else {
        if (response.status === 401) {
          console.warn("Session expired or invalid. Clearing tokens.");
          clearAuthTokens();
        }
        isAuthenticated = false;
        userProfile = null;
      }
    } catch (err) {
      console.error("Failed to fetch user profile", err);
      isAuthenticated = false;
    }
  }
}

function updateUI() {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userInfo = document.getElementById("user-info");
  const statusBanner = document.getElementById("status-banner");

  if (isAuthenticated && userProfile) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    userInfo.style.display = "inline-block";
    userInfo.textContent = `Welcome, ${userProfile.name || userProfile.email || "User"}`;
    statusBanner.style.display = "none";
  } else {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userInfo.style.display = "none";
    statusBanner.style.display = "block";
  }

  document.querySelectorAll('#container input[type="checkbox"]').forEach((cb) => {
    cb.disabled = !isAuthenticated;
  });
}

function renderOldCheckBox(data) {
  if (!data) return;

  Object.entries(data).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.checked = value === "true";
  });
}

async function fetchOldCheckboxes() {
  try {
    const token = getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch("/checkboxes", { headers });

    if (res.status === 401 && isAuthenticated) {
      logout();
      return;
    }

    if (!res.ok) return;

    const data = await res.json();
    renderOldCheckBox(data);
  } catch (err) {
    console.error("Error fetching checkboxes:", err);
  }
}

socket.on("connect", () => {
  console.log("Connected with id:", socket.id);
});

socket.on("server:checkbox:change", (data) => {
  const checkbox = document.getElementById(data.id);
  if (checkbox) checkbox.checked = data.checked;
});

function createCheckboxes() {
  container.innerHTML = "";

  for (let i = 0; i < CHECK_BOXES_COUNT; i++) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `checkbox-${i}`;
    checkbox.disabled = !isAuthenticated;

    checkbox.addEventListener("change", (e) => {
      if (!isAuthenticated) {
        e.preventDefault();
        e.target.checked = !e.target.checked;
        return;
      }

      socket.emit("client:checkbox:change", {
        id: e.target.id,
        checked: e.target.checked,
      });
    });

    container.appendChild(checkbox);
  }
}
