// Application state container.
const state = {
  mode: "all",
  selectedRouteId: null,
  addressMarker: null,
  connectorLine: null,
  highlightedRouteId: null
};

let map;
let geocoder;
const routeStore = new Map();

const DEFAULT_STROKE_WEIGHT = 4;
const HIGHLIGHT_STROKE_WEIGHT = 7;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 30.2682, lng: -97.7422 },
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false
  });

  geocoder = new google.maps.Geocoder();

  renderRoutes();
  renderSidebar();
  attachEventHandlers();
}

window.initMap = initMap;

function renderRoutes() {
  ROUTES.forEach((route, index) => {
    const path = route.coordinates.map(([lat, lng]) => ({ lat, lng }));
    const polyline = new google.maps.Polyline({
      path,
      strokeColor: route.color,
      strokeOpacity: 0.9,
      strokeWeight: DEFAULT_STROKE_WEIGHT,
      map,
      zIndex: index + 1
    });

    const lineString = turf.lineString(
      route.coordinates.map(([lat, lng]) => [lng, lat])
    );

    routeStore.set(route.id, {
      route,
      polyline,
      lineString
    });
  });
}

function renderSidebar() {
  const list = document.getElementById("routeList");
  list.innerHTML = "";

  ROUTES.forEach((route) => {
    const item = document.createElement("li");
    item.className = "route-item";
    item.tabIndex = 0;
    item.dataset.routeId = route.id;

    const swatch = document.createElement("span");
    swatch.className = "route-color";
    swatch.style.backgroundColor = route.color;

    const label = document.createElement("span");
    label.className = "route-name";
    label.textContent = route.name;

    item.appendChild(swatch);
    item.appendChild(label);

    item.addEventListener("click", () => selectSingleRoute(route.id));
    item.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        selectSingleRoute(route.id);
      }
    });

    list.appendChild(item);
  });
}

function attachEventHandlers() {
  document.getElementById("showAllBtn").addEventListener("click", showAllRoutes);
  document.getElementById("clearAddressBtn").addEventListener("click", clearAddress);

  const form = document.getElementById("addressForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const address = document.getElementById("addressInput").value.trim();
    if (!address) {
      updateResultPanel("Please enter an address.");
      return;
    }
    geocodeAddress(address);
  });
}

function showAllRoutes() {
  state.mode = "all";
  state.selectedRouteId = null;
  document.getElementById("routeList").querySelectorAll(".route-item").forEach((item) => {
    item.classList.remove("is-active");
  });

  routeStore.forEach(({ polyline }) => {
    polyline.setMap(map);
    polyline.setOptions({
      strokeOpacity: 0.9,
      strokeWeight: DEFAULT_STROKE_WEIGHT,
      zIndex: 1
    });
  });

  state.highlightedRouteId = null;
}

function selectSingleRoute(routeId) {
  state.mode = "single";
  state.selectedRouteId = routeId;
  state.highlightedRouteId = routeId;

  document.getElementById("routeList").querySelectorAll(".route-item").forEach((item) => {
    if (item.dataset.routeId === routeId) {
      item.classList.add("is-active");
    } else {
      item.classList.remove("is-active");
    }
  });

  routeStore.forEach(({ polyline }, id) => {
    if (id === routeId) {
      polyline.setMap(map);
      polyline.setOptions({
        strokeOpacity: 0.95,
        strokeWeight: HIGHLIGHT_STROKE_WEIGHT,
        zIndex: 10
      });
    } else {
      polyline.setMap(null);
    }
  });
}

function geocodeAddress(address) {
  geocoder.geocode({ address }, (results, status) => {
    if (status !== "OK" || !results || !results.length) {
      updateResultPanel("We could not locate that address. Try another query.");
      return;
    }

    const location = results[0].geometry.location;
    placeAddressMarker(location, results[0].formatted_address);
    const closest = findClosestRoute(location);

    if (closest) {
      highlightRoute(closest.route.id, location, closest.nearestLatLng);
      const miles = kilometersToMiles(closest.distanceKm);
      const message = `${closest.route.name}: ${miles.toFixed(2)} miles away.`;
      updateResultPanel(message);
      focusRouteListItem(closest.route.id);
    } else {
      updateResultPanel("No routes available.");
    }
  });
}

function placeAddressMarker(location, addressLabel) {
  if (!state.addressMarker) {
    state.addressMarker = new google.maps.Marker({
      map,
      title: addressLabel
    });
  }
  state.addressMarker.setPosition(location);
  state.addressMarker.setTitle(addressLabel || "Searched address");

  if (!map.getBounds() || !map.getBounds().contains(location)) {
    map.panTo(location);
  }
}

function findClosestRoute(latLng) {
  const point = turf.point([latLng.lng(), latLng.lat()]);
  let bestMatch = null;

  routeStore.forEach(({ route, lineString }) => {
    const nearestPoint = turf.nearestPointOnLine(lineString, point);
    const distanceKm = turf.distance(point, nearestPoint, { units: "kilometers" });

    if (!bestMatch || distanceKm < bestMatch.distanceKm) {
      bestMatch = {
        route,
        distanceKm,
        nearestLatLng: new google.maps.LatLng(nearestPoint.geometry.coordinates[1], nearestPoint.geometry.coordinates[0])
      };
    }
  });

  return bestMatch;
}

function highlightRoute(routeId, addressLatLng, nearestLatLng) {
  if (state.mode === "single" && state.selectedRouteId !== routeId) {
    selectSingleRoute(routeId);
  } else if (state.mode === "all") {
    routeStore.forEach(({ polyline }, id) => {
      const isTarget = id === routeId;
      polyline.setOptions({
        strokeOpacity: isTarget ? 1 : 0.45,
        strokeWeight: isTarget ? HIGHLIGHT_STROKE_WEIGHT : DEFAULT_STROKE_WEIGHT,
        zIndex: isTarget ? 15 : 1
      });
    });
    state.highlightedRouteId = routeId;
  }

  if (nearestLatLng) {
    drawConnector(addressLatLng, nearestLatLng);
  }
}

function drawConnector(addressLatLng, nearestLatLng) {
  if (state.connectorLine) {
    state.connectorLine.setMap(null);
  }

  state.connectorLine = new google.maps.Polyline({
    path: [addressLatLng, nearestLatLng],
    strokeColor: "#1f2933",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    icons: [
      {
        icon: {
          path: "M 0,-1 0,1",
          strokeOpacity: 0.8,
          scale: 4
        },
        offset: "0",
        repeat: "12px"
      }
    ],
    map
  });
}

function updateResultPanel(message) {
  const panel = document.getElementById("resultPanel");
  panel.textContent = message;
}

function focusRouteListItem(routeId) {
  const list = document.getElementById("routeList");
  const target = list.querySelector(`[data-route-id="${routeId}"]`);
  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("is-highlight");
  setTimeout(() => target.classList.remove("is-highlight"), 1500);
}

function clearAddress() {
  if (state.addressMarker) {
    state.addressMarker.setMap(null);
    state.addressMarker = null;
  }

  if (state.connectorLine) {
    state.connectorLine.setMap(null);
    state.connectorLine = null;
  }

  updateResultPanel("Enter an address to find the closest route.");

  if (state.mode === "all") {
    routeStore.forEach(({ polyline }) => {
      polyline.setOptions({
        strokeOpacity: 0.9,
        strokeWeight: DEFAULT_STROKE_WEIGHT,
        zIndex: 1
      });
    });
    state.highlightedRouteId = null;
  }
}

function kilometersToMiles(km) {
  return km * 0.621371;
}
