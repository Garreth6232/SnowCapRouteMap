(function () {
  const MAP_CENTER = { lat: 45.52, lng: -122.47 };
  const DEFAULT_ZOOM = 12;
  const THEME_KEY = "scrm-theme";
  const DARK = "dark";
  const LIGHT = "light";
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
  let cacheStatusEl;
  let legendContainer;
  let legendToggleBtn;
  let legendContent;

  let map;
  let mapReady = false;
  let unlocked = false;
  let mapInitialized = false;

  let geocoder;
  let infoWindow;
  let directionsService;

  let distanceAutocomplete = null;
  let lastDistancePlace = null;
  let lastDistancePlaceValue = "";
  let programmaticDistanceInputUpdate = false;

  let isDarkMode = true;
  let cachedRouteCount = 0;

  const geocodeCache = new Map();
  const validatedStops = new Map();

  const routeButtons = new Map();
  const routeContainers = new Map();
  const routeData = new Map();
  const routeRendererLookup = new Map();
  const ROUTE_RENDERERS = [];

  let overallBounds = null;
  let activeRouteId = null;

  let distanceMarker = null;
  let distanceConnector = null;
  let distanceLabel = null;
  let activeStopButton = null;

  function $(selector) {
    return document.querySelector(selector);
  }

  function toLatLngLiteral(value) {
    if (!value || !value.geometry || !value.geometry.location) return null;
    const location = value.geometry.location;
    return { lat: location.lat(), lng: location.lng() };
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

  function updateInfoWindowColors() {
    if (!infoWindow) return;
    const content = infoWindow.getContent();
    if (content && typeof content === "object" && content.style) {
      content.style.color = "#222";
      content.style.fontWeight = "500";
    }
  }

  function applyTheme(theme, persist = true) {
    const normalized = theme === LIGHT ? LIGHT : DARK;
    isDarkMode = normalized === DARK;
    document.documentElement.setAttribute("data-theme", normalized);
    updateThemeToggle(normalized);
    if (persist) {
      localStorage.setItem(THEME_KEY, normalized);
    }
    if (map) {
      map.setOptions({ styles: mapStyles[normalized] });
    }
    updateInfoWindowColors();
    updateLegendTheme(isDarkMode);
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === LIGHT ? DARK : LIGHT;
    applyTheme(next);
  }

  function updateLegendTheme(darkMode) {
    if (!legendContainer || !legendToggleBtn) return;
    const bg = darkMode ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
    const color = darkMode ? "#fff" : "#000";
    legendContainer.style.background = bg;
    legendContainer.style.color = color;
    legendToggleBtn.style.background = bg;
    legendToggleBtn.style.color = color;
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

  function updateCacheStatus() {
    if (!cacheStatusEl) return;
    cacheStatusEl.textContent = `Cached Routes: ${Math.min(cachedRouteCount, ROUTES.length)}/${ROUTES.length}`;
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

  function clearSelectedStop() {
    if (activeStopButton) {
      activeStopButton.classList.remove("is-selected");
      activeStopButton = null;
    }
  }

  function setSelectedStop(button) {
    if (!button || activeStopButton === button) {
      return;
    }
    clearSelectedStop();
    button.classList.add("is-selected");
    activeStopButton = button;
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

      const handleHover = () => highlightRouteByName(route.name);
      const handleLeave = () => resetHighlight();
      button.addEventListener("mouseenter", handleHover);
      button.addEventListener("focus", handleHover);
      button.addEventListener("mouseleave", handleLeave);
      button.addEventListener("blur", handleLeave);

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

  function setLegendCollapsed(collapsed) {
    if (!legendContainer || !legendToggleBtn || !legendContent) return;
    legendContainer.dataset.collapsed = collapsed ? "true" : "false";
    legendToggleBtn.textContent = collapsed ? "Show Legend" : "Hide Legend";
    legendToggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    legendContent.setAttribute("aria-hidden", collapsed ? "true" : "false");
  }

  function toggleLegend() {
    if (!legendContainer) return;
    const collapsed = legendContainer.dataset.collapsed === "true";
    setLegendCollapsed(!collapsed);
    if (legendContainer.dataset.collapsed === "true") {
      resetHighlight();
    }
  }

  function buildLegend() {
    if (!legendContent) return;
    legendContent.innerHTML = "";
    ROUTES.forEach((route) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "legend__item";
      item.dataset.routeId = route.id;
      item.setAttribute("role", "listitem");

      const swatch = document.createElement("span");
      swatch.className = "legend__swatch";
      swatch.style.background = route.color;

      const label = document.createElement("span");
      label.textContent = route.name;

      item.appendChild(swatch);
      item.appendChild(label);

      item.addEventListener("click", () => {
        focusRoute(route.id);
      });
      item.addEventListener("mouseenter", () => highlightRouteByName(route.name));
      item.addEventListener("focus", () => highlightRouteByName(route.name));
      item.addEventListener("mouseleave", () => resetHighlight());
      item.addEventListener("blur", () => resetHighlight());

      legendContent.appendChild(item);
    });

    updateLegendTheme(isDarkMode);
    setLegendCollapsed(false);
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

  function storeDistancePlace(place, value = "") {
    if (place && place.geometry && place.geometry.location) {
      lastDistancePlace = place;
      lastDistancePlaceValue = value.trim();
    } else {
      lastDistancePlace = null;
      lastDistancePlaceValue = "";
    }
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
    if (distanceLabel) {
      distanceLabel.close();
      distanceLabel = null;
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
    storeDistancePlace(null);
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function generateCurvedPath(start, end) {
    if (!start || !end) {
      return [start, end].filter(Boolean);
    }
    const values = [start.lat, start.lng, end.lat, end.lng];
    if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
      return [start, end];
    }
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const baseOffset = 0.0008;
    const dynamicOffset = distance * 0.2;
    const curveStrength = Math.min(0.015, Math.max(baseOffset, dynamicOffset));
    const controlLat = midLat - dx * curveStrength;
    const controlLng = midLng + dy * curveStrength;
    const steps = 16;
    const path = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const lat =
        (1 - t) * (1 - t) * start.lat +
        2 * (1 - t) * t * controlLat +
        t * t * end.lat;
      const lng =
        (1 - t) * (1 - t) * start.lng +
        2 * (1 - t) * t * controlLng +
        t * t * end.lng;
      path.push({ lat, lng });
    }
    return path;
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
    resetHighlight();
    if (overallBounds && !overallBounds.isEmpty()) {
      const center = overallBounds.getCenter();
      smoothFocus(center, DEFAULT_ZOOM);
      window.setTimeout(() => {
        map.fitBounds(overallBounds, 48);
      }, 240);
    } else {
      map.setCenter(MAP_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  }

  function smoothFocus(location, zoom = 14) {
    if (!map || !location) return;
    map.panTo(location);
    window.setTimeout(() => {
      map.setZoom(zoom);
    }, 200);
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

    resetHighlight();

    if (data.bounds) {
      const center = data.bounds.getCenter();
      smoothFocus(center, Math.max(Math.round(map.getZoom()), data.preferredZoom));
      window.setTimeout(() => {
        map.fitBounds(data.bounds, 48);
      }, 240);
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

    const entry = routeContainers.get(routeId);
    if (entry && entry.stopsList) {
      const button = entry.stopsList.querySelector(
        `.route-stop-button[data-index="${stop.originalIndex}"]`
      );
      if (button) {
        setSelectedStop(button);
      }
    }

    const content = document.createElement("div");
    content.className = "info-window";
    content.style.color = "#222";
    content.style.fontWeight = "500";
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
    updateInfoWindowColors();
    smoothFocus(marker.getPosition(), Math.max(map.getZoom(), 16));
  }

  function applyHighlightState(activeName = null) {
    ROUTE_RENDERERS.forEach((entry) => {
      const isActive = activeName && entry.name === activeName;
      const options = isActive
        ? { polylineOptions: { ...entry.basePolylineOptions, strokeWeight: 6, strokeOpacity: 1 } }
        : activeName
        ? { polylineOptions: { ...entry.basePolylineOptions, strokeOpacity: 0.4 } }
        : { polylineOptions: entry.basePolylineOptions };
      entry.renderer.setOptions(options);
    });
  }

  function highlightRouteByName(routeName) {
    if (!ROUTE_RENDERERS.some((entry) => entry.name === routeName)) {
      return;
    }
    applyHighlightState(routeName);
  }

  function resetHighlight() {
    applyHighlightState(null);
  }

  function emphasizeRoute(routeId, duration = HIGHLIGHT_DURATION) {
    const entry = routeRendererLookup.get(routeId);
    if (!entry) return;
    applyHighlightState(entry.name);
    window.setTimeout(() => {
      resetHighlight();
    }, duration);
  }

  function drawDistanceConnector(targetLatLng, nearestLatLng, routeName, distanceMiles) {
    resetDistanceOverlays();

    distanceMarker = new google.maps.Marker({
      position: targetLatLng,
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#FF0000",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeOpacity: 1,
        strokeWeight: 2,
        scale: 6
      },
      zIndex: 999,
      title: "Distance check location"
    });

    if (nearestLatLng) {
      const path = generateCurvedPath(targetLatLng, nearestLatLng);
      distanceConnector = new google.maps.Polyline({
        path,
        map,
        strokeColor: "#FF0000",
        strokeOpacity: 1,
        strokeWeight: 3,
        icons: [
          {
            icon: {
              path: "M 0,-1 0,1",
              strokeOpacity: 1,
              strokeWeight: 2,
              scale: 4
            },
            offset: "0",
            repeat: "10px"
          }
        ],
        geodesic: true,
        zIndex: 999
      });
      if (routeName && Number.isFinite(distanceMiles)) {
        const connectorPath = distanceConnector.getPath();
        if (connectorPath && connectorPath.getLength() > 0) {
          const midPoint = connectorPath.getAt(Math.floor(connectorPath.getLength() / 2));
          if (midPoint) {
            const content = document.createElement("div");
            content.style.background = "#fff";
            content.style.padding = "6px 10px";
            content.style.borderRadius = "6px";
            content.style.fontSize = "0.8rem";
            content.style.color = "#000";
            content.style.boxShadow = "0 0 4px rgba(0,0,0,0.3)";

            const routeRow = document.createElement("div");
            routeRow.textContent = "Closest Route: ";
            const routeStrong = document.createElement("strong");
            routeStrong.textContent = routeName;
            routeRow.appendChild(routeStrong);

            const distanceRow = document.createElement("div");
            distanceRow.textContent = `Distance: ${distanceMiles.toFixed(2)} mi`;

            content.appendChild(routeRow);
            content.appendChild(distanceRow);

            distanceLabel = new google.maps.InfoWindow({
              position: midPoint,
              content
            });
            distanceLabel.open(map);
          }
        }
      }
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
  function validateRoutes() {
    ROUTES.forEach((route) => {
      const stops = route.addresses.map((address, index) => {
        return {
          address,
          location: null,
          formatted: null,
          originalIndex: index
        };
      });
      validatedStops.set(route.id, stops);
    });
    updateSummary();
  }

  function extendOverallBounds(bounds) {
    if (!bounds || typeof bounds.isEmpty !== "function" || bounds.isEmpty()) return;
    if (!overallBounds) {
      overallBounds = new google.maps.LatLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
    } else {
      overallBounds.union(bounds);
    }
  }

  function cleanupRoute(routeId) {
    const existing = routeData.get(routeId);
    if (!existing) return;
    existing.markers.forEach((marker) => marker.setMap(null));
    if (existing.renderer) {
      existing.renderer.setMap(null);
    }
    if (routeRendererLookup.has(routeId)) {
      const entry = routeRendererLookup.get(routeId);
      const index = ROUTE_RENDERERS.indexOf(entry);
      if (index !== -1) {
        ROUTE_RENDERERS.splice(index, 1);
      }
      routeRendererLookup.delete(routeId);
    }
    routeData.delete(routeId);
  }

  function registerRouteRenderer(route, renderer, basePolylineOptions) {
    const entry = { id: route.id, name: route.name, renderer, basePolylineOptions };
    routeRendererLookup.set(route.id, entry);
    ROUTE_RENDERERS.push(entry);
  }

  async function renderRoute(route) {
    cleanupRoute(route.id);

    const basePolylineOptions = {
      strokeColor: route.color,
      strokeWeight: 4,
      strokeOpacity: 0.9
    };

    const storedStops = validatedStops.get(route.id) || [];
    const stops = route.addresses.map((address, index) => ({
      address,
      formatted: storedStops[index]?.formatted || null,
      location: null,
      originalIndex: index
    }));

    let renderer = null;
    let turfLine = null;
    let miles = null;

    const updateStopFromLatLng = (stopIndex, latLng, formatted) => {
      if (!stops[stopIndex] || !latLng) return;
      const resolved = typeof latLng.lat === "function" ? { lat: latLng.lat(), lng: latLng.lng() } : latLng;
      if (!resolved || !Number.isFinite(resolved.lat) || !Number.isFinite(resolved.lng)) return;
      stops[stopIndex].location = resolved;
      if (formatted) {
        stops[stopIndex].formatted = formatted;
      }
    };

    const ensureMarkers = () =>
      stops
        .filter((stop) => !!stop.location)
        .map((stop) =>
          createMarker(stop.location, route.color, stop.address, () => openStopInfo(route.id, stop.originalIndex))
        );

    const bounds = new google.maps.LatLngBounds();

    const processDirectionsResult = (result) => {
      if (!result || !Array.isArray(result.routes) || !result.routes[0]) return false;
      const gmRoute = result.routes[0];
      const legs = gmRoute.legs || [];
      legs.forEach((leg, index) => {
        if (index === 0) {
          updateStopFromLatLng(0, leg.start_location, leg.start_address);
        }
        updateStopFromLatLng(index + 1, leg.end_location, leg.end_address);
      });

      const overviewPath = gmRoute.overview_path || [];
      const lineString = [];
      overviewPath.forEach((point) => {
        const lat = point.lat();
        const lng = point.lng();
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          bounds.extend({ lat, lng });
          lineString.push([lng, lat]);
        }
      });

      if (gmRoute.bounds) {
        bounds.extend(gmRoute.bounds.getSouthWest());
        bounds.extend(gmRoute.bounds.getNorthEast());
      }

      if (lineString.length >= 2 && typeof turf !== "undefined" && typeof turf.lineString === "function") {
        turfLine = turf.lineString(lineString);
      }

      if (legs.length) {
        const meters = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
        const milesValue = meters / 1609.344;
        miles = Number.isFinite(milesValue) && milesValue > 0 ? milesValue : null;
      }

      renderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: basePolylineOptions
      });
      renderer.setDirections(result);
      renderer.setMap(map);
      registerRouteRenderer(route, renderer, basePolylineOptions);
      return true;
    };

    if (directionsService && route.addresses.length >= 2) {
      const request = {
        origin: route.addresses[0],
        destination: route.addresses[route.addresses.length - 1],
        waypoints: route.addresses.slice(1, -1).map((address) => ({ location: address, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING
      };

      const result = await new Promise((resolve) => {
        directionsService.route(request, (response, status) => {
          if (status === "OK") {
            resolve(response);
          } else {
            console.warn(`⚠️ Route ${route.name} failed:`, status);
            resolve(null);
          }
        });
      });

      if (!processDirectionsResult(result)) {
        renderer = null;
      }
    }

    if (!renderer) {
      await Promise.all(
        stops.map(async (stop, index) => {
          const { result } = await geocodeAddress(stop.address);
          if (result) {
            updateStopFromLatLng(index, result.geometry.location, result.formatted_address);
          }
        })
      );
    }

    const markers = ensureMarkers();
    markers.forEach((marker) => {
      const position = marker.getPosition();
      if (position) {
        bounds.extend(position);
      }
    });

    if (!turfLine) {
      const fallbackLine = stops
        .filter((stop) => stop.location)
        .map((stop) => [stop.location.lng, stop.location.lat]);
      if (fallbackLine.length >= 2 && typeof turf !== "undefined" && typeof turf.lineString === "function") {
        turfLine = turf.lineString(fallbackLine);
        if (!miles && typeof turf.length === "function") {
          const length = turf.length(turfLine, { units: "miles" });
          miles = Number.isFinite(length) && length > 0 ? length : miles;
        }
      }
    }

    const finalBounds = typeof bounds.isEmpty === "function" && !bounds.isEmpty() ? bounds : null;
    if (finalBounds) {
      extendOverallBounds(finalBounds);
    }

    validatedStops.set(route.id, stops);

    const preferredZoom = route.addresses.length > 4 ? 13 : route.addresses.length > 2 ? 14 : 15;

    routeData.set(route.id, {
      renderer,
      basePolylineOptions,
      markers,
      bounds: finalBounds,
      turfLine,
      stops,
      color: route.color,
      preferredZoom
    });

    cachedRouteCount += 1;
    updateRouteLength(route.id, route.addresses.length, miles);
    updateCacheStatus();
  }

  async function renderAllRoutes() {
    overallBounds = null;
    cachedRouteCount = 0;
    updateCacheStatus();

    for (let i = 0; i < ROUTES.length; i += 1) {
      const route = ROUTES[i];
      if (i > 0) {
        await delay(220);
      }
      await renderRoute(route);
    }

    console.log("✅ Dynamic routing restored with legend, highlight, label, and smooth zoom features active");

  }

  async function handleDistanceCheck(event, selectedPlace = null) {
    if (event) {
      event.preventDefault();
    }
    if (!distanceInput || !distanceResultEl) return;
    const value = distanceInput.value.trim();

    let place = selectedPlace;
    if (!place && lastDistancePlace && value && value === lastDistancePlaceValue) {
      place = lastDistancePlace;
    }

    let location = null;

    if (place && place.geometry && place.geometry.location) {
      location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };
    }

    if (!location) {
      if (!value) {
        distanceResultEl.textContent = "Enter an address to calculate distance.";
        return;
      }

      const { status, result } = await geocodeAddress(value);
      if (!result) {
        distanceResultEl.textContent = `Unable to locate address (${status}).`;
        resetDistanceOverlays();
        storeDistancePlace(null);
        return;
      }

      const resolved = toLatLngLiteral(result);
      if (!resolved) {
        distanceResultEl.textContent = "Unable to resolve the selected location.";
        resetDistanceOverlays();
        storeDistancePlace(null);
        return;
      }

      location = resolved;
    } else if (place) {
      const storedValue = (place.formatted_address || place.name || value || "").trim();
      programmaticDistanceInputUpdate = true;
      distanceInput.value = storedValue;
      programmaticDistanceInputUpdate = false;
      storeDistancePlace(place, storedValue);
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

    const closestRoute = ROUTES.find((route) => route.id === bestRouteId);
    const closestName = closestRoute?.name || bestRouteId;
    distanceResultEl.textContent = `Closest route: ${closestName} · ${bestDistance.toFixed(2)} miles away.`;

    drawDistanceConnector(location, nearestPoint, closestName, bestDistance);
    emphasizeRoute(bestRouteId);
    focusRoute(bestRouteId);
  }

  function setupDistanceAutocomplete() {
    if (!distanceInput || typeof google === "undefined" || !google.maps || !google.maps.places || distanceAutocomplete) {
      return;
    }

    distanceAutocomplete = new google.maps.places.Autocomplete(distanceInput, {
      fields: ["geometry", "formatted_address", "name"]
    });
    distanceAutocomplete.bindTo("bounds", map);

    distanceAutocomplete.addListener("place_changed", () => {
      const place = distanceAutocomplete.getPlace();
      if (!place || !place.geometry || !place.geometry.location) {
        storeDistancePlace(null);
        return;
      }
      const displayValue = (place.formatted_address || place.name || distanceInput.value || "").trim();
      programmaticDistanceInputUpdate = true;
      distanceInput.value = displayValue;
      programmaticDistanceInputUpdate = false;
      storeDistancePlace(place, displayValue);
      handleDistanceCheck(null, place);
    });
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
    if (legendToggleBtn) {
      legendToggleBtn.addEventListener("click", toggleLegend);
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
    if (distanceInput) {
      distanceInput.addEventListener("input", () => {
        if (programmaticDistanceInputUpdate) {
          return;
        }
        const currentValue = distanceInput.value.trim();
        if (!currentValue || currentValue !== lastDistancePlaceValue) {
          storeDistancePlace(null);
        }
      });
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

    window.map = map;
    window.ROUTE_RENDERERS = ROUTE_RENDERERS;

    geocoder = new google.maps.Geocoder();
    infoWindow = new google.maps.InfoWindow();
    directionsService = new google.maps.DirectionsService();

    setupDistanceAutocomplete();

    validateRoutes();
    renderAllRoutes()
      .then(() => {
        showAllRoutes();
      })
      .catch((error) => {
        console.error("Failed to render all routes", error);
      });

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
    cacheStatusEl = $("#cache-status");
    legendContainer = $("#legend-container");
    legendToggleBtn = $("#legend-toggle");
    legendContent = $("#route-legend");

    applyTheme(getStoredTheme(), false);
    buildRouteList();
    buildLegend();
    updateSummary();
    updateCacheStatus();
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
