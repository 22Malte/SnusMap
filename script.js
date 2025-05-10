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

// === Globals ===
let currentUser = null;
let map, userCircle, userLocation = null;
let canPlaceSpot = false;
let pendingSpotCoords = null;
let selectedRating = 0;
let selectedImageFile = null;

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
  return Array.from({ length: 6 }, () => words[Math.floor(Math.random() * words.length)]).join("-");
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

function editDisplayName() {
  const neuerName = prompt("Neuer Displayname:");
  if (!neuerName) return;
  db.collection("users").doc(currentUser).update({
    anzeigeName: neuerName
  }).then(() => {
    loadProfile();
    alert("Displayname aktualisiert!");
  });
}

function editProfilBild() {
  const emoji = prompt("Neues Profil-Emoji eingeben (z.B. 😎):");
  if (!emoji) return;
  db.collection("users").doc(currentUser).update({
    profilBild: emoji
  }).then(() => {
    loadProfile();
    alert("Profilbild aktualisiert!");
  });
}

function resetPasswort() {
  const neuesPW = prompt("Neues Passwort:");
  if (!neuesPW) return;
  db.collection("users").doc(currentUser).update({
    passwort: neuesPW
  }).then(() => {
    alert("Passwort erfolgreich geändert!");
  });
}

function resetRecovery() {
  const neuePhrase = generateRecoveryPhrase();
  db.collection("users").doc(currentUser).update({
    recoveryPhrase: neuePhrase
  }).then(() => {
    alert("Neue Recovery Phrase:\n" + neuePhrase);
  });
}

function deleteAccount() {
  if (!confirm("Willst du wirklich deinen Account löschen? Dies kann nicht rückgängig gemacht werden!")) return;
  // 1. Nutzerprofil löschen
  db.collection("users").doc(currentUser).delete().then(() => {
    // 2. Alle Spots des Users löschen
    db.collection("spots").where("user", "==", currentUser).get().then(snapshot => {
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      batch.commit().then(() => {
        localStorage.removeItem("snus_user");
        alert("Account und Spots gelöscht.");
        location.reload();
      });
    });
  });
}



function reloadmap() {
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

// === Spot setzen ===
function enableSpotPlacement() {
  alert("Tippe auf die Karte, um deinen Spot zu platzieren.");
  canPlaceSpot = true;
  map.once("click", (e) => {
    if (!canPlaceSpot) return;
    canPlaceSpot = false;

    const distance = map.distance(userLocation, [e.latlng.lat, e.latlng.lng]);
    if (distance > 4000) return alert("Dieser Punkt liegt außerhalb des 4 km Radius.");

    L.marker(e.latlng, { icon: L.icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    })}).addTo(map);

    pendingSpotCoords = e.latlng;
    selectedRating = 0;
    selectedImageFile = null;
    document.getElementById("spotDesc").value = "";
    document.getElementById("spotPhotoBox").innerText = "+";
    updateStarDisplay();

    const popup = document.getElementById("spotPopup");
    popup.style.display = "flex";
    setTimeout(() => popup.classList.add("visible"), 10);
  });
}

function setRating(r) {
  selectedRating = r;
  updateStarDisplay();
}
function updateStarDisplay() {
  const stars = document.querySelectorAll("#ratingStars span");
  stars.forEach((s, i) => {
    s.innerText = i < selectedRating ? "★" : "☆";
    s.classList.toggle("active", i < selectedRating);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("spotPhotoInput");
  if (input) {
    input.addEventListener("change", (e) => {
      selectedImageFile = e.target.files[0];
      document.getElementById("spotPhotoBox").innerText = selectedImageFile ? "✓" : "+";
    });
  }
});

function confirmSpot() {
  const desc = document.getElementById("spotDesc").value.trim();
  const timestamp = new Date().toISOString();
  const stars = selectedRating || 1;
  if (!pendingSpotCoords) return alert("Kein Standort gewählt.");
  if (!desc) return alert("Beschreibung fehlt.");

  if (selectedImageFile) {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result.split(",")[1];
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
        if (data.success && data.data.link) {
          saveSpot(pendingSpotCoords, desc, stars, timestamp, data.data.link);
        } else {
          alert("Bild konnte nicht hochgeladen werden.");
          saveSpot(pendingSpotCoords, desc, stars, timestamp, null);
        }
      } catch {
        alert("Fehler beim Hochladen.");
        saveSpot(pendingSpotCoords, desc, stars, timestamp, null);
      }
    };
    reader.readAsDataURL(selectedImageFile);
  } else {
    saveSpot(pendingSpotCoords, desc, stars, timestamp, null);
  }

  document.getElementById("spotPopup").classList.remove("visible");
  setTimeout(() => {
    document.getElementById("spotPopup").style.display = "none";
  }, 300);
}

function saveSpot(coords, desc, stars, timestamp, photoURL) {
  db.collection("spots").add({
    user: currentUser,
    location: new firebase.firestore.GeoPoint(coords.lat, coords.lng),
    description: desc,
    rating: stars,
    createdAt: timestamp,
    photo: photoURL || null
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
        ${spot.user === currentUser ? `<button onclick="deleteSpot('${doc.id}')">Löschen</button>` : `<button style="background-color:red;color:white;padding:6px 12px;margin-top:6px;border:none;border-radius:6px;" onclick="openReport('${doc.id}', '${spot.user}')">Melden</button>`}
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

function loadProfile() {
  db.collection("users").doc(currentUser).get().then(doc => {
    if (!doc.exists) return;
    const data = doc.data();
    document.getElementById("profil-icon").innerText = data.profilBild || "👤";
    document.getElementById("profil-anzeige").innerText = data.anzeigeName;
    document.getElementById("profil-username").innerText = "@" + currentUser;
  });
}


let reportSpotId = null;
let reportSpotUser = null;

function openReport(spotId, spotUser) {
  reportSpotId = spotId;
  reportSpotUser = spotUser;
  document.getElementById("reportPopup").style.display = "flex";
}

function closeReport() {
  document.getElementById("reportPopup").style.display = "none";
}

function submitReport() {
  const reason = document.getElementById("reportReason").value;

  if (!reportSpotId || !reason) {
    alert("Fehler beim Reporten.");
    return;
  }

fetch('https://1e9e-147-189-171-45.ngrok-free.app/report'', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    spotId: reportSpotId,
    spotUser: reportSpotUser,
    reporter: currentUser,
    reason: reason
  })
  }).then(() => {
    alert("Report erfolgreich abgeschickt.");
    closeReport();
  }).catch(() => {
    alert("Fehler beim Abschicken.");
  });
}
