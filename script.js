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

// === Globale Variablen ===
let currentUser = null;
let map, userCircle, userLocation = null;
let canPlaceSpot = false;

// === Recovery Phrase Generator ===
function generateRecoveryPhrase() {
  const words = ["shadow", "lemon", "river", "jungle", "echo", "sugar", "storm", "pine"];
  let phrase = [];
  for (let i = 0; i < 6; i++) {
    phrase.push(words[Math.floor(Math.random() * words.length)]);
  }
  return phrase.join("-");
}

// === UI Switcher & Feedback ===
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
      document.getElementById("recovery-display").innerText = "Recovery Phrase: " + recovery;
      setStatus("Registrierung erfolgreich!", true);
      startMap();
    }).catch(err => setStatus("Fehler beim Speichern."));
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
    setStatus("Login erfolgreich!", true);
    startMap();
  }).catch(() => setStatus("Verbindung fehlgeschlagen."));
}

// === MAP ===
function startMap() {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("map-ui").style.display = "block";

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
    userLocation = [51.1657, 10.4515]; // Deutschland-Mitte Fallback
    map.setView(userLocation, 6);
  });

  loadSpots();
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

    const timestamp = new Date().toISOString();

    db.collection("spots").add({
      user: currentUser,
      location: new firebase.firestore.GeoPoint(e.latlng.lat, e.latlng.lng),
      description: desc,
      createdAt: timestamp
    }).then(() => {
      loadSpots();
    });
  });
}

function loadSpots() {
  db.collection("spots").get().then(snapshot => {
    snapshot.forEach(doc => {
      const spot = doc.data();
      const latlng = [spot.location.latitude, spot.location.longitude];
      db.collection("users").doc(spot.user).get().then(userDoc => {
        const name = userDoc.exists ? userDoc.data().anzeigeName : "Unbekannt";
        const popup = `<strong>${name}</strong><br>${spot.description}<br><small>${spot.createdAt}</small>`;
        L.marker(latlng).addTo(map).bindPopup(popup);
      });
    });
  });
}