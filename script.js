
let map = L.map('map').setView([51.1657, 10.4515], 6);
let userPosition = null;
let savedSpots = JSON.parse(localStorage.getItem("snusSpots")) || [];

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap-Mitwirkende'
}).addTo(map);

window.onload = function () {
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
};

function createSpot() {
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

  const marker = L.marker([userPosition.lat, userPosition.lng]).addTo(map);
  marker.bindPopup(`<strong>Bewertung:</strong> ${rating}/5<br><strong>Beschreibung:</strong> ${desc}`).openPopup();

  const newSpot = { lat: userPosition.lat, lng: userPosition.lng, rating, desc };
  savedSpots.push(newSpot);
  localStorage.setItem("snusSpots", JSON.stringify(savedSpots));
}

savedSpots.forEach(spot => {
  const marker = L.marker([spot.lat, spot.lng]).addTo(map);
  marker.bindPopup(`<strong>Bewertung:</strong> ${spot.rating}/5<br><strong>Beschreibung:</strong> ${spot.desc}`);
});
