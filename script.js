
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
let map, userCircle, canPlaceSpot = false, userLocation = null;

// === Recovery Phrase Generator ===
function generateRecoveryPhrase() {
  const words = ["frog", "shadow", "orange", "hill", "dust", "echo", "grape", "rocket"];
  let phrase = [];
  for (let i = 0; i < 6; i++) {
    phrase.push(words[Math.floor(Math.random() * words.length)]);
  }
  return phrase.join("-");
}

// === Auth ===
function register() {
  const username = document.getElementById("reg-username").value.trim();
  const anzeige = document.getElementById("reg-anzeige").value.trim();
  const pw = document.getElementById("reg-password").value;
  const pwConfirm = document.getElementById("reg-password-confirm").value;

  if (!username || !anzeige || pw !== pwConfirm) {
    alert("Fehler bei der Eingabe.");
    return;
  }

  const recovery = generateRecoveryPhrase();
  db.collection("users").doc(username).set({
    anzeigeName: anzeige,
    passwort: pw,
    recoveryPhrase: recovery,
    bio: "",
    profilBild: ""
  }).then(() => {
    currentUser = username;
    document.getElementById("recovery-display").innerText = "Recovery Phrase: " + recovery;
    startMap();
  });
}

function login() {
  const username = document.getElementById("login-username").value.trim();
  const pw = document.getElementById("login-password").value;

  db.collection("users").doc(username).get().then(doc => {
    if (!doc.exists || doc.data().passwort !== pw) {
      alert("Login fehlgeschlagen.");
      return;
    }
    currentUser = username;
    startMap();
  });
}

// === Map + Spot Logik ===
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
    userCircle = L.circle(userLocation, { radius: 40000 }).addTo(map);
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
      alert("Du bist außerhalb des erlaubten Radius.");
      return;
    }

    const desc = prompt("Was ging da ab?");
    const timestamp = new Date().toISOString();
    db.collection("spots").add({
      user: currentUser,
      location: new firebase.firestore.GeoPoint(e.latlng.lat, e.latlng.lng),
      description: desc,
      createdAt: timestamp
    }).then(() => loadSpots());
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