// === Firebase Setup ===

const firebaseConfig = {
  apiKey: "AIzaSyB66bXzJd-41gp87YMVmO7zSZabmwQVVFM",
  authDomain: "snusmap-6245b.firebaseapp.com",
  projectId: "snusmap-6245b",
  storageBucket: "snusmap-6245b.firebasestorage.app",
  messagingSenderId: "485549625203",
  appId: "1:485549625203:web:efa5bde3074a76ad24bf06",
  measurementId: "G-88KNW2SKGR"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
let map, userCircle, userLocation = null;
let canPlaceSpot = false;

// === Tabs ===
function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach(tab => tab.style.display = "none");
  document.getElementById(tabId).style.display = "block";
}

// === Session Restore ===
window.onload = () => {
  const savedUser = localStorage.getItem("snus_user");
  if (savedUser) {
    currentUser = savedUser;
    startMap();
  }
};

// === Recovery Phrase Generator ===
function generateRecoveryPhrase() {
  const words = ["shadow", "lemon", "river", "jungle", "echo", "sugar", "storm", "pine"];
  let phrase = [];
  for (let i = 0; i < 6; i++) {
    phrase.push(words[Math.floor(Math.random() * words.length)]);
  }
  return phrase.join("-");
}

// === Auth UI Handling ===
function showRegister() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "block";
  setStatus("");
}

function showLogin() {
  document.getElementById("login-form").style.display = "block";
  document.getElementById("register-form").style.display = "none";
  setStatus("");
}

function setStatus(message, success = false) {
  const status = document.getElementById("auth-status");
  status.innerText = message;
  status.style.color = success ? "lightgreen" : "red";
}

// === Registrierung ===
function register() {
  const username = document.getElementById("reg-username").value.trim().toLowerCase();
  const anzeige = document.getElementById("reg-anzeige").value.trim();
  const pw = document.getElementById("reg-password").value;
  const pwConfirm = document.getElementById("reg-password-confirm").value;

  if (!username || !anzeige || pw !== pwConfirm) {
    return setStatus("Fehlerhafte Eingabe.");
  }

  const recovery = generateRecoveryPhrase();
  db.collection("users").doc(username).get().then(doc => {
    if (doc.exists) return setStatus("Username ist bereits vergeben.");

    db.collection("users").doc(username).set({
      anzeigeName: anzeige,
      passwort: pw,
      recoveryPhrase: recovery,
      bio: "",
      profilBild: ""
    }).then(() => {
      currentUser = username;
      localStorage.setItem("snus_user", username);
      document.getElementById("recovery-display").innerText = "Recovery Phrase: " + recovery;
      setStatus("Registrierung erfolgreich!", true);
      startMap();
    }).catch(() => setStatus("Fehler beim Speichern."));
  });
}

// === Login ===
function login() {
  const username = document.getElementById("login-username").value.trim().toLowerCase();
  const pw = document.getElementById("login-password").value;

  db.collection("users").doc(username).get().then(doc => {
    if (!doc.exists || doc.data().passwort !== pw) {
      return setStatus("Login fehlgeschlagen.");
    }
    currentUser = username;
    localStorage.setItem("snus_user", username);
    setStatus("Login erfolgreich!", true);
    startMap();
  }).catch(() => setStatus("Verbindung fehlgeschlagen."));
}

// === Logout ===
function logout() {
  if (!confirm("Willst du dich wirklich ausloggen?")) return;
  localStorage.removeItem("snus_user");
  currentUser = null;
  location.reload();
}

// === MAP ===
function startMap() {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("app-ui").style.display = "block";
  switchTab("tab-map");

  map = L.map('map').setView([51.1657, 10.4515], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  navigator.geolocation.getCurrentPosition(pos => {
    userLocation = [pos.coords.latitude, pos.coords.longitude];
    map.setView(userLocation, 13);
    userCircle = L.circle(userLocation, { radius: 40000, color: "lime", fillOpacity: 0.2 }).addTo(map);
  }, () => {
    alert("Standort konnte nicht abgerufen werden.");
    userLocation = [51.1657, 10.4515];
    map.setView(userLocation, 6);
  });

  loadSpots();
  loadProfile();
}

function enableSpotPlacement() {
  canPlaceSpot = true;
  map.once("click", e => {
    if (!canPlaceSpot) return;
    canPlaceSpot = false;

    const distance = map.distance(userLocation, [e.latlng.lat, e.latlng.lng]);
    if (distance > 40000) {
      alert("Dieser Punkt liegt außerhalb des 40 km Radius.");
      return;
    }

    const desc = prompt("Was ging da ab?");
    if (!desc || desc.trim() === "") {
      alert("Beschreibung ist erforderlich.");
      return;
    }

    const rating = prompt("Wie viele Sterne gibst du diesem Ort? (1-5)");
    const stars = Math.min(5, Math.max(1, parseInt(rating) || 0));
    const timestamp = new Date().toISOString();

    db.collection("spots").add({
      user: currentUser,
      location: new firebase.firestore.GeoPoint(e.latlng.lat, e.latlng.lng),
      description: desc,
      rating: stars,
      createdAt: timestamp
    }).then(() => {
      loadSpots();
    });
  });
}

function loadSpots() {
  db.collection("spots").get().then(snapshot => {
    map.eachLayer(layer => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    snapshot.forEach(doc => {
      const spot = doc.data();
      const latlng = [spot.location.latitude, spot.location.longitude];
      db.collection("users").doc(spot.user).get().then(userDoc => {
        const name = userDoc.exists ? userDoc.data().anzeigeName : "Unbekannt";
        const popupContent = `
          <strong>${name}</strong><br>
          ${"⭐".repeat(spot.rating || 1)}<br>
          ${spot.description}<br>
          <small>${spot.createdAt}</small><br>
          ${spot.user === currentUser ? `<button onclick="deleteSpot('${doc.id}')">Löschen</button>` : ""}
        `;
        L.marker(latlng).addTo(map).bindPopup(popupContent);
      });
    });
  });
}

function deleteSpot(id) {
  if (!confirm("Diesen Spot wirklich löschen?")) return;
  db.collection("spots").doc(id).delete().then(() => {
    loadSpots();
  });
}

// === Profil-Info laden ===
function loadProfile() {
  db.collection("users").doc(currentUser).get().then(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    document.getElementById("profile-info").innerHTML = `
      <div style="text-align:center;">
        <div style="font-size: 48px;">🧑</div>
        <strong>${data.anzeigeName}</strong><br>
        <small>@${currentUser}</small>
      </div>
    `;
  });
}
