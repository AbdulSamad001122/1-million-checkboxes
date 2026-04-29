const socket = io();

const container = document.getElementById("container");
const CHECK_BOXES_COUNT = 100;

document.addEventListener("DOMContentLoaded", () => {
  createCheckboxes();
  fetchOldCheckboxes();
});

function renderOldCheckBox(data) {
  if (!data) return;

  Object.entries(data).forEach(([id, value]) => {
    const el = document.getElementById(id);
    console.log("This elem is gotted", el);

    if (el) {
      el.checked = value.state;
    } else {
      console.log("Missing checkbox:", key);
    }
  });
}

async function fetchOldCheckboxes() {
  try {
    const res = await fetch("http://localhost:8000/checkboxes");
    const data = await res.json();

    renderOldCheckBox(data);
  } catch (err) {
    console.error("Error:", err);
  }
}

socket.on("connect", () => {
  console.log(socket.id);
});

socket.on("server:checkbox:change", (data) => {
  console.log("Socket server Event:", data);

  const get_checkbox = document.getElementById(data.id);
  get_checkbox.checked = data.checked;
});

function createCheckboxes() {
  const array_checkboxes = new Array(CHECK_BOXES_COUNT).fill(false);

  array_checkboxes.forEach((_, index) => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `checkbox-${index}`;
    container.appendChild(checkbox);

    checkbox.addEventListener("change", (e) => {
      socket.emit("client:checkbox:change", {
        id: e.target.id,
        checked: e.target.checked,
      });
    });
  });
}
