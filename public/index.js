const socket = io();

const container = document.getElementById("container");
const CHECK_BOXES_COUNT = 10000;

const OIDC_CONFIG = {
  clientId: "216cfa820c82bd1e63de305ca321b137",
  redirectUri: window.location.origin + "/",
  authorizeEndpoint: "https://my-oidc.vercel.app/o/authorize",
  userInfoEndpoint: "https://my-oidc.vercel.app/o/userinfo",
};

let isAuthenticated = false;
let userProfile = null;
let isRateLimited = false;
let requestTimestamps = [];

function getAuthToken() {
  return localStorage.getItem("id_token") || localStorage.getItem("access_token");
}

function clearAuthTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("id_token");
  localStorage.removeItem("oidc_state");
}

function showToast(title, message, duration = 3000) {
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <span class="toast-icon">🚫</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-message toast-message-text">${message}</div>
    </div>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-exit");
    toast.addEventListener("animationend", () => toast.remove());
  }, duration);

  return toast;
}

function lockCheckboxes(ms = 5000) {
  if (isRateLimited) return;
  isRateLimited = true;

  document.querySelectorAll('#container input[type="checkbox"]').forEach((cb) => {
    cb.disabled = true;
  });

  const seconds = Math.ceil(ms / 1000);
  let remaining = seconds;

  const toast = showToast("Slow down! 🐢", `Cooldown: ${remaining}s remaining...`, ms);
  const msgEl = toast.querySelector(".toast-message-text");

  const interval = setInterval(() => {
    remaining -= 1;
    if (msgEl) msgEl.textContent = `Cooldown: ${remaining}s remaining...`;
  }, 1000);

  setTimeout(() => {
    clearInterval(interval);
    isRateLimited = false;
    document.querySelectorAll('#container input[type="checkbox"]').forEach((cb) => {
      cb.disabled = !isAuthenticated;
    });
  }, ms);
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
      const response = await fetch("/api/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirectUri: OIDC_CONFIG.redirectUri,
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

socket.on("error", (data) => {
  if (data?.message?.includes("Rate limit")) {
    lockCheckboxes(5000);
  } else {
    showToast("Error", data?.message || "Something went wrong.");
  }
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
      if (!isAuthenticated || isRateLimited) {
        e.target.checked = !e.target.checked;
        return;
      }

      const now = Date.now();
      requestTimestamps = requestTimestamps.filter((t) => now - t < 5000);

      if (requestTimestamps.length >= 3) {
        e.target.checked = !e.target.checked;
        lockCheckboxes(5000);
        return;
      }

      requestTimestamps.push(now);

      socket.emit("client:checkbox:change", {
        id: e.target.id,
        checked: e.target.checked,
        token: getAuthToken(),
      });
    });

    container.appendChild(checkbox);
  }
}
