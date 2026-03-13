(function () {
  const MAP_CENTER = { lat: 30.2672, lng: -97.7431 };
  const DEFAULT_ZOOM = 11;
  const THEME_KEY = "scrm-theme";

  let initialized = false;
  let map;
  let geocoder;
  let allBounds;
  let marker = null;
  let connectorLine = null;
  let mode = "all";
  let selectedRouteId = null;

  const routePolylines = new Map();
  const routeBounds = new Map();
  const routeButtons = new Map();
  const routeLineStrings = new Map();

  let routeListEl;
  let resultsPanelEl;
  let resultsTextEl;
  let addressInputEl;
  let themeToggleEl;

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

  function buildRouteResources() {
    allBounds = new google.maps.LatLngBounds();

    ROUTES.forEach((route) => {
      const latLngs = Utils.toLatLngs(route.coordinates);
      const polyline = new google.maps.Polyline({
        map,
        path: latLngs,
        strokeColor: route.color,
        strokeOpacity: 0.9,
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

  function buildRouteList() {
    if (!routeListEl) return;
    routeListEl.innerHTML = "";
    routeButtons.clear();

    ROUTES.forEach((route) => {
      const button = Utils.createEl("button", {
        className: "route-item",
        attrs: {
          type: "button",
          "data-route-id": route.id,
          "aria-pressed": "false",
        },
      });

      const label = Utils.createEl("div", { className: "route-item__label" });
      const swatch = Utils.createEl("span", {
        className: "route-item__swatch",
      });
      swatch.style.background = route.color;
      const name = Utils.createEl("span", {
        className: "route-item__name",
        text: route.name,
      });
      label.appendChild(swatch);
      label.appendChild(name);

      const hint = Utils.createEl("span", {
        className: "route-item__hint",
        text: "View",
      });
      hint.style.fontSize = "0.8rem";
      hint.style.color = "var(--muted)";

      button.appendChild(label);
      button.appendChild(hint);

      button.addEventListener("click", () => {
        if (mode === "single" && selectedRouteId === route.id) {
          showAllRoutes();
        } else {
          showSingleRoute(route.id);
        }
      });

      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          button.click();
        }
      });

      routeButtons.set(route.id, button);
      routeListEl.appendChild(button);
    });
  }

  function updateRouteSelection(routeId) {
    routeButtons.forEach((button, id) => {
      const isSelected = id === routeId;
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      button.classList.toggle("is-selected", isSelected);
    });
  }

  function showAllRoutes() {
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
      polyline.setVisible(isSelected);
      polyline.setOptions({
        strokeWeight: isSelected ? 6 : 4,
        zIndex: isSelected ? 3 : 1,
      });
    });
    updateRouteSelection(routeId);

    const bounds = routeBounds.get(routeId);
    if (bounds && !bounds.isEmpty()) {
      map.fitBounds(bounds, 50);
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
      resultsTextEl = message;
      return;
    }

    if (content && typeof content === "object") {
      const { address, routeName, miles } = content;
      const message = Utils.createEl("p", { className: "result-text" });
      const strong = Utils.createEl("strong", { text: routeName });
      message.appendChild(strong);
      message.appendChild(document.createTextNode(` is ${miles} miles away.`));
      resultsPanelEl.appendChild(message);
      resultsTextEl = message;

      if (address) {
        const meta = Utils.createEl("p", {
          className: "result-meta",
        });
        meta.textContent = `Address: ${address}`;
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
    showAllRoutes();
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

      ROUTES.forEach((route) => {
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

      if (mode !== "single" || selectedRouteId !== closest.route.id) {
        showSingleRoute(closest.route.id);
      }

      Utils.scrollToRoute(closest.route.id);
    });
  }

  function attachEventHandlers() {
    const showAllBtn = document.getElementById("show-all");
    if (showAllBtn) {
      showAllBtn.addEventListener("click", () => {
        showAllRoutes();
        resetResults();
      });
    }

    const clearBtn = document.getElementById("clear-address");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        clearAddress();
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

    themeToggleEl = document.getElementById("theme-toggle");
    if (themeToggleEl) {
      const storedTheme = localStorage.getItem(THEME_KEY);
      if (storedTheme === "dark") {
        applyTheme("dark");
      } else {
        applyTheme("light");
      }

      themeToggleEl.addEventListener("click", () => {
        const current = document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        localStorage.setItem(THEME_KEY, next);
      });
    }
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      document.body.setAttribute("data-theme", "dark");
      if (themeToggleEl) {
        themeToggleEl.setAttribute("aria-pressed", "true");
        themeToggleEl.textContent = "Light theme";
      }
    } else {
      document.body.removeAttribute("data-theme");
      if (themeToggleEl) {
        themeToggleEl.setAttribute("aria-pressed", "false");
        themeToggleEl.textContent = "Dark theme";
      }
    }
  }

  function cacheElements() {
    routeListEl = document.getElementById("route-list");
    resultsPanelEl = document.getElementById("results-panel");
    if (resultsPanelEl) {
      resultsTextEl = resultsPanelEl.querySelector(".result-text");
    }
  }

  function initializeApp() {
    if (initialized) return;
    if (!ensureDependencies()) {
      setTimeout(initializeApp, 100);
      return;
    }

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
