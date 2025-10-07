(function () {
  const MAP_CENTER = { lat: 45.503, lng: -122.48 };
  const DEFAULT_ZOOM = 12;
  const STORAGE_KEY = "savedRoutes";

  let initialized = false;
  let map;
  let geocoder;
  let routes = [];
  let allBounds;

  const routePolylines = new Map();
  const routeBounds = new Map();
  const routeLineStrings = new Map();
  const routeButtons = new Map();

  let routeListEl;
  let resultsPanelEl;
  let addressInputEl;
  let routeSummaryEl;
  let showAllBtn;
  let editModeBtn;
  let clearAddressBtn;
  let editPanelEl;
  let saveRouteBtn;
  let cancelEditBtn;

  let mode = "all";
  let selectedRouteId = null;

  let marker = null;
  let connectorLine = null;

  let editing = false;
  let editRouteId = null;
  let editDraft = null;
  let editOriginal = null;
  let editMarkers = [];
  let mapClickListener = null;

  function ensureDependencies() {
    return (
      typeof google !== "undefined" &&
      google.maps &&
      typeof ROUTES !== "undefined" &&
      Array.isArray(ROUTES) &&
      typeof Utils !== "undefined" &&
      typeof turf !== "undefined"
    );
  }

  function cloneRoute(route) {
    return {
      id: route.id,
      name: route.name,
      color: route.color,
      addresses: Array.isArray(route.addresses)
        ? route.addresses.map((address) => String(address))
        : [],
      coordinates: Array.isArray(route.coordinates)
        ? route.coordinates
            .map((coord) =>
              Array.isArray(coord) && coord.length === 2
                ? [Number(coord[0]), Number(coord[1])]
                : null
            )
            .filter(Boolean)
        : [],
    };
  }

  function routesAreEqual(a, b) {
    if (!a || !b) return false;
    if (a.coordinates.length !== b.coordinates.length) return false;
    for (let i = 0; i < a.coordinates.length; i += 1) {
      const [alat, alng] = a.coordinates[i];
      const [blat, blng] = b.coordinates[i];
      if (alat !== blat || alng !== blng) {
        return false;
      }
    }
    if (a.addresses.length !== b.addresses.length) return false;
    for (let i = 0; i < a.addresses.length; i += 1) {
      if (a.addresses[i] !== b.addresses[i]) {
        return false;
      }
    }
    return true;
  }

  function loadRoutes() {
    const baseRoutes = Array.isArray(ROUTES) ? ROUTES.map(cloneRoute) : [];

    let savedRoutes = [];
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed)) {
          savedRoutes = parsed
            .map(cloneRoute)
            .filter((route) => typeof route.id === "string");
        }
      }
    } catch (error) {
      console.warn("Unable to parse saved routes from localStorage.", error);
    }

    savedRoutes.forEach((saved) => {
      const existingIndex = baseRoutes.findIndex((route) => route.id === saved.id);
      if (existingIndex >= 0) {
        baseRoutes[existingIndex] = saved;
      } else {
        baseRoutes.push(saved);
      }
    });

    return baseRoutes;
  }

  function persistRoutes() {
    try {
      const serializable = routes.map(cloneRoute);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.warn("Unable to save routes to localStorage.", error);
    }
  }

  function getRouteById(routeId) {
    return routes.find((route) => route.id === routeId) || null;
  }

  function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
      center: MAP_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: "greedy",
    });
    geocoder = new google.maps.Geocoder();
  }

  function updateRouteSummary() {
    if (!routeSummaryEl) return;
    const totalStops = routes.reduce((count, route) => count + route.coordinates.length, 0);
    routeSummaryEl.textContent = `${routes.length} routes · ${totalStops} stops`;
  }

  function buildRouteResources() {
    allBounds = new google.maps.LatLngBounds();
    routePolylines.clear();
    routeBounds.clear();
    routeLineStrings.clear();

    routes.forEach((route) => {
      const latLngs = Utils.toLatLngs(route.coordinates);
      const polyline = new google.maps.Polyline({
        map,
        path: latLngs,
        strokeColor: route.color,
        strokeOpacity: 0.95,
        strokeWeight: 4,
        zIndex: 1,
      });

      const bounds = new google.maps.LatLngBounds();
      latLngs.forEach((latLng) => {
        bounds.extend(latLng);
        allBounds.extend(latLng);
      });

      routePolylines.set(route.id, polyline);
      routeBounds.set(route.id, bounds);
      routeLineStrings.set(route.id, Utils.toLineString(route.coordinates));
    });

    if (!allBounds.isEmpty()) {
      map.fitBounds(allBounds, 60);
    }
  }

  function refreshAllBounds() {
    const combined = new google.maps.LatLngBounds();
    routeBounds.forEach((bounds) => {
      if (bounds && !bounds.isEmpty()) {
        combined.union(bounds);
      }
    });
    allBounds = combined;
  }

  function createRouteButton(route) {
    const button = Utils.createEl("button", {
      className: "route-item",
      attrs: {
        type: "button",
        "data-route-id": route.id,
        "aria-pressed": "false",
        title: route.addresses.join("\n"),
      },
    });

    const label = Utils.createEl("span", { className: "route-item__label" });
    const swatch = Utils.createEl("span", { className: "route-item__swatch" });
    swatch.style.backgroundColor = route.color;
    const name = Utils.createEl("span", {
      className: "route-item__name",
      text: route.name,
    });
    label.appendChild(swatch);
    label.appendChild(name);

    const hint = Utils.createEl("span", {
      className: "route-item__hint",
      text: `${route.coordinates.length} stops`,
    });

    button.appendChild(label);
    button.appendChild(hint);

    button.addEventListener("click", () => handleRouteSelection(route.id));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        button.click();
      }
    });

    return button;
  }

  function buildRouteList() {
    if (!routeListEl) return;
    routeListEl.innerHTML = "";
    routeButtons.clear();

    routes.forEach((route) => {
      const button = createRouteButton(route);
      routeListEl.appendChild(button);
      routeButtons.set(route.id, button);
    });

    updateRouteSummary();
    updateRouteSelection(selectedRouteId);
  }

  function updateRouteSelection(routeId) {
    routeButtons.forEach((button, id) => {
      const isSelected = id === routeId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }

  function showAllRoutes() {
    if (editing) return;
    mode = "all";
    selectedRouteId = null;

    routePolylines.forEach((polyline) => {
      polyline.setVisible(true);
      polyline.setOptions({ strokeWeight: 4, zIndex: 1 });
    });

    updateRouteSelection(null);

    if (allBounds && !allBounds.isEmpty()) {
      map.fitBounds(allBounds, 60);
    }
  }

  function showSingleRoute(routeId) {
    mode = "single";
    selectedRouteId = routeId;

    routePolylines.forEach((polyline, id) => {
      const isSelected = id === routeId;
      polyline.setVisible(isSelected || editing);
      polyline.setOptions({
        strokeWeight: isSelected ? 6 : 3,
        zIndex: isSelected ? 4 : 1,
        strokeOpacity: isSelected ? 1 : 0.35,
      });
    });

    updateRouteSelection(routeId);

    const bounds = routeBounds.get(routeId);
    if (bounds && !bounds.isEmpty()) {
      map.fitBounds(bounds, 60);
    }
  }

  function setResults(content) {
    if (!resultsPanelEl) return;
    resultsPanelEl.innerHTML = "";

    const title = Utils.createEl("h2", {
      className: "section-title",
      text: "Closest route",
    });
    resultsPanelEl.appendChild(title);

    if (typeof content === "string") {
      const message = Utils.createEl("p", {
        className: "result-text",
        text: content,
      });
      resultsPanelEl.appendChild(message);
      return;
    }

    if (content && typeof content === "object") {
      const { address, routeName, miles } = content;
      const message = Utils.createEl("p", { className: "result-text" });
      message.innerHTML = `<strong>${routeName}</strong> is ${miles} miles away.`;
      resultsPanelEl.appendChild(message);

      if (address) {
        const meta = Utils.createEl("p", {
          className: "result-meta",
          text: `Address: ${address}`,
        });
        resultsPanelEl.appendChild(meta);
      }
    }
  }

  function resetResults() {
    setResults("Search for an address to see the nearest route.");
  }

  function clearAddress() {
    if (marker) {
      marker.setMap(null);
      marker = null;
    }

    if (connectorLine) {
      connectorLine.setMap(null);
      connectorLine = null;
    }

    resetResults();
    if (!editing) {
      showAllRoutes();
    }
    if (addressInputEl) {
      addressInputEl.value = "";
      addressInputEl.focus();
    }
  }

  function drawConnector(fromLatLng, toLatLng, color) {
    const symbol = {
      path: "M 0,-1 0,1",
      strokeOpacity: 1,
      strokeColor: color,
      scale: 3,
    };

    if (!connectorLine) {
      connectorLine = new google.maps.Polyline({
        map,
        strokeOpacity: 0,
        strokeWeight: 2,
        zIndex: 2,
      });
    }

    connectorLine.setOptions({
      path: [fromLatLng, toLatLng],
      strokeColor: color,
      icons: [
        {
          icon: symbol,
          offset: "0",
          repeat: "12px",
        },
      ],
    });
  }

  function handleGeocode(address) {
    if (!geocoder) return;

    geocoder.geocode({ address }, (results, status) => {
      if (status !== "OK" || !results || !results[0]) {
        setResults("Unable to find that address. Try a different search.");
        return;
      }

      const result = results[0];
      const location = result.geometry.location;

      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position: location,
          animation: google.maps.Animation.DROP,
        });
      } else {
        marker.setPosition(location);
      }

      map.panTo(location);

      const searchPoint = turf.point([location.lng(), location.lat()]);
      let closest = null;

      routes.forEach((route) => {
        const line = routeLineStrings.get(route.id);
        if (!line) return;
        const nearest = turf.nearestPointOnLine(line, searchPoint);
        const distanceKm = turf.distance(searchPoint, nearest, { units: "kilometers" });

        if (!closest || distanceKm < closest.distanceKm) {
          closest = {
            route,
            nearest,
            distanceKm,
          };
        }
      });

      if (!closest) {
        setResults("No routes available to compare.");
        return;
      }

      const nearestLatLng = new google.maps.LatLng(
        closest.nearest.geometry.coordinates[1],
        closest.nearest.geometry.coordinates[0]
      );

      drawConnector(location, nearestLatLng, closest.route.color);

      const miles = Utils.toMiles(closest.distanceKm);
      setResults({
        routeName: closest.route.name,
        miles,
        address: result.formatted_address,
      });

      if (!editing) {
        showSingleRoute(closest.route.id);
        Utils.scrollToRoute(closest.route.id);
      }
    });
  }

  function clearEditMarkers() {
    editMarkers.forEach((markerInstance) => {
      markerInstance.setMap(null);
    });
    editMarkers = [];
  }

  function updatePolylinePathFromDraft() {
    if (!editRouteId || !editDraft) return;
    const polyline = routePolylines.get(editRouteId);
    if (polyline) {
      polyline.setPath(Utils.toLatLngs(editDraft.coordinates));
    }
    routeLineStrings.set(editRouteId, Utils.toLineString(editDraft.coordinates));
    const bounds = new google.maps.LatLngBounds();
    editDraft.coordinates.forEach(([lat, lng]) => {
      bounds.extend(new google.maps.LatLng(lat, lng));
    });
    routeBounds.set(editRouteId, bounds);
    refreshAllBounds();
  }

  function renderDraftMarkers() {
    clearEditMarkers();
    if (!editing || !editDraft) return;

    const route = getRouteById(editRouteId);
    const color = route ? route.color : "#2563eb";

    editDraft.coordinates.forEach(([lat, lng], index) => {
      const markerInstance = new google.maps.Marker({
        map,
        position: { lat, lng },
        draggable: true,
        title: editDraft.addresses[index] || `Stop ${index + 1}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: 5,
      });

      markerInstance.addListener("dragend", (event) => {
        editDraft.coordinates[index] = [event.latLng.lat(), event.latLng.lng()];
        updatePolylinePathFromDraft();
        updateEditButtons();
      });

      markerInstance.addListener("click", () => {
        if (!editing) return;
        const label = editDraft.addresses[index] || `Stop ${index + 1}`;
        const confirmed = window.confirm(`Remove stop "${label}" from this route?`);
        if (!confirmed) return;
        editDraft.coordinates.splice(index, 1);
        editDraft.addresses.splice(index, 1);
        updatePolylinePathFromDraft();
        renderDraftMarkers();
        updateEditButtons();
      });

      editMarkers.push(markerInstance);
    });
  }

  function isDraftDirty() {
    if (!editing || !editDraft || !editOriginal) return false;
    return !routesAreEqual(editDraft, editOriginal);
  }

  function startDraft(routeId) {
    const route = getRouteById(routeId);
    if (!route) return;
    editRouteId = routeId;
    editOriginal = cloneRoute(route);
    editDraft = cloneRoute(route);
    renderDraftMarkers();
    updatePolylinePathFromDraft();
    showSingleRoute(routeId);
    updateEditButtons();
  }

  function enterEditMode() {
    if (editing) return;
    if (!routes.length) return;

    editing = true;
    document.body.classList.add("edit-mode");
    editModeBtn.setAttribute("aria-pressed", "true");
    editModeBtn.textContent = "Exit Edit Mode";
    if (editPanelEl) {
      editPanelEl.hidden = false;
    }
    if (showAllBtn) {
      showAllBtn.disabled = true;
    }

    if (!selectedRouteId) {
      selectedRouteId = routes[0].id;
    }
    startDraft(selectedRouteId);

    if (!mapClickListener) {
      mapClickListener = map.addListener("click", (event) => {
        if (!editing || !editDraft) return;
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        const defaultLabel = `New stop (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
        const label = window.prompt("Label for the new stop:", defaultLabel) || defaultLabel;
        editDraft.coordinates.push([lat, lng]);
        editDraft.addresses.push(label.trim());
        updatePolylinePathFromDraft();
        renderDraftMarkers();
        updateEditButtons();
      });
    }
  }

  function cleanupDraft(revertPolyline = false) {
    if (revertPolyline && editRouteId && editOriginal) {
      const polyline = routePolylines.get(editRouteId);
      if (polyline) {
        polyline.setPath(Utils.toLatLngs(editOriginal.coordinates));
      }
      const bounds = new google.maps.LatLngBounds();
      editOriginal.coordinates.forEach(([lat, lng]) => {
        bounds.extend(new google.maps.LatLng(lat, lng));
      });
      routeBounds.set(editRouteId, bounds);
      routeLineStrings.set(editRouteId, Utils.toLineString(editOriginal.coordinates));
      refreshAllBounds();
    }
    clearEditMarkers();
    editDraft = null;
    editOriginal = null;
    editRouteId = null;
    updateEditButtons();
  }

  function exitEditMode({ revert = true } = {}) {
    if (!editing) return;

    if (mapClickListener) {
      google.maps.event.removeListener(mapClickListener);
      mapClickListener = null;
    }

    cleanupDraft(revert);

    editing = false;
    document.body.classList.remove("edit-mode");
    editModeBtn.setAttribute("aria-pressed", "false");
    editModeBtn.textContent = "Edit Route";
    if (editPanelEl) {
      editPanelEl.hidden = true;
    }
    if (showAllBtn) {
      showAllBtn.disabled = false;
    }
    if (saveRouteBtn) {
      saveRouteBtn.disabled = true;
    }

    updateRouteSelection(selectedRouteId);
    if (!selectedRouteId) {
      showAllRoutes();
    } else {
      showSingleRoute(selectedRouteId);
    }
  }

  function saveDraft() {
    if (!editing || !editRouteId || !editDraft) return;
    const route = getRouteById(editRouteId);
    if (!route) return;

    route.addresses = editDraft.addresses.map((address) => String(address));
    route.coordinates = editDraft.coordinates.map(([lat, lng]) => [lat, lng]);

    persistRoutes();
    recalcRouteResources(editRouteId);
    buildRouteList();
    updateRouteSummary();
    exitEditMode({ revert: false });
  }

  function recalcRouteResources(routeId) {
    const route = getRouteById(routeId);
    if (!route) return;

    const latLngs = Utils.toLatLngs(route.coordinates);
    const polyline = routePolylines.get(routeId);
    if (polyline) {
      polyline.setPath(latLngs);
      polyline.setOptions({ strokeColor: route.color });
    } else {
      const newPolyline = new google.maps.Polyline({
        map,
        path: latLngs,
        strokeColor: route.color,
        strokeOpacity: 0.95,
        strokeWeight: 4,
        zIndex: 1,
      });
      routePolylines.set(routeId, newPolyline);
    }

    const bounds = new google.maps.LatLngBounds();
    latLngs.forEach((latLng) => bounds.extend(latLng));
    routeBounds.set(routeId, bounds);
    routeLineStrings.set(routeId, Utils.toLineString(route.coordinates));
    refreshAllBounds();

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 60);
    }
  }

  function handleRouteSelection(routeId) {
    if (editing && editRouteId && routeId !== editRouteId) {
      if (isDraftDirty()) {
        const proceed = window.confirm(
          "Discard unsaved changes and switch to another route?"
        );
        if (!proceed) {
          return;
        }
      }
      cleanupDraft(true);
      startDraft(routeId);
      return;
    }

    if (mode === "single" && selectedRouteId === routeId && !editing) {
      showAllRoutes();
    } else {
      showSingleRoute(routeId);
    }
  }

  function updateEditButtons() {
    if (!saveRouteBtn) return;
    saveRouteBtn.disabled = !editing || !isDraftDirty();
  }

  function attachEventHandlers() {
    showAllBtn = document.getElementById("show-all");
    editModeBtn = document.getElementById("edit-route");
    clearAddressBtn = document.getElementById("clear-address");
    editPanelEl = document.getElementById("edit-panel");
    saveRouteBtn = document.getElementById("save-route");
    cancelEditBtn = document.getElementById("cancel-edit");

    if (showAllBtn) {
      showAllBtn.addEventListener("click", () => {
        showAllRoutes();
        resetResults();
      });
    }

    if (editModeBtn) {
      editModeBtn.addEventListener("click", () => {
        if (!editing) {
          enterEditMode();
        } else if (isDraftDirty()) {
          const confirmExit = window.confirm(
            "Discard unsaved changes and exit edit mode?"
          );
          if (!confirmExit) return;
          exitEditMode({ revert: true });
        } else {
          exitEditMode({ revert: true });
        }
      });
    }

    if (clearAddressBtn) {
      clearAddressBtn.addEventListener("click", () => {
        clearAddress();
      });
    }

    if (saveRouteBtn) {
      saveRouteBtn.addEventListener("click", () => {
        saveDraft();
      });
    }

    if (cancelEditBtn) {
      cancelEditBtn.addEventListener("click", () => {
        if (isDraftDirty()) {
          const confirmed = window.confirm(
            "Discard unsaved changes to this route?"
          );
          if (!confirmed) return;
        }
        exitEditMode({ revert: true });
      });
    }

    const form = document.getElementById("address-form");
    addressInputEl = document.getElementById("address-input");

    if (form && addressInputEl) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = addressInputEl.value.trim();
        if (!value) {
          setResults("Please enter an address to search.");
          addressInputEl.focus();
          return;
        }
        setResults("Searching for the closest route...");
        handleGeocode(value);
      });
    }
  }

  function cacheElements() {
    routeListEl = document.getElementById("route-list");
    resultsPanelEl = document.getElementById("results-panel");
    routeSummaryEl = document.getElementById("route-summary");
  }

  function initializeApp() {
    if (initialized) return;
    if (!ensureDependencies()) {
      setTimeout(initializeApp, 100);
      return;
    }

    routes = loadRoutes();

    cacheElements();
    initMap();
    buildRouteResources();
    buildRouteList();
    attachEventHandlers();
    resetResults();
    showAllRoutes();
    initialized = true;
  }

  document.addEventListener("app:unlock", initializeApp);

  window.addEventListener("load", () => {
    if (sessionStorage.getItem("unlocked") === "1") {
      initializeApp();
    }
  });
})();
