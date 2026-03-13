const Utils = (() => {
  function toLatLngs(pairs) {
    if (!Array.isArray(pairs)) return [];
    return pairs.map(([lat, lng]) => new google.maps.LatLng(lat, lng));
  }

  function toLineString(coords) {
    if (!Array.isArray(coords)) return turf.lineString([]);
    const turfCoords = coords.map(([lat, lng]) => [lng, lat]);
    return turf.lineString(turfCoords);
  }

  function toMiles(kilometers) {
    const miles = Number(kilometers) * 0.621371;
    return miles.toFixed(2);
  }

  function createEl(tag, options = {}) {
    const element = document.createElement(tag);
    const { className, text, html, attrs = {} } = options;

    if (className) {
      element.className = className;
    }

    if (typeof text === "string") {
      element.textContent = text;
    }

    if (typeof html === "string") {
      element.innerHTML = html;
    }

    Object.entries(attrs).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      element.setAttribute(key, value);
    });

    return element;
  }

  function scrollToRoute(routeId) {
    if (!routeId) return;
    const routeItem = document.querySelector(`[data-route-id="${routeId}"]`);
    if (!routeItem) return;

    routeItem.scrollIntoView({ block: "center", behavior: "smooth" });
    routeItem.classList.add("highlight-pulse");
    setTimeout(() => {
      routeItem.classList.remove("highlight-pulse");
    }, 1200);
  }

  return {
    toLatLngs,
    toLineString,
    toMiles,
    createEl,
    scrollToRoute,
  };
})();

window.Utils = Utils;
