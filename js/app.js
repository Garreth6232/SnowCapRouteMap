(function () {
  const MAP_CENTER = { lat: 45.52, lng: -122.47 };
  const DEFAULT_ZOOM = 12;
  const THEME_KEY = "scrm-theme";
  const DARK = "dark";
  const LIGHT = "light";

  const mapStyles = {
    dark: [
      { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#e0e0e0" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
      { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { featureType: "water", stylers: [{ color: "#242f3e" }] },
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] }
    ],
    light: []
  };

  let themeToggleBtn;
  let showAllBtn;
  let routeListEl;
  let summaryEl;
  let mapLoaderEl;

  let map;
  let mapReady = false;
  let unlocked = false;
  let mapInitialized = false;

  const routePolylines = new Map();
  const routeBounds = new Map();
  let overallBounds = null;
  const routeButtons = new Map();
  let activeRouteId = null;

  function $(selector) {
    return document.querySelector(selector);
  }

  function getStoredTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === LIGHT || stored === DARK) {
      return stored;
    }
    return DARK;
  }

  function updateThemeToggle(theme) {
    if (!themeToggleBtn) return;
    if (theme === DARK) {
      themeToggleBtn.textContent = "🌙";
      themeToggleBtn.setAttribute("aria-label", "Switch to light mode");
      themeToggleBtn.setAttribute("aria-pressed", "true");
    } else {
      themeToggleBtn.textContent = "☀️";
      themeToggleBtn.setAttribute("aria-label", "Switch to dark mode");
      themeToggleBtn.setAttribute("aria-pressed", "false");
    }
  }

  function applyTheme(theme, persist = true) {
    const normalized = theme === LIGHT ? LIGHT : DARK;
    document.documentElement.setAttribute("data-theme", normalized);
    updateThemeToggle(normalized);
    if (persist) {
      localStorage.setItem(THEME_KEY, normalized);
    }
    if (map) {
      map.setOptions({ styles: mapStyles[normalized] });
    }
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === LIGHT ? DARK : LIGHT;
    applyTheme(next);
  }

  function computeRouteLength(route) {
    if (typeof turf === "undefined") return null;
    const coords = Array.isArray(route.coordinates) ? route.coordinates : [];
    if (coords.length < 2) return 0;
    const line = turf.lineString(coords.map(([lat, lng]) => [lng, lat]));
    const miles = turf.length(line, { units: "miles" });
    return Number.isFinite(miles) ? miles : null;
  }

  function formatMiles(value) {
    if (value === null || value === undefined) return "";
    return `${value.toFixed(1)} mi`;
  }

  function buildRouteList() {
    if (!routeListEl) return;
    routeListEl.innerHTML = "";
    routeButtons.clear();

    ROUTES.forEach((route) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "route-item";
      button.dataset.routeId = route.id;
      button.dataset.active = "false";

      const meta = document.createElement("div");
      meta.className = "route-meta";

      const name = document.createElement("span");
      name.className = "route-name";
      name.textContent = route.name;

      const length = computeRouteLength(route);
      if (length !== null) {
        const lengthEl = document.createElement("span");
        lengthEl.className = "route-length";
        lengthEl.textContent = `${route.coordinates.length} stops · ${formatMiles(length)}`;
        meta.appendChild(name);
        meta.appendChild(lengthEl);
      } else {
        meta.appendChild(name);
      }

      const badge = document.createElement("span");
      badge.className = "route-badge";
      badge.style.background = route.color;

      button.appendChild(meta);
      button.appendChild(badge);
      item.appendChild(button);
      routeListEl.appendChild(item);

      button.addEventListener("click", () => {
        if (activeRouteId === route.id) {
          showAllRoutes();
        } else {
          focusRoute(route.id);
        }
      });

      routeButtons.set(route.id, button);
    });
  }

  function updateSummary() {
    if (!summaryEl) return;
    const totalStops = ROUTES.reduce((sum, route) => sum + route.coordinates.length, 0);
    summaryEl.textContent = `${ROUTES.length} routes · ${totalStops} stops`;
  }

  function showMapLoader(visible) {
    if (!mapLoaderEl) return;
    mapLoaderEl.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function createPolyline(route) {
    const path = route.coordinates.map(([lat, lng]) => ({ lat, lng }));
    const polyline = new google.maps.Polyline({
      path,
      strokeColor: route.color,
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
      geodesic: true
    });
    routePolylines.set(route.id, polyline);

    const bounds = new google.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    if (path.length === 1) {
      bounds.extend({ lat: path[0].lat + 0.0001, lng: path[0].lng + 0.0001 });
    }
    routeBounds.set(route.id, bounds);

    if (!overallBounds) {
      overallBounds = new google.maps.LatLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
    } else {
      overallBounds.union(bounds);
    }
  }

  function drawAllRoutes() {
    routePolylines.forEach((polyline) => polyline.setMap(null));
    routePolylines.clear();
    routeBounds.clear();
    overallBounds = null;

    ROUTES.forEach((route) => createPolyline(route));

    if (overallBounds && !overallBounds.isEmpty()) {
      map.fitBounds(overallBounds, 48);
    } else {
      map.setCenter(MAP_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  }

  function setActiveState(routeId) {
    routeButtons.forEach((button, id) => {
      button.dataset.active = id === routeId ? "true" : "false";
    });
  }

  function focusRoute(routeId) {
    const polyline = routePolylines.get(routeId);
    if (!polyline) return;
    activeRouteId = routeId;
    setActiveState(routeId);

    routePolylines.forEach((line, id) => {
      line.setMap(id === routeId ? map : null);
    });

    const bounds = routeBounds.get(routeId);
    if (bounds && !bounds.isEmpty()) {
      map.fitBounds(bounds, 48);
    }
  }

  function showAllRoutes() {
    activeRouteId = null;
    setActiveState(null);
    routePolylines.forEach((polyline) => {
      polyline.setMap(map);
    });
    if (overallBounds && !overallBounds.isEmpty()) {
      map.fitBounds(overallBounds, 48);
    }
  }

  function initializeMap() {
    if (mapInitialized) return;
    mapInitialized = true;
    showMapLoader(true);

    const currentTheme = document.documentElement.getAttribute("data-theme") || DARK;

    map = new google.maps.Map(document.getElementById("map"), {
      center: MAP_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      styles: mapStyles[currentTheme]
    });

    drawAllRoutes();
    showAllRoutes();

    window.setTimeout(() => {
      showMapLoader(false);
    }, 180);
  }

  function readyToInitialize() {
    return unlocked && mapReady && !mapInitialized;
  }

  document.addEventListener("DOMContentLoaded", () => {
    themeToggleBtn = $("#theme-toggle");
    showAllBtn = $("#show-all");
    routeListEl = $("#route-list");
    summaryEl = $("#route-summary");
    mapLoaderEl = $("#map-loader");

    applyTheme(getStoredTheme(), false);
    buildRouteList();
    updateSummary();

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", () => {
        toggleTheme();
      });
    }

    if (showAllBtn) {
      showAllBtn.addEventListener("click", () => {
        if (!map) return;
        showAllRoutes();
      });
    }
  });

  document.addEventListener("auth:granted", () => {
    unlocked = true;
    if (mapLoaderEl) {
      showMapLoader(true);
    }
    if (readyToInitialize()) {
      initializeMap();
    }
  });

  window.initMap = function initMap() {
    mapReady = true;
    if (readyToInitialize()) {
      initializeMap();
    }
  };
})();
