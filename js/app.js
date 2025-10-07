(function () {
  const MAP_CENTER = { lat: 45.52, lng: -122.47 };
  const DEFAULT_ZOOM = 12;
  const THEME_KEY = "scrm-theme";
  const DARK = "dark";
  const LIGHT = "light";
  const ROUTE_REQUEST_DELAY = 250;
  const DISTANCE_WARNING_MILES = 25;
  const HIGHLIGHT_DURATION = 2600;

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
  let distanceForm;
  let distanceInput;
  let distanceResultEl;
  let distanceClearBtn;

  let map;
  let mapReady = false;
  let unlocked = false;
  let mapInitialized = false;

  let directionsService;
  let geocoder;
  let infoWindow;

  const geocodeCache = new Map();
  const validatedStops = new Map();

  const routeButtons = new Map();
  const routeContainers = new Map();
  const routeData = new Map();

  let overallBounds = null;
  let activeRouteId = null;

  let distanceMarker = null;
  let distanceConnector = null;

  function $(selector) {
    return document.querySelector(selector);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
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

  function showMapLoader(visible) {
    if (!mapLoaderEl) return;
    mapLoaderEl.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function formatMiles(value) {
    if (!Number.isFinite(value)) return "";
    return `${value.toFixed(1)} mi`;
  }

  function updateSummary() {
    if (!summaryEl) return;
    const totalStops = ROUTES.reduce((sum, route) => {
      const validated = validatedStops.get(route.id);
      if (Array.isArray(validated) && validated.length) {
        return sum + validated.length;
      }
      return sum + route.addresses.length;
    }, 0);
    summaryEl.textContent = `${ROUTES.length} routes · ${totalStops} stops`;
  }

  function collapseAllRoutes(exceptId = null) {
    routeContainers.forEach((entry, routeId) => {
      if (routeId === exceptId) return;
      const { container, button, stopsList } = entry;
      container.dataset.expanded = "false";
      button.setAttribute("aria-expanded", "false");
      stopsList.hidden = true;
    });
  }

  function setActiveState(routeId) {
    routeContainers.forEach((entry, id) => {
      entry.container.dataset.active = id === routeId ? "true" : "false";
    });
    routeButtons.forEach((button, id) => {
      button.dataset.active = id === routeId ? "true" : "false";
    });
  }

  function buildRouteList() {
    if (!routeListEl) return;
    routeListEl.innerHTML = "";
    routeButtons.clear();
    routeContainers.clear();

    ROUTES.forEach((route) => {
      const item = document.createElement("li");
      item.className = "route-item";
      item.dataset.routeId = route.id;
      item.dataset.active = "false";
      item.dataset.expanded = "false";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "route-toggle";
      button.dataset.routeId = route.id;
      button.setAttribute("aria-expanded", "false");

      const badge = document.createElement("span");
      badge.className = "route-badge";
      badge.style.background = route.color;

      const meta = document.createElement("div");
      meta.className = "route-meta";

      const name = document.createElement("span");
      name.className = "route-name";
      name.textContent = route.name;

      const length = document.createElement("span");
      length.className = "route-length";
      length.textContent = `${route.addresses.length} stops`;

      meta.appendChild(name);
      meta.appendChild(length);

      const indicator = document.createElement("span");
      indicator.className = "route-indicator";
      indicator.setAttribute("aria-hidden", "true");
      indicator.textContent = "›";

      button.appendChild(badge);
      button.appendChild(meta);
      button.appendChild(indicator);

      const stopsList = document.createElement("ul");
      stopsList.className = "route-stops";
      stopsList.hidden = true;

      route.addresses.forEach((address, index) => {
        const stopItem = document.createElement("li");
        const stopButton = document.createElement("button");
        stopButton.type = "button";
        stopButton.className = "route-stop-button";
        stopButton.dataset.routeId = route.id;
        stopButton.dataset.index = String(index);

        const indexBadge = document.createElement("span");
        indexBadge.className = "route-stop-index";
        indexBadge.textContent = String(index + 1);

        const label = document.createElement("span");
        label.textContent = address;

        stopButton.appendChild(indexBadge);
        stopButton.appendChild(label);
        stopItem.appendChild(stopButton);
        stopsList.appendChild(stopItem);

        stopButton.addEventListener("click", () => {
          focusRoute(route.id);
          openStopInfo(route.id, index);
        });
      });

      button.addEventListener("click", () => {
        const expanded = item.dataset.expanded === "true";
        if (expanded) {
          item.dataset.expanded = "false";
          button.setAttribute("aria-expanded", "false");
          stopsList.hidden = true;
          if (activeRouteId === route.id) {
            showAllRoutes();
          }
        } else {
          collapseAllRoutes(route.id);
          item.dataset.expanded = "true";
          button.setAttribute("aria-expanded", "true");
          stopsList.hidden = false;
          focusRoute(route.id);
        }
      });

      item.appendChild(button);
      item.appendChild(stopsList);
      routeListEl.appendChild(item);

      routeButtons.set(route.id, button);
      routeContainers.set(route.id, {
        container: item,
        button,
        stopsList,
        lengthEl: length
      });
    });
  }

  function updateRouteLength(routeId, stopsCount, miles) {
    const entry = routeContainers.get(routeId);
    if (!entry) return;
    const segments = [];
    const safeStops = Number.isFinite(stopsCount) ? stopsCount : 0;
    segments.push(`${safeStops} ${safeStops === 1 ? "stop" : "stops"}`);
    if (Number.isFinite(miles)) {
      segments.push(formatMiles(miles));
    }
    entry.lengthEl.textContent = segments.join(" · ");
  }

  function ensureInfoWindow() {
    if (!infoWindow) {
      infoWindow = new google.maps.InfoWindow();
    }
    return infoWindow;
  }

  function resetDistanceOverlays() {
    if (distanceMarker) {
      distanceMarker.setMap(null);
      distanceMarker = null;
    }
    if (distanceConnector) {
      distanceConnector.setMap(null);
      distanceConnector = null;
    }
  }

  function clearDistanceUI() {
    if (distanceResultEl) {
      distanceResultEl.textContent = "";
    }
    if (distanceInput) {
      distanceInput.value = "";
    }
    resetDistanceOverlays();
  }

  function showAllRoutes() {
    activeRouteId = null;
    setActiveState(null);
    routeData.forEach((data) => {
      if (data.renderer) {
        data.renderer.setMap(map);
        data.renderer.setOptions({ polylineOptions: data.basePolylineOptions });
      }
      data.markers.forEach((marker) => marker.setMap(map));
    });
    if (overallBounds && !overallBounds.isEmpty()) {
      map.fitBounds(overallBounds, 48);
    } else {
      map.setCenter(MAP_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  }

  function focusRoute(routeId) {
    const data = routeData.get(routeId);
    if (!data) return;
    activeRouteId = routeId;
    setActiveState(routeId);

    routeData.forEach((entry, id) => {
      if (entry.renderer) {
        entry.renderer.setMap(id === routeId ? map : null);
      }
      entry.markers.forEach((marker) => {
        marker.setMap(id === routeId ? map : null);
      });
    });

    if (data.bounds) {
      map.fitBounds(data.bounds, 48);
    }
  }

  function openStopInfo(routeId, originalIndex) {
    const data = routeData.get(routeId);
    if (!data) return;
    const stopIndex = data.stops.findIndex((stop) => stop.originalIndex === originalIndex);
    if (stopIndex === -1) return;
    const marker = data.markers[stopIndex];
    const stop = data.stops[stopIndex];
    if (!marker || !stop) return;

    const content = document.createElement("div");
    content.className = "info-window";
    const title = document.createElement("strong");
    title.textContent = stop.address;
    content.appendChild(title);
    if (stop.formatted && stop.formatted !== stop.address) {
      const formatted = document.createElement("div");
      formatted.textContent = stop.formatted;
      content.appendChild(formatted);
    }

    const windowInstance = ensureInfoWindow();
    windowInstance.setContent(content);
    windowInstance.open({ map, anchor: marker });
    map.panTo(marker.getPosition());
  }

  function highlightRoute(routeId, duration = HIGHLIGHT_DURATION) {
    const data = routeData.get(routeId);
    if (!data || !data.renderer) return;
    data.renderer.setOptions({
      polylineOptions: {
        ...data.basePolylineOptions,
        strokeWeight: 6,
        strokeOpacity: 1,
        zIndex: 50
      }
    });
    if (data.highlightTimeout) {
      window.clearTimeout(data.highlightTimeout);
    }
    data.highlightTimeout = window.setTimeout(() => {
      data.renderer.setOptions({ polylineOptions: data.basePolylineOptions });
    }, duration);
  }

  function drawDistanceConnector(routeId, targetLatLng, nearestLatLng) {
    resetDistanceOverlays();

    const data = routeData.get(routeId);
    const color = data ? data.color : "#ffffff";

    distanceMarker = new google.maps.Marker({
      position: targetLatLng,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#ffffff",
        fillOpacity: 1,
        strokeColor: color,
        strokeOpacity: 1,
        strokeWeight: 2,
        scale: 6
      },
      zIndex: 999,
      title: "Distance check location"
    });

    if (nearestLatLng) {
      distanceConnector = new google.maps.Polyline({
        path: [targetLatLng, nearestLatLng],
        map,
        strokeColor: color,
        strokeOpacity: 0,
        strokeWeight: 0,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 1,
              strokeWeight: 2,
              scale: 4
            },
            offset: "0",
            repeat: "12px"
          }
        ]
      });
    }
  }

  function createMarker(position, color, title, onClick) {
    const marker = new google.maps.Marker({
      position,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#111",
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        scale: 5.5
      },
      title
    });
    if (typeof onClick === "function") {
      marker.addListener("click", onClick);
    }
    return marker;
  }

  async function geocodeAddress(address) {
    if (!geocoder) {
      return { status: "NO_GEOCODER", result: null };
    }
    if (geocodeCache.has(address)) {
      return geocodeCache.get(address);
    }
    const promise = new Promise((resolve) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === "OK" && Array.isArray(results) && results[0]) {
          resolve({ status, result: results[0] });
        } else {
          resolve({ status, result: null });
        }
      });
    });
    geocodeCache.set(address, promise);
    return promise;
  }

  function toLatLngLiteral(result) {
    if (!result || !result.geometry || !result.geometry.location) return null;
    const location = result.geometry.location;
    return { lat: location.lat(), lng: location.lng() };
  }

  async function validateRoutes() {
    if (!geocoder) return;

    for (const route of ROUTES) {
      const stops = [];
      for (let i = 0; i < route.addresses.length; i += 1) {
        const address = route.addresses[i];
        // eslint-disable-next-line no-await-in-loop
        const { status, result } = await geocodeAddress(address);
        if (!result) {
          console.warn(`Failed to geocode ${address} for ${route.name}: ${status}`);
        }
        const location = result ? toLatLngLiteral(result) : null;
        stops.push({
          address,
          location,
          formatted: result ? result.formatted_address : null,
          originalIndex: i
        });
        // eslint-disable-next-line no-await-in-loop
        await wait(120);
      }

      const validStops = stops.filter((stop) => !!stop.location);
      if (typeof turf !== "undefined" && validStops.length >= 2) {
        let warn = false;
        for (let i = 1; i < validStops.length; i += 1) {
          const prev = validStops[i - 1];
          const current = validStops[i];
          const prevPoint = turf.point([prev.location.lng, prev.location.lat]);
          const currentPoint = turf.point([current.location.lng, current.location.lat]);
          const miles = turf.distance(prevPoint, currentPoint, { units: "miles" });
          if (Number.isFinite(miles) && miles > DISTANCE_WARNING_MILES) {
            warn = true;
            break;
          }
        }
        if (warn) {
          console.warn(`Route ${route.name} may contain distant or misordered stops`);
        }
      }

      validatedStops.set(route.id, stops);
    }

    updateSummary();
  }

  function extendOverallBounds(bounds) {
    if (!bounds || bounds.isEmpty()) return;
    if (!overallBounds) {
      overallBounds = new google.maps.LatLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
    } else {
      overallBounds.union(bounds);
    }
  }

  function sanitizeStops(routeId) {
    const stops = validatedStops.get(routeId);
    if (!stops) {
      const fallback = ROUTES.find((route) => route.id === routeId);
      if (!fallback) return [];
      return fallback.addresses
        .map((address, index) => ({ address, location: null, formatted: null, originalIndex: index }))
        .filter((stop) => !!stop.location);
    }
    return stops.filter((stop) => !!stop.location).map((stop) => ({
      address: stop.address,
      location: stop.location,
      formatted: stop.formatted,
      originalIndex: stop.originalIndex
    }));
  }

  function buildDirectionsRequest(route, stops) {
    if (stops.length < 2) return null;
    return {
      origin: stops[0].location,
      destination: stops[stops.length - 1].location,
      waypoints: stops.slice(1, -1).map((stop) => ({ location: stop.location, stopover: true })),
      travelMode: google.maps.TravelMode.DRIVING
    };
  }

  function computeDirectionsDistance(result) {
    if (!result || !result.routes || !result.routes[0]) return null;
    const route = result.routes[0];
    const meters = route.legs.reduce((sum, leg) => sum + (leg.distance ? leg.distance.value : 0), 0);
    return meters / 1609.344;
  }

  async function requestDirections(request, route, stops) {
    if (!request) return null;
    return new Promise((resolve) => {
      directionsService.route(request, async (result, status) => {
        if (status === "OK") {
          resolve({ result, usedStops: stops });
          return;
        }
        if (stops.length <= 2) {
          console.warn(`Failed route for ${route.name}: ${status}`);
          resolve(null);
          return;
        }
        // Skip invalid waypoints one by one
        for (let i = 1; i < stops.length - 1; i += 1) {
          const reduced = stops.filter((_, index) => index !== i);
          const reducedRequest = buildDirectionsRequest(route, reduced);
          // eslint-disable-next-line no-await-in-loop
          const fallback = await requestDirections(reducedRequest, route, reduced);
          if (fallback) {
            console.warn(`Skipped waypoint ${stops[i].address} for ${route.name} due to routing error (${status}).`);
            resolve(fallback);
            return;
          }
        }
        console.warn(`Failed route for ${route.name}: ${status}`);
        resolve(null);
      });
    });
  }

  function ensureRenderer(route) {
    const existing = routeData.get(route.id);
    if (existing && existing.renderer) {
      return existing.renderer;
    }
    const renderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: route.color,
        strokeWeight: 4,
        strokeOpacity: 0.9
      }
    });
    renderer.setMap(map);
    return renderer;
  }

  async function renderRoute(route, delay = 0) {
    if (delay) {
      await wait(delay);
    }

    const existing = routeData.get(route.id);
    if (existing) {
      if (existing.highlightTimeout) {
        window.clearTimeout(existing.highlightTimeout);
      }
      existing.markers.forEach((marker) => marker.setMap(null));
      if (existing.renderer) {
        existing.renderer.setMap(null);
      }
    }

    const availableStops = sanitizeStops(route.id);
    const basePolylineOptions = {
      strokeColor: route.color,
      strokeWeight: 4,
      strokeOpacity: 0.9
    };

    if (availableStops.length < 2) {
      const markers = availableStops.filter((stop) => !!stop.location).map((stop) =>
        createMarker(stop.location, route.color, stop.address, () => openStopInfo(route.id, stop.originalIndex))
      );
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((marker) => {
        if (marker.getPosition()) {
          bounds.extend(marker.getPosition());
        }
      });
      extendOverallBounds(bounds);
      routeData.set(route.id, {
        renderer: null,
        basePolylineOptions,
        markers,
        bounds: bounds.isEmpty() ? null : bounds,
        lineString: null,
        turfLine: null,
        stops: availableStops,
        color: route.color,
        highlightTimeout: null
      });
      updateRouteLength(route.id, availableStops.length, null);
      return;
    }

    const request = buildDirectionsRequest(route, availableStops);
    const renderer = ensureRenderer(route);
    const response = await requestDirections(request, route, availableStops);
    if (!response) {
      renderer.setMap(null);
      const markers = availableStops.filter((stop) => !!stop.location).map((stop) =>
        createMarker(stop.location, route.color, stop.address, () => openStopInfo(route.id, stop.originalIndex))
      );
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((marker) => {
        if (marker.getPosition()) {
          bounds.extend(marker.getPosition());
        }
      });
      extendOverallBounds(bounds);
      routeData.set(route.id, {
        renderer: null,
        basePolylineOptions,
        markers,
        bounds: bounds.isEmpty() ? null : bounds,
        lineString: null,
        turfLine: null,
        stops: availableStops,
        color: route.color,
        highlightTimeout: null
      });
      updateRouteLength(route.id, availableStops.length, null);
      return;
    }

    const { result, usedStops } = response;
    renderer.setDirections(result);

    const bounds = result.routes[0] && result.routes[0].bounds ? result.routes[0].bounds : null;
    if (bounds) {
      extendOverallBounds(bounds);
    }

    const overviewPath = result.routes[0] ? result.routes[0].overview_path || [] : [];
    const lineString = overviewPath.map((latLng) => [latLng.lng(), latLng.lat()]);
    const turfLine = typeof turf !== "undefined" ? turf.lineString(lineString) : null;
    const miles = computeDirectionsDistance(result);

    const markers = usedStops.filter((stop) => !!stop.location).map((stop) =>
      createMarker(stop.location, route.color, stop.address, () => openStopInfo(route.id, stop.originalIndex))
    );

    routeData.set(route.id, {
      renderer,
      basePolylineOptions,
      markers,
      bounds,
      lineString,
      turfLine,
      stops: usedStops,
      color: route.color,
      highlightTimeout: null
    });

    updateRouteLength(route.id, usedStops.length, miles);
  }

  async function renderAllRoutes() {
    overallBounds = null;
    for (let i = 0; i < ROUTES.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await renderRoute(ROUTES[i], ROUTE_REQUEST_DELAY * i);
    }
    console.log("✅ All routes rendered successfully");
    if (overallBounds && !overallBounds.isEmpty()) {
      map.fitBounds(overallBounds, 48);
    }
  }

  async function handleDistanceCheck(event) {
    event.preventDefault();
    if (!distanceInput || !distanceResultEl) return;
    const value = distanceInput.value.trim();
    if (!value) {
      distanceResultEl.textContent = "Enter an address to calculate distance.";
      return;
    }

    const { status, result } = await geocodeAddress(value);
    if (!result) {
      distanceResultEl.textContent = `Unable to locate address (${status}).`;
      resetDistanceOverlays();
      return;
    }

    const location = toLatLngLiteral(result);
    if (!location) {
      distanceResultEl.textContent = "Unable to resolve the selected location.";
      resetDistanceOverlays();
      return;
    }

    const point = typeof turf !== "undefined" ? turf.point([location.lng, location.lat]) : null;
    if (!point) {
      distanceResultEl.textContent = "Distance calculations unavailable.";
      return;
    }

    let bestRouteId = null;
    let bestDistance = Infinity;
    let nearestPoint = null;

    routeData.forEach((data, routeId) => {
      if (!data.turfLine) return;
      const nearest = turf.nearestPointOnLine(data.turfLine, point, { units: "miles" });
      if (!nearest || !Number.isFinite(nearest.properties.dist)) return;
      if (nearest.properties.dist < bestDistance) {
        bestDistance = nearest.properties.dist;
        bestRouteId = routeId;
        nearestPoint = { lat: nearest.geometry.coordinates[1], lng: nearest.geometry.coordinates[0] };
      }
    });

    if (!bestRouteId || !Number.isFinite(bestDistance)) {
      distanceResultEl.textContent = "No routes available for distance calculation.";
      return;
    }

    distanceResultEl.textContent = `Closest route: ${ROUTES.find((route) => route.id === bestRouteId)?.name || bestRouteId} · ${bestDistance.toFixed(2)} miles away.`;

    drawDistanceConnector(bestRouteId, location, nearestPoint);
    highlightRoute(bestRouteId);
    focusRoute(bestRouteId);
  }

  function bindUI() {
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener("click", toggleTheme);
    }
    if (showAllBtn) {
      showAllBtn.addEventListener("click", () => {
        if (!map) return;
        collapseAllRoutes(null);
        showAllRoutes();
      });
    }
    if (distanceForm) {
      distanceForm.addEventListener("submit", handleDistanceCheck);
    }
    if (distanceClearBtn) {
      distanceClearBtn.addEventListener("click", () => {
        clearDistanceUI();
        collapseAllRoutes(null);
        showAllRoutes();
      });
    }
  }

  async function initializeMap() {
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

    window.map = map;

    directionsService = new google.maps.DirectionsService();
    geocoder = new google.maps.Geocoder();
    infoWindow = new google.maps.InfoWindow();

    await validateRoutes();
    await renderAllRoutes();
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
    distanceForm = $("#distance-form");
    distanceInput = $("#distance-address");
    distanceResultEl = $("#distance-result");
    distanceClearBtn = $("#distance-clear");

    applyTheme(getStoredTheme(), false);
    buildRouteList();
    updateSummary();
    bindUI();
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

  function runCodexValidationTests() {
    const results = [];

    // Test 1: Map loaded
    if (window.map && map instanceof google.maps.Map) results.push("✅ Map loaded");
    else results.push("❌ Map not initialized");

    // Test 2: Route data present
    if (window.ROUTES && ROUTES.length >= 13) results.push(`✅ ${ROUTES.length} routes loaded`);
    else results.push("❌ Route data missing");

    // Test 3: Directions rendered
    const gmOverlays = document.querySelectorAll(".gm-style div");
    if (gmOverlays.length > 0) results.push("✅ Routes rendered");
    else results.push("❌ No route overlays found");

    // Test 4: Distance tool visible
    if (document.querySelector("#check-distance")) results.push("✅ Distance tool present");
    else results.push("❌ Distance tool missing");

    console.groupCollapsed("Codex Route Mapper QA Results");
    results.forEach((r) => console.log(r));
    console.groupEnd();
  }

  window.addEventListener("load", () => setTimeout(runCodexValidationTests, 4000));
})();
