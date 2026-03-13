# SnowCap Route Mapper

Static front-end route visualization for the SnowCap network. The site is modernized with a responsive layout, password gate, and interactive Google Map showing 13 predefined routes. Everything runs client-side, making it ideal for GitHub Pages hosting.

## Features

- Password lock screen with casual client-side protection using `sessionStorage` to remember successful unlocks for the session.
- Responsive split layout with sidebar controls, results panel, and Google Map view.
- Sidebar slots for organization and partner logos (replace SVG placeholders in `assets/`).
- Route list with color badges that match polylines on the map. Toggle between viewing all routes or focusing on a single selection.
- Address search powered by the Google Maps Geocoding service. The nearest route is highlighted with a dashed connector and distance summary using Turf.js geometry helpers.
- Optional light/dark theme toggle that swaps CSS variable values instantly on the client.

## Getting started

1. Replace `YOUR_API_KEY` in `index.html` with a valid Google Maps JavaScript API key. Make sure the Maps JavaScript API and Geocoding API are enabled for that key.
2. (Optional) Update the password in `js/config.js` by editing `PUBLIC_PASSWORD`.
3. Open `index.html` directly in a browser or deploy the project to GitHub Pages.

No build step or server is required. All dependencies load from public CDNs when the page runs.

## File structure

```
/
├─ index.html
├─ README.md
├─ assets/
│  ├─ logo-main.svg
│  ├─ logo-partner-1.svg
│  └─ logo-partner-2.svg
├─ css/
│  └─ styles.css
└─ js/
   ├─ app.js
   ├─ auth.js
   ├─ config.js
   ├─ routes.js
   └─ utils.js
```

## Development notes

- All scripts are loaded with `defer` so that HTML parsing is never blocked.
- The Google Map initializes only after the password gate unlocks, keeping the splash screen lightweight.
- Turf.js is used for closest-route calculations (`nearestPointOnLine` and `distance`).
- Styling uses CSS custom properties and a mobile-first layout. Update the palette or spacing scale in `css/styles.css` as needed.

## Customization checklist

- Swap SVG logos in `assets/` with brand assets and update anchor links in `index.html`.
- Edit `js/routes.js` to adjust coordinates, names, and colors for each route.
- Tune map defaults or add additional UI in `js/app.js`.

Happy mapping!
