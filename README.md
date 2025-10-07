# SnowCap Route Mapper

A modernized, client-side route visualization for the SnowCap delivery network. The application runs entirely in the browser (ideal for GitHub Pages) and ships with thirteen pre-geocoded routes so the map renders instantly.

## Features

- Password lock screen with branded messaging. Successful unlocks are cached with `sessionStorage` for the current tab.
- Responsive two-pane layout with dedicated areas for partner logos, route controls, and Google Maps.
- Sidebar route directory featuring color swatches that match on-map polylines, plus real-time totals for routes and stops.
- “Show All Routes” and single-route focus modes with smooth camera fitting.
- Address search powered by the Google Maps Geocoding service. Turf.js calculates the nearest route and draws a dashed connector with distance in miles.
- Edit Route Mode: drag-and-drop existing stops, click the map to append new stops (with optional labels), remove stops by clicking markers, then save to `localStorage` or cancel to revert.
- Persistent storage of route edits using `localStorage` under the `savedRoutes` key.

## Getting started

1. Replace `YOUR_API_KEY` in `index.html` with a valid Google Maps JavaScript API key that has the Maps JavaScript API enabled.
2. Add your production logo to `assets/` named `snowcapmain.png` so the UI branding renders correctly.
3. (Optional) Update the password in `js/config.js` by changing `PUBLIC_PASSWORD`.
4. Open `index.html` locally in a browser or deploy the project as-is to GitHub Pages.

All dependencies load from public CDNs, and no build tooling or server is required.

## File structure

```
/
├─ index.html
├─ README.md
├─ assets/
│  └─ snowcapmain.png (add your production logo file here)
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

- Routes are preloaded from `js/routes.js`, and any edits are merged from `localStorage` on startup.
- Google Maps objects initialize only after the password gate dispatches the `app:unlock` event.
- `Utils` centralizes helpers for converting coordinate arrays, building DOM nodes, and animating route list focus.
- Styling relies on CSS custom properties and mobile-first layout rules in `css/styles.css`.

Happy mapping!
