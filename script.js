


<script type="module">



  const firebaseConfig = {
    apiKey: "AIzaSyC9bZLvBVy-hXxc7J0PrFbeyqLVj1Kp7hg",
    authDomain: "snusmap.firebaseapp.com",
    projectId: "snusmap",
    storageBucket: "snusmap.firebasestorage.app",
    messagingSenderId: "262693140003",
    appId: "1:262693140003:web:4726bbf4013ca223c6e396"
  };



// Firebase initialisieren
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const spotsCollection = db.collection("snusSpots");

let map = L.map('map').setView([51.1657, 10.4515], 6);
let userPosition = null;
let savedSpots = [];

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap-Mitwirkende'
}).addTo(map);

// Spots aus Firestore laden und auf der Karte anzeigen
function loadSpots() {
  spotsCollection.onSnapshot(snapshot => {
    savedSpots = [];
    snapshot.forEach(doc => {
      const spot = doc.data();
      savedSpots.push(spot);
      updateMarker(spot);
    });
  });
}

// Marker erstellen/aktualisieren
function updateMarker(spot) {
  const existingMarker = savedSpots.find(s => s.id === spot.id)?.marker;
  if (existingMarker) {
    existingMarker.setLatLng([spot.lat, spot.lng]);
    existingMarker.setPopupContent(`<strong>Bewertung:</strong> ${spot.rating}/5<br><strong>Beschreibung:</strong> ${spot.desc}`);
  } else {
    const marker = L.marker([spot.lat, spot.lng]).addTo(map);
    marker.bindPopup(`<strong>Bewertung:</strong> ${spot.rating}/5<br><strong>Beschreibung:</strong> ${spot.desc}`);
    spot.marker = marker;
  }
}

// Spot erstellen und in Firestore speichern
async function createSpot() {
  if (!userPosition) {
    alert("Standort ist noch nicht verfügbar.");
    return;
  }

  const rating = prompt("Wie stark war der Snus-Moment? (1–5 Sterne)");
  const desc = prompt("Was ist passiert? (Beschreibung)");

  if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
    alert("Ungültige Bewertung.");
    return;
  }

  const newSpot = {
    lat: userPosition.lat,
    lng: userPosition.lng,
    rating,
    desc,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  await spotsCollection.add(newSpot);
}

// Standort abfragen (wie zuvor)
window.onload = function() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      userPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      map.setView([userPosition.lat, userPosition.lng], 14);
    }, err => {
      alert("Standort konnte nicht abgerufen werden.");
    });
  } else {
    alert("Geolocation wird von diesem Gerät nicht unterstützt.");
  }
  loadSpots(); // Spots initial laden
};