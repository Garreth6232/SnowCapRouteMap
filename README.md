# SnowCap Route Map

A lightweight Google Maps demo that visualizes 13 example routes around Austin, TX. Enter an address to locate the closest route using straight-line distance powered by Turf.js.

## Quick start

1. Open `index.html` and replace `YOUR_API_KEY` in the Google Maps script tag with your API key.
2. Ensure the API key has the following APIs enabled:
   - Maps JavaScript API
   - Geocoding API
3. Save the file and open `index.html` directly in a browser, or commit the project to a GitHub repository and enable GitHub Pages.

> **Tip:** GitHub Pages can host the site directly from the `main` branch or the `/docs` folder. No build tools are required.

## Using the app

- The sidebar lists every route with a matching color swatch. Select **Show all routes** to view the full network, or click a route to focus on it.
- Enter an address and click **Find closest route** to geocode the location. The app drops a marker, highlights the closest route, draws a dashed connector to the closest point on that route, and displays the name and distance in miles.
- Use **Clear address** to remove the marker and connector without changing the current route visibility.

All distance calculations are straight-line measurements (“as the crow flies”) computed with Turf.js.

## Replacing the demo routes

Edit `routes.js` and replace the `coordinates` arrays with your own data. Each route object must include:

```js
{
  id: "Route 01",
  name: "Route 01",
  color: "#e6194b",
  coordinates: [
    [30.2685, -97.7422],
    [30.2704, -97.7365],
    [30.2723, -97.7298]
  ]
}
```

- Keep coordinates as `[latitude, longitude]` pairs.
- Provide at least three points per route so the line renders cleanly.
- Use unique colors so the sidebar swatches and map polylines remain distinct.

## Notes on Google usage

- Google APIs are billed based on usage. Review your quota in the Google Cloud Console and set budget alerts if needed.
- Geocoding responses are cached only in memory; refreshing the page resets the state.
- When hosting publicly, restrict your API key to trusted domains and HTTPS.

## Tech stack

- Vanilla HTML, CSS, and JavaScript
- Google Maps JavaScript API
- Google Geocoding API
- Turf.js for spatial calculations
