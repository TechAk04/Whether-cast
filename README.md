# Real-Time Weather Dashboard

A production-ready, accessible, and responsive real-time weather dashboard built from scratch with **semantic HTML5**, **pure CSS3**, and **vanilla JavaScript (ES6+)**. This application consumes the keyless, public [Open-Meteo REST APIs](https://open-meteo.com/) to provide live weather metrics across the globe without external frameworks, libraries, or build steps.

---

## 📖 Project Overview

The **Real-Time Weather Dashboard** delivers live meteorological data with an emphasis on performance, web accessibility (a11y), clean code design, and user experience. Users can search for any city worldwide or retrieve weather for their current GPS location with one click.

The application adheres strictly to standard web platform APIs:
- Zero JavaScript frameworks (No React, Vue, Angular, or Svelte).
- Zero CSS frameworks (No Tailwind CSS or Bootstrap).
- Zero build tools or bundlers (No Vite, Webpack, or npm dependencies).
- Zero embedded secrets or API keys (100% keyless, public REST APIs).

---

## 🌟 Main Features

### 1. City Search & Disambiguation
- **Instant City Search**: Search for any city worldwide by pressing `Enter` or clicking **"Search City"**.
- **Location Disambiguation**: When a query matches multiple locations (e.g. *London, UK* vs *London, Canada*), the dashboard presents an interactive selection list showing city, administrative region, and country.
- **Fast Input Reset**: A convenient clear (`×`) button inside the search field allows users to reset their search query with a single tap.

### 2. On-Demand "Current Location" Weather
- **Zero Background Tracking**: Geolocation permissions are requested **strictly on demand** when the user clicks the *"Current Location"* button.
- **Reverse Geocoding with Fallback**: Automatically resolves coordinates to human-readable city and country names via client-side reverse geocoding. If reverse geocoding is blocked or unavailable, the dashboard seamlessly displays the exact GPS coordinates without interrupting the weather retrieval.

### 3. Timezone-Accurate Live Wall Clock
- **Destination Local Time**: Utilizes the IANA timezone provided by the weather API (`data.timezone`, e.g. `Asia/Tokyo`, `Europe/London`) rather than defaulting to the visitor's local computer clock.
- **Live 1-Second Ticking Clock**: A real-time timer updates the city's seconds and minutes live using `Intl.DateTimeFormat`.
- **Observation vs. Sync Timestamp**: Explicitly distinguishes between the meteorological station's observation timestamp and the application's last sync time.

### 4. 6 Dedicated Weather Metrics Cards (CSS Grid)
1. **Ambient Temperature**: Live dry-bulb reading formatted in Celsius (`°C`).
2. **Apparent ("Feels Like") Temperature**: Wind-chill and humidity-adjusted apparent temperature (`°C`).
3. **Relative Humidity**: Air moisture percentage (`%`).
4. **Wind Speed**: Surface wind velocity in kilometers per hour (`km/h`).
5. **Wind Direction**: Exact compass bearing in degrees plus 16-point cardinal direction (e.g., `230° SW`).
6. **Atmospheric Surface Pressure**: Barometric reading in hectopascals (`hPa`).

### 5. Resilient Asynchronous Management & Error Handling
- **Network Timeout & Cancellation**: Network calls exceeding 10 seconds are aborted via `AbortController`.
- **Race Condition Prevention**: Employs an incrementing Request ID (`latestRequestId`) ensuring that slower or out-of-order network responses never overwrite newer search results.
- **Fail-Safe UI Restoration**: `try/catch/finally` blocks ensure loading spinners are dismissed and buttons are re-enabled under all circumstances.
- **State Preservation**: If a new search fails, previously loaded weather remains visible while an error banner appears with an interactive **"Retry"** option.
- **Data Quality Guarantee**: Missing or null fields never render as accidental `0` or `0°C`; they strictly display placeholder indicators (`--`).

---

## 🛠️ Technologies Used

- **HTML5**: Semantic elements (`<header>`, `<main>`, `<section>`, `<article>`, `<form>`, `<footer>`), ARIA live regions, visually hidden labels.
- **CSS3**: CSS Custom Properties (`:root`), Flexbox, CSS Grid, glassmorphism (`backdrop-filter`), keyframe animations, `@media (prefers-reduced-motion: reduce)`, mobile-first media queries.
- **Vanilla JavaScript (ES6+)**: Strict mode (`'use strict'`), Fetch API, `async/await`, Promises, DOM APIs, `Intl.DateTimeFormat`, Geolocation API, `AbortController`.
- **REST APIs**: Public keyless JSON endpoints.

---

## 🌐 API Information & Official Documentation

1. **Open-Meteo Geocoding API**:
   - **Documentation**: [https://open-meteo.com/en/docs/geocoding-api](https://open-meteo.com/en/docs/geocoding-api)
   - **Endpoint**: `https://geocoding-api.open-meteo.com/v1/search?name={city}&count=5&language=en&format=json`
   - **Purpose**: Converts city search strings into exact latitude, longitude, and administrative metadata.
2. **Open-Meteo Weather Forecast API**:
   - **Documentation**: [https://open-meteo.com/en/docs](https://open-meteo.com/en/docs)
   - **Endpoint**: `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=auto`
   - **Purpose**: Provides real-time weather metrics, WMO condition codes, and location timezones.
3. **BigDataCloud Client-Side Reverse Geocoding API**:
   - **Documentation**: [https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api)
   - **Endpoint**: `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude={lat}&longitude={lon}&localityLanguage=en`
   - **Purpose**: Keyless client reverse geocoding to identify city/country names from browser GPS coordinates.

---

## 📁 Project Folder Structure

```text
Weather-Cast/
├── index.html     # Semantic HTML5 markup, ARIA live regions, and DOM hooks
├── style.css      # Pure CSS3 stylesheet, dark navy & blue-purple theme tokens
├── script.js      # Application logic, async API services, live ticking clock
├── README.md      # Comprehensive project documentation and execution guide
└── TESTING.md     # Audit report, test execution matrix, and verification steps
```

---

## 💻 Running the Project Locally

Because this project uses vanilla web standards, it does not require `npm install`, compilers, or complex build setups.

### Prerequisites
- A modern web browser: **Google Chrome**, **Microsoft Edge**, **Mozilla Firefox**, or **Apple Safari**.
- An active **internet connection** to reach the Open-Meteo public REST APIs.

### Option 1: VS Code Live Server (Recommended)
1. Launch **Visual Studio Code**.
2. Go to **File &rarr; Open Folder...** and select the project directory:
   ```text
   d:\project 2\Weather-Cast
   ```
3. If not already installed, install the **Live Server** extension by *Ritwick Dey* from the VS Code Extensions Marketplace (`Ctrl+Shift+X`).
4. In the Explorer pane, right-click [`index.html`](file:///d:/project%202/Weather-Cast/index.html) and choose **"Open with Live Server"**.
5. Your browser will automatically open:
   ```text
   http://127.0.0.1:5500
   ```

> [!IMPORTANT]
> Modern web browsers restrict device Geolocation to secure origins (**`https://`** or **`http://localhost` / `http://127.0.0.1`**). Running through Live Server allows full testing of the "Current Location" button.

### Option 2: Direct Browser Opening
1. Open Windows File Explorer and navigate to `d:\project 2\Weather-Cast`.
2. Double-click [`index.html`](file:///d:/project%202/Weather-Cast/index.html).
3. The dashboard will open in your default browser. City search will work fully; note that some browsers may restrict GPS permissions on the `file:///` protocol.

---

## 🧪 Testing the Application

1. **City Search Testing**:
   - Enter `Tokyo` and press `Enter` or click **"Search City"**. Verify that the temperature, condition, and live local wall clock (`JST`) display.
   - Enter `London` and click Search. Notice that the location selector allows switching between *London, UK* and *London, Canada*.
   - Enter a city name with spaces (e.g. `New York` or `San Francisco`).
2. **Current Location Testing**:
   - Click **"Current Location"**.
   - Approve the browser location prompt. Verify that your local area and live weather display.
3. **Validation & Error Handling**:
   - Submit an empty search input &rarr; verify the immediate validation prompt.
   - Search for a nonexistent city (e.g. `asdfghjklqwerty`) &rarr; verify the friendly error message and **"Retry"** button.
   - Rapidly search two cities in a row &rarr; verify that the older search is cancelled via `AbortController` and cannot overwrite the newer result.

For the full test execution matrix and verification details, view [`TESTING.md`](file:///d:/project%202/Weather-Cast/TESTING.md).

---

## 📚 Technical Concepts Explained

### 1. Fetch API & `async/await`
The application makes asynchronous HTTP requests using the native browser `fetch()` API combined with ES6+ `async/await` syntax. This provides readable, synchronous-looking code while executing asynchronously on the browser's event loop without blocking the user interface:
```javascript
async function getWeather(latitude, longitude, signal) {
  const endpoint = `${API_CONFIG.FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&...`;
  const response = await fetch(endpoint, { signal });
  
  if (!response.ok) {
    throwHttpError(response.status, 'Weather Forecast service');
  }

  const data = await response.json();
  return data;
}
```

### 2. HTTP Verification with `response.ok`
`fetch()` does not reject its Promise on HTTP error responses like `404 Not Found` or `500 Server Error`. It only rejects on network disconnection or DNS failure. By checking `response.ok` (which returns `true` only for HTTP statuses `200–299`), our code catches server-side and rate-limiting errors immediately before attempting to parse JSON.

### 3. Request Cancellation with `AbortController`
Every request is equipped with an `AbortController`. If a request exceeds 10,000ms, `controller.abort('timeout')` fires, cancelling the in-flight network request and freeing browser resources. If a user enters a new city while an earlier lookup is in progress, the previous controller is aborted with `'superseded'`, preventing wasted bandwidth and out-of-order race conditions.

### 4. Deterministic Cleanup with `try / catch / finally`
All search logic is wrapped in `try / catch / finally`:
- `try`: Handles geocoding, forecast retrieval, and DOM updates.
- `catch`: Translates technical errors into helpful user messages with a Retry action.
- `finally`: Always executes, ensuring that `setBusyState(false)` re-enables all buttons, clears input locks, and dismisses the loading spinner.

---

## ⚠️ Known Limitations

1. **Public API Rate Limits**: Open-Meteo's free tier allows up to 10,000 daily API calls per IP address. In heavy enterprise or continuous automated polling environments, an API key or dedicated cache layer is recommended.
2. **Reverse Geocoding Firewalls**: Client-side reverse geocoding relies on public client endpoints. If a user operates behind an aggressive corporate firewall or ad-blocker that restricts third-party reverse geocoding, the dashboard automatically and gracefully falls back to displaying exact latitude and longitude coordinates.
3. **Browser Geolocation Policy**: Device GPS access strictly requires an `https://` or `http://localhost` origin per browser security standards.
