// === Firebase Setup ===
const firebaseConfig = {
  apiKey: "AIzaSyB66bXzJd-41gp87YMVmO7zSZabmwQVVFM",
  authDomain: "snusmap-6245b.firebaseapp.com",
  projectId: "snusmap-6245b",
  storageBucket: "snusmap-6245b.appspot.com",
  messagingSenderId: "485549625203",
  appId: "1:485549625203:web:efa5bde3074a76ad24bf06"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const IMGUR_CLIENT_ID = "c590f6e5dc85f51";

// === Emoji Auto-Wechsel ===
function isiOS() {
  return /iPad|iPhone|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
}
function applyEmojiMode() {
  if (!isiOS()) document.body.classList.add("android-emoji");
}
applyEmojiMode();

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

// === Auth ===
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
function setStatus(msg, success = false) {
  const s = document.getElementById("auth-status");
  s.innerText = msg;
  s.style.color = success ? "lightgreen" : "red";
}
function register() {
  const u = document.getElementById("reg-username").value.trim().toLowerCase();
  const a = document.getElementById("reg-anzeige").value.trim();
  const p = document.getElementById("reg-password").value;
  const c = document.getElementById("reg-password-confirm").value;
  if (!u || !a || p !== c) return setStatus("Fehlerhafte Eingabe.");

  const recovery = generateRecoveryPhrase();
  db.collection("users").doc(u).get().then(doc => {
    if (doc.exists) return setStatus("Username ist bereits vergeben.");
    db.collection("users").doc(u).set({
      anzeigeName: a,
      passwort: p,
      recoveryPhrase: recovery,
      bio: "",
      profilBild: ""
    }).then(() => {
      currentUser = u;
      localStorage.setItem("snus_user", u);
      document.getElementById("recovery-display").innerText = "Recovery Phrase: " + recovery;
      setStatus("Registrierung erfolgreich!", true);
      startMap();
    });
  });
}
function login() {
  const u = document.getElementById("login-username").value.trim().toLowerCase();
  const p = document.getElementById("login-password").value;
  db.collection("users").doc(u).get().then(doc => {
    if (!doc.exists || doc.data().passwort !== p) return setStatus("Login fehlgeschlagen.");
    currentUser = u;
    localStorage.setItem("snus_user", u);
    setStatus("Login erfolgreich!", true);
    startMap();
  });
}
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
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '' }).addTo(map);

  navigator.geolocation.getCurrentPosition(pos => {
    userLocation = [pos.coords.latitude, pos.coords.longitude];
    map.setView(userLocation, 13);
    userCircle = L.circle(userLocation, { radius: 4000, color: "lime", fillOpacity: 0.2 }).addTo(map);
  }, () => {
    userLocation = [51.1657, 10.4515];
    map.setView(userLocation, 6);
  });

  loadSpots();
  loadProfile();
}

// === SPOT ERSTELLEN (NEUES POPUP UI) ===
let pendingSpotCoords = null;
let selectedRating = 0;
let selectedImageFile = null;

function enableSpotPlacement() {
  alert("Tippe auf die Karte, um deinen Spot zu platzieren.");
  canPlaceSpot = true;

  map.once("click", (e) => {
    if (!canPlaceSpot) return;
    canPlaceSpot = false;

    const distance = map.distance(userLocation, [e.latlng.lat, e.latlng.lng]);
    if (distance > 4000) return alert("Dieser Punkt liegt außerhalb des 4 km Radius.");

    // Temporäre rote Pin-Nadel
    L.marker(e.latlng, { icon: L.icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    })}).addTo(map);

    pendingSpotCoords = e.latlng;
    selectedRating = 0;
    selectedImageFile = null;
    document.getElementById("spotDesc").value = "";
    updateStarDisplay();
    document.getElementById("spotPhotoBox").innerText = "+";

    const popup = document.getElementById("spotPopup");
    popup.style.display = "flex";
    setTimeout(() => popup.classList.add("visible"), 10);
  });
}

function setRating(stars) {
  selectedRating = stars;
  updateStarDisplay();
}

function updateStarDisplay() {
  const stars = document.querySelectorAll("#ratingStars span");
  stars.forEach((star, index) => {
    star.innerText = index < selectedRating ? "★" : "☆";
    star.classList.toggle("active", index < selectedRating);
  });
}

// === File Input Binding ===
window.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("spotPhotoInput");
  input.addEventListener("change", (e) => {
    selectedImageFile = e.target.files[0];
    document.getElementById("spotPhotoBox").innerText = selectedImageFile ? "✓" : "+";
  });
});









function confirmSpot() {
  const desc = document.getElementById("spotDesc").value.trim();
  const timestamp = new Date().toISOString();
  const stars = selectedRating || 1;

  if (!pendingSpotCoords) return;
  if (!desc) return alert("Beschreibung fehlt.");

  if (selectedImageFile) {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result.split(',')[1];
      try {
        const res = await fetch("https://api.imgur.com/3/image", {
          method: "POST",
          headers: {
            Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ image: base64 })
        });
        const data = await res.json();
        saveSpot(pendingSpotCoords, desc, stars, timestamp, data.data.link);
      } catch {
        alert("Bild-Upload fehlgeschlagen.");
        saveSpot(pendingSpotCoords, desc, stars, timestamp, null);
      }
    };
    reader.readAsDataURL(selectedImageFile);
  } else {
    saveSpot(pendingSpotCoords, desc, stars, timestamp, null);
  }

  document.getElementById("spotPopup").style.display = "none";
}

function saveSpot(coords, desc, stars, timestamp, photoURL) {
  db.collection("spots").add({
    user: currentUser,
    location: new firebase.firestore.GeoPoint(coords.lat, coords.lng),
    description: desc,
    rating: stars,
    createdAt: timestamp,
    photo: photoURL
  }).then(() => loadSpots());
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
        const img = spot.photo ? `<img src="${spot.photo}" onclick="showImage('${spot.photo}')" style="width:100%;margin-top:8px;border-radius:6px;" />` : "";
        const popup = `
          <strong>${name}</strong><br>
          ${"⭐".repeat(spot.rating || 1)}<br>
          ${spot.description}<br>
          ${img}
          <small>${spot.createdAt}</small><br>
          ${spot.user === currentUser ? `<button onclick="deleteSpot('${doc.id}')">Löschen</button>` : ""}
        `;
        L.marker(latlng).addTo(map).bindPopup(popup);
      });
    });
  });
}

function showImage(url) {
  const overlay = document.getElementById("imageOverlay");
  const img = document.getElementById("fullscreenImage");
  img.src = url;
  overlay.style.display = "flex";
}

function deleteSpot(id) {
  if (!confirm("Diesen Spot wirklich löschen?")) return;
  db.collection("spots").doc(id).delete().then(() => loadSpots());
}

// === Profilfunktionen ===
function loadProfile() {
  db.collection("users").doc(currentUser).get().then(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    document.getElementById("profil-icon").innerText = data.profilBild || "👤";
    document.getElementById("profil-anzeige").innerText = data.anzeigeName;
    document.getElementById("profil-username").innerText = "@" + currentUser;
  });
}