/**
 * ============================================================================
 * Real-Time Weather Dashboard - Application Logic
 * Pure Vanilla JavaScript (ES6+)
 * 
 * Step 5: Current-Location Weather & Real-Time Dashboard Presentation
 * 
 * Features:
 * - On-demand browser Geolocation API with reverse geocoding fallback
 * - Live ticking local clock formatted with Intl.DateTimeFormat in city's timezone
 * - Explicit distinction between Provider Observation Time and Live Wall Clock
 * - Fast Search Input Reset (Clear Button) with dynamic input visibility
 * - Safe numeric validations: never displaying missing or null values as zero
 * - Resilient AbortController timeout & race condition handling
 * - Single-registration event listeners and cleanup
 * ============================================================================
 */

'use strict';

/* ==========================================================================
   1. DOM Element Registry
   ========================================================================== */
const DOM = {
  // Search & Geolocation Form Elements
  searchForm: document.getElementById('search-form'),
  cityInput: document.getElementById('city-input'),
  clearInputBtn: document.getElementById('clear-input-btn'),
  searchBtn: document.getElementById('search-btn'),
  locationBtn: document.getElementById('location-btn'),

  // Location Disambiguation List (Multiple Match Selection)
  locationSelectList: document.getElementById('location-select-list'),
  locationOptions: document.getElementById('location-options'),
  closeSelectBtn: document.getElementById('close-select-btn'),

  // Feedback & Status Indicators
  loadingIndicator: document.getElementById('loading-indicator'),
  loadingTitle: document.getElementById('loading-title'),
  loadingSubtitle: document.getElementById('loading-subtitle'),
  errorMessage: document.getElementById('error-message'),
  errorText: document.getElementById('error-text'),
  retryBtn: document.getElementById('retry-btn'),

  // Prominent Current Weather Section Elements
  weatherDisplay: document.getElementById('weather-display'),
  locationName: document.getElementById('location-name'),
  weatherDate: document.getElementById('weather-date'),
  weatherObsTime: document.getElementById('weather-obs-time'),
  lastUpdatedTime: document.getElementById('last-updated-time'),
  weatherBadge: document.getElementById('weather-badge'),
  weatherIconContainer: document.getElementById('weather-icon-container'),
  weatherIcon: document.getElementById('weather-icon'),
  currentTemp: document.getElementById('current-temp'),
  weatherCondition: document.getElementById('weather-condition'),

  // 6 Dedicated Weather Metrics Cards
  tempDetailValue: document.getElementById('temp-detail-value'),
  feelsLike: document.getElementById('feels-like'),
  humidityValue: document.getElementById('humidity-value'),
  windSpeedValue: document.getElementById('wind-speed-value'),
  windDirectionValue: document.getElementById('wind-direction-value'),
  pressureValue: document.getElementById('pressure-value'),
};

/* ==========================================================================
   2. API Endpoints Configuration & State Variables
   ========================================================================== */
const API_CONFIG = {
  GEOCODING_URL: 'https://geocoding-api.open-meteo.com/v1/search',
  FORECAST_URL: 'https://api.open-meteo.com/v1/forecast',
  REVERSE_GEO_URL: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
  MAX_GEO_RESULTS: 5,
  REQUEST_TIMEOUT_MS: 10000, // 10-second request timeout limit
};

// Asynchronous Request Management & UX State
let activeAbortController = null;
let latestRequestId = 0;
let lastFailedAction = null;
let hasSuccessfulWeatherLoaded = false;
let currentLocationCandidates = [];
let activeLocalClockInterval = null;

/* ==========================================================================
   3. UI State Management Utilities
   ========================================================================== */

/**
 * Update UI busy state: toggles loading indicator, ARIA attributes,
 * and enables/disables search controls to prevent double submissions.
 * @param {boolean} isBusy - Whether an async request is currently active
 * @param {string} title - Primary loading message
 * @param {string} subtitle - Detailed status note
 */
function setBusyState(isBusy, title = 'Fetching real-time weather', subtitle = 'Connecting to Open-Meteo REST API...') {
  if (DOM.loadingTitle) DOM.loadingTitle.textContent = title;
  if (DOM.loadingSubtitle) DOM.loadingSubtitle.textContent = subtitle;

  if (isBusy) {
    DOM.loadingIndicator.classList.remove('hidden');
    DOM.searchForm.setAttribute('aria-busy', 'true');
    DOM.searchBtn.disabled = true;
    DOM.locationBtn.disabled = true;
    DOM.cityInput.disabled = true;
    if (DOM.clearInputBtn) DOM.clearInputBtn.disabled = true;
  } else {
    DOM.loadingIndicator.classList.add('hidden');
    DOM.searchForm.removeAttribute('aria-busy');
    DOM.searchBtn.disabled = false;
    DOM.locationBtn.disabled = false;
    DOM.cityInput.disabled = false;
    if (DOM.clearInputBtn) DOM.clearInputBtn.disabled = false;
  }
}

/**
 * Display an accessible error message banner with an optional Retry action.
 * @param {string} message - Descriptive error text to display
 * @param {Function|null} retryCallback - Function to execute if user clicks Retry
 */
function showError(message, retryCallback = null) {
  DOM.errorText.textContent = message || 'An unexpected error occurred. Please try again.';
  DOM.errorMessage.classList.remove('hidden');

  if (typeof retryCallback === 'function') {
    lastFailedAction = retryCallback;
    DOM.retryBtn.classList.remove('hidden');
  } else {
    lastFailedAction = null;
    DOM.retryBtn.classList.add('hidden');
  }
}

/**
 * Hide the error message banner and clear any stored retry action.
 */
function hideError() {
  DOM.errorMessage.classList.add('hidden');
  DOM.errorText.textContent = '';
  DOM.retryBtn.classList.add('hidden');
  lastFailedAction = null;
}

/**
 * Hide the location choices list and clear candidate memory.
 */
function hideLocationOptions() {
  if (DOM.locationSelectList) {
    DOM.locationSelectList.classList.add('hidden');
    DOM.locationOptions.textContent = '';
    currentLocationCandidates = [];
  }
}

/**
 * Toggle visibility of the search input clear button.
 */
function updateClearButtonVisibility() {
  if (!DOM.clearInputBtn || !DOM.cityInput) return;
  if (DOM.cityInput.value.trim().length > 0) {
    DOM.clearInputBtn.classList.remove('hidden');
  } else {
    DOM.clearInputBtn.classList.add('hidden');
  }
}

/* ==========================================================================
   4. Weather Code (WMO) & Value Formatting Helpers
   ========================================================================== */

/**
 * Map WMO weather interpretation codes to human-readable summaries and icons.
 * Day/Night aware for clear and partly cloudy conditions.
 * @param {number} weatherCode - WMO weather code (0-99)
 * @param {number} isDay - 1 for daytime, 0 for nighttime
 * @returns {{ description: string, icon: string }}
 */
function getWeatherDescription(weatherCode, isDay = 1) {
  const code = Number(weatherCode);
  const isNight = isDay === 0;

  switch (code) {
    case 0:
      return {
        description: isNight ? 'Clear Night' : 'Clear Sky',
        icon: isNight ? '🌙' : '☀️'
      };
    case 1:
      return {
        description: isNight ? 'Mainly Clear' : 'Mainly Sunny',
        icon: isNight ? '🌤️' : '🌤️'
      };
    case 2:
      return {
        description: 'Partly Cloudy',
        icon: '⛅'
      };
    case 3:
      return {
        description: 'Overcast',
        icon: '☁️'
      };
    case 45:
      return {
        description: 'Foggy',
        icon: '🌫️'
      };
    case 48:
      return {
        description: 'Depositing Rime Fog',
        icon: '🌫️'
      };
    case 51:
      return {
        description: 'Light Drizzle',
        icon: '🌦️'
      };
    case 53:
      return {
        description: 'Moderate Drizzle',
        icon: '🌦️'
      };
    case 55:
      return {
        description: 'Dense Drizzle',
        icon: '🌧️'
      };
    case 56:
      return {
        description: 'Light Freezing Drizzle',
        icon: '🌧️'
      };
    case 57:
      return {
        description: 'Dense Freezing Drizzle',
        icon: '🌧️'
      };
    case 61:
      return {
        description: 'Slight Rain',
        icon: '🌧️'
      };
    case 63:
      return {
        description: 'Moderate Rain',
        icon: '🌧️'
      };
    case 65:
      return {
        description: 'Heavy Rain',
        icon: '🌧️'
      };
    case 66:
      return {
        description: 'Light Freezing Rain',
        icon: '🌧️'
      };
    case 67:
      return {
        description: 'Heavy Freezing Rain',
        icon: '🌧️'
      };
    case 71:
      return {
        description: 'Slight Snow Fall',
        icon: '🌨️'
      };
    case 73:
      return {
        description: 'Moderate Snow Fall',
        icon: '❄️'
      };
    case 75:
      return {
        description: 'Heavy Snow Fall',
        icon: '❄️'
      };
    case 77:
      return {
        description: 'Snow Grains',
        icon: '❄️'
      };
    case 80:
      return {
        description: 'Slight Rain Showers',
        icon: isNight ? '🌧️' : '🌦️'
      };
    case 81:
      return {
        description: 'Moderate Rain Showers',
        icon: '🌧️'
      };
    case 82:
      return {
        description: 'Violent Rain Showers',
        icon: '⛈️'
      };
    case 85:
      return {
        description: 'Slight Snow Showers',
        icon: '🌨️'
      };
    case 86:
      return {
        description: 'Heavy Snow Showers',
        icon: '❄️'
      };
    case 95:
      return {
        description: 'Thunderstorm',
        icon: '⛈️'
      };
    case 96:
      return {
        description: 'Thunderstorm with Slight Hail',
        icon: '⛈️'
      };
    case 99:
      return {
        description: 'Thunderstorm with Heavy Hail',
        icon: '⛈️'
      };
    default:
      return {
        description: 'Clear Weather',
        icon: isNight ? '🌙' : '🌤️'
      };
  }
}

/**
 * Convert numerical wind direction degrees into 16-point compass cardinal text.
 * Never defaults missing numbers to 0.
 * @param {number} degrees - Wind direction in degrees (0-360)
 * @returns {string} - e.g. "230° SW"
 */
function getWindDirectionCardinal(degrees) {
  if (typeof degrees !== 'number' || isNaN(degrees)) {
    return '--';
  }
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((degrees % 360) / 22.5) % 16;
  return `${Math.round(degrees)}° ${directions[index]}`;
}

/**
 * Format provider observation timestamp (not to be confused with visitor wall clock).
 * @param {string} isoString - ISO datetime string from Open-Meteo
 * @param {string} timezone - IANA timezone string
 * @returns {string}
 */
function formatObservationTime(isoString, timezone) {
  if (!isoString) return 'Not available';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString.replace('T', ' ');

    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || undefined
    }).format(date);
  } catch (e) {
    return isoString.replace('T', ' ');
  }
}

/**
 * Start a live ticking clock representing the target city's actual local wall clock.
 * Formatted with Intl.DateTimeFormat in the provider's reported timezone.
 * @param {string} timezone - IANA timezone identifier (e.g. "Asia/Tokyo")
 */
function startLocalClock(timezone) {
  // Clear any previously running clock timer
  if (activeLocalClockInterval) {
    clearInterval(activeLocalClockInterval);
    activeLocalClockInterval = null;
  }

  function tick() {
    const now = new Date();
    try {
      const formatted = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: timezone,
        timeZoneName: 'short'
      }).format(now);

      DOM.weatherDate.textContent = `Local Time: ${formatted}`;
    } catch (error) {
      // Graceful fallback if IANA timezone string is unsupported by browser
      DOM.weatherDate.textContent = `Local Time: ${now.toLocaleTimeString()} (${timezone || 'Auto'})`;
    }
  }

  // Initial immediate tick and 1-second interval
  tick();
  activeLocalClockInterval = setInterval(tick, 1000);
}

/**
 * Build a clean location string from city name, region, and country.
 * @param {Object} location - Location object from Geocoding or Reverse Geocoding
 * @returns {string} - e.g. "London, England, United Kingdom"
 */
function formatLocationName(location) {
  if (!location) return 'Unknown Location';

  const parts = [];
  if (location.name) parts.push(location.name);

  // Avoid duplicating if administrative region matches city name
  if (location.admin1 && location.admin1.toLowerCase() !== (location.name || '').toLowerCase()) {
    parts.push(location.admin1);
  }

  if (location.country) {
    parts.push(location.country);
  }

  return parts.length > 0 ? parts.join(', ') : 'Selected Location';
}

/* ==========================================================================
   5. Error Classification & Translation
   ========================================================================== */

/**
 * Translate technical errors into informative, beginner-friendly explanations.
 * @param {Error} error - Captured exception
 * @param {string|null} abortReason - Controller abort reason ('timeout' | 'superseded')
 * @returns {string}
 */
function getFriendlyErrorMessage(error, abortReason) {
  if (abortReason === 'timeout' || error.name === 'TimeoutError') {
    return 'The request timed out while connecting to the weather service. Please check your internet connection and try again.';
  }

  if (error.name === 'AbortError') {
    return 'The weather request was cancelled.';
  }

  if (!navigator.onLine) {
    return 'You appear to be offline. Please verify your internet connection and try again.';
  }

  // Network connection failures (DNS failure, CORS/ad-blocker, severed connection)
  if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
    return 'Unable to establish a connection to Open-Meteo servers. Please verify your internet connection or check if a browser extension is blocking network requests.';
  }

  return error.message || 'An unexpected error occurred while fetching weather data. Please try again.';
}

/**
 * Handle HTTP error status codes with tailored user feedback.
 * @param {number} status - HTTP status code
 * @param {string} serviceName - Human readable service identifier
 */
function throwHttpError(status, serviceName) {
  switch (status) {
    case 400:
      throw new Error(`The ${serviceName} received an invalid request format.`);
    case 404:
      throw new Error(`The requested location or weather metrics could not be found.`);
    case 429:
      throw new Error(`Rate limit exceeded for the Open-Meteo service. Please wait a moment and try again.`);
    case 500:
    case 502:
    case 503:
    case 504:
      throw new Error(`The ${serviceName} is temporarily undergoing maintenance or unavailable. Please try again shortly.`);
    default:
      throw new Error(`${serviceName} responded with HTTP status ${status}. Please try again later.`);
  }
}

/* ==========================================================================
   6. Open-Meteo & Reverse Geocoding Services
   ========================================================================== */

/**
 * Request geographic coordinates and metadata for a city query.
 * @param {string} city - Name of city entered by user
 * @param {AbortSignal} signal - Signal from active AbortController
 * @returns {Promise<Array<Object>>} - Array of matching location objects
 */
async function getCoordinates(city, signal) {
  const query = city ? city.trim() : '';

  if (!query) {
    throw new Error('Please enter a city name before searching.');
  }

  if (query.length < 2) {
    throw new Error('Please enter at least 2 characters for a city search.');
  }

  const endpoint = `${API_CONFIG.GEOCODING_URL}?name=${encodeURIComponent(query)}&count=${API_CONFIG.MAX_GEO_RESULTS}&language=en&format=json`;

  let response;
  try {
    response = await fetch(endpoint, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new TypeError(err.message);
  }

  if (!response.ok) {
    throwHttpError(response.status, 'Geocoding service');
  }

  let data;
  try {
    data = await response.json();
  } catch (jsonErr) {
    throw new Error('Received an unreadable or malformed response from the geocoding service.');
  }

  return Array.isArray(data.results) ? data.results : [];
}

/**
 * Attempt to reverse geocode geographic coordinates to a human-readable city/region name.
 * Uses public keyless client reverse geocoding with graceful fallback on failure.
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {AbortSignal} signal 
 * @returns {Promise<Object>}
 */
async function reverseGeocode(latitude, longitude, signal) {
  const defaultFallback = {
    name: 'Your GPS Location',
    admin1: `Lat: ${latitude.toFixed(2)}°`,
    country: `Lon: ${longitude.toFixed(2)}°`
  };

  try {
    const endpoint = `${API_CONFIG.REVERSE_GEO_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const response = await fetch(endpoint, { signal });

    if (!response.ok) {
      return defaultFallback;
    }

    const data = await response.json();
    const resolvedCity = data.city || data.locality || data.principalSubdivision;

    if (!resolvedCity && !data.countryName) {
      return defaultFallback;
    }

    return {
      name: resolvedCity || 'Current Location',
      admin1: data.principalSubdivision || '',
      country: data.countryName || ''
    };
  } catch (err) {
    // Reverse geocoding failure is non-fatal; we seamlessly fall back to GPS coordinates
    console.warn('[Reverse Geocode Note]: Using coordinate fallback.', err.message);
    return defaultFallback;
  }
}

/**
 * Request real-time current weather metrics from the Open-Meteo Forecast API.
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {AbortSignal} signal - Signal from active AbortController
 * @returns {Promise<Object>} - Forecast JSON payload
 */
async function getWeather(latitude, longitude, signal) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
    throw new Error('Invalid coordinates provided for weather lookup.');
  }

  const queryParams = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'weather_code',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m'
    ].join(','),
    wind_speed_unit: 'kmh',
    timezone: 'auto'
  });

  const endpoint = `${API_CONFIG.FORECAST_URL}?${queryParams.toString()}`;

  let response;
  try {
    response = await fetch(endpoint, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new TypeError(err.message);
  }

  if (!response.ok) {
    throwHttpError(response.status, 'Weather Forecast service');
  }

  let data;
  try {
    data = await response.json();
  } catch (jsonErr) {
    throw new Error('Received an unreadable or malformed response from the weather forecast service.');
  }

  // Verify response integrity and existence of required variables
  if (!data || !data.current) {
    throw new Error('Weather data structure returned by the server was incomplete.');
  }

  const { temperature_2m, apparent_temperature, relative_humidity_2m, wind_speed_10m, weather_code, surface_pressure } = data.current;
  if (
    typeof temperature_2m !== 'number' ||
    typeof apparent_temperature !== 'number' ||
    typeof relative_humidity_2m !== 'number' ||
    typeof wind_speed_10m !== 'number' ||
    typeof weather_code !== 'number' ||
    typeof surface_pressure !== 'number'
  ) {
    throw new Error('Crucial weather measurements were missing from the server response.');
  }

  return data;
}

/* ==========================================================================
   7. DOM Rendering & State Preservation
   ========================================================================== */

/**
 * Safely render weather metrics to the DOM using textContent.
 * Replaces all prior values with authentic real-time API values.
 * Never defaults null or missing values to 0.
 * @param {Object} data - Forecast API response
 * @param {Object} location - Location metadata object
 */
function displayWeather(data, location) {
  const current = data.current;
  const isDay = current.is_day === 1;

  // 1. Location Header & Local Wall Clock
  const locationText = formatLocationName(location);
  DOM.locationName.textContent = locationText;
  DOM.weatherBadge.textContent = isDay ? 'Daytime • Live' : 'Nighttime • Live';
  DOM.weatherBadge.classList.add('badge-success');

  // Start ticking clock in destination timezone
  startLocalClock(data.timezone || 'UTC');

  // 2. Data Quality Timestamps: Provider Observation vs Client Sync Time
  const obsTimeFormatted = formatObservationTime(current.time, data.timezone);
  DOM.weatherObsTime.textContent = `Provider Observation: ${obsTimeFormatted}`;

  const syncTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date());
  DOM.lastUpdatedTime.textContent = `Last Synced: ${syncTime}`;

  // 3. Weather Condition & Icon
  const { description, icon } = getWeatherDescription(current.weather_code, current.is_day);
  DOM.weatherIcon.textContent = icon;
  DOM.weatherIcon.setAttribute('aria-label', description);
  DOM.weatherCondition.textContent = description;

  // 4. Hero Temperature (Never convert null/missing to 0)
  DOM.currentTemp.textContent = typeof current.temperature_2m === 'number' 
    ? Math.round(current.temperature_2m) 
    : '--';

  // 5. Detailed 6 Metric Cards with strict numeric fallbacks
  DOM.tempDetailValue.textContent = typeof current.temperature_2m === 'number' 
    ? `${current.temperature_2m.toFixed(1)}°C` 
    : '--°C';

  DOM.feelsLike.textContent = typeof current.apparent_temperature === 'number' 
    ? `${current.apparent_temperature.toFixed(1)}°C` 
    : '--°C';

  DOM.humidityValue.textContent = typeof current.relative_humidity_2m === 'number' 
    ? `${Math.round(current.relative_humidity_2m)}%` 
    : '--%';

  DOM.windSpeedValue.textContent = typeof current.wind_speed_10m === 'number' 
    ? `${current.wind_speed_10m.toFixed(1)} km/h` 
    : '-- km/h';

  DOM.windDirectionValue.textContent = getWindDirectionCardinal(current.wind_direction_10m);

  DOM.pressureValue.textContent = typeof current.surface_pressure === 'number' 
    ? `${Math.round(current.surface_pressure)} hPa` 
    : '-- hPa';

  // Reveal weather container
  DOM.weatherDisplay.classList.remove('hidden');

  // Mark successful state
  hasSuccessfulWeatherLoaded = true;

  console.log(`[Weather Loaded Successfully]: ${locationText} -> ${current.temperature_2m}°C, ${description} (${data.timezone})`);
}

/**
 * Render the location selection list when multiple matches are found.
 * Uses index attributes for delegated event handling.
 * @param {Array<Object>} locations - Array of geocoded locations
 */
function renderLocationOptions(locations) {
  if (!DOM.locationSelectList || !DOM.locationOptions) return;

  DOM.locationOptions.textContent = '';
  currentLocationCandidates = locations;

  locations.forEach((loc, index) => {
    const li = document.createElement('li');
    li.className = 'location-option-item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'location-option-btn';
    btn.setAttribute('data-index', index.toString());
    btn.setAttribute('aria-label', `Select ${formatLocationName(loc)}`);

    // Main text container
    const mainSpan = document.createElement('span');
    mainSpan.className = 'location-option-main';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'location-option-name';
    nameSpan.textContent = loc.name;

    const detailsSpan = document.createElement('span');
    detailsSpan.className = 'location-option-details';
    const regionParts = [loc.admin1, loc.country].filter(Boolean);
    detailsSpan.textContent = regionParts.length > 0 ? regionParts.join(', ') : 'Coordinates match';

    mainSpan.appendChild(nameSpan);
    mainSpan.appendChild(detailsSpan);

    // Country badge
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'location-option-badge';
    badgeSpan.textContent = loc.country_code ? loc.country_code.toUpperCase() : `Match #${index + 1}`;

    btn.appendChild(mainSpan);
    btn.appendChild(badgeSpan);
    li.appendChild(btn);
    DOM.locationOptions.appendChild(li);
  });

  DOM.locationSelectList.classList.remove('hidden');
}

/* ==========================================================================
   8. Search & Geolocation Handlers (Race Condition Guarded)
   ========================================================================== */

/**
 * Execute search for a specific location object (e.g. from disambiguation list).
 * @param {Object} loc - Location metadata
 */
async function loadWeatherForLocation(loc) {
  // Cancel any active in-flight request
  if (activeAbortController) {
    activeAbortController.abort('superseded');
  }

  const controller = new AbortController();
  activeAbortController = controller;
  const currentRequestId = ++latestRequestId;

  const timeoutTimer = setTimeout(() => {
    controller.abort('timeout');
  }, API_CONFIG.REQUEST_TIMEOUT_MS);

  const locName = formatLocationName(loc);
  setBusyState(true, `Loading weather for ${locName}`, 'Querying Open-Meteo Forecast API...');
  hideError();

  try {
    const weatherData = await getWeather(loc.latitude, loc.longitude, controller.signal);

    // Race condition check: discard if a newer request began
    if (currentRequestId !== latestRequestId) return;

    displayWeather(weatherData, loc);
    hideError();
  } catch (error) {
    if (currentRequestId !== latestRequestId) return;
    if (error.name === 'AbortError' && controller.signal.reason === 'superseded') return;

    const friendly = getFriendlyErrorMessage(error, controller.signal.reason);
    console.error(`[Weather Load Error for ${locName}]:`, error);
    showError(friendly, () => loadWeatherForLocation(loc));
  } finally {
    clearTimeout(timeoutTimer);
    if (currentRequestId === latestRequestId) {
      setBusyState(false);
      activeAbortController = null;
    }
  }
}

/**
 * Primary search handler for form submissions.
 * Validates query, manages AbortController, checks response stale tokens,
 * and handles UI restoration.
 * @param {string} query - Validated city name
 */
async function executeSearch(query) {
  // 1. Cancel previous in-flight request
  if (activeAbortController) {
    activeAbortController.abort('superseded');
  }

  // 2. Establish fresh AbortController & Request ID
  const controller = new AbortController();
  activeAbortController = controller;
  const currentRequestId = ++latestRequestId;

  // 3. Arm request timeout
  const timeoutTimer = setTimeout(() => {
    controller.abort('timeout');
  }, API_CONFIG.REQUEST_TIMEOUT_MS);

  hideError();
  hideLocationOptions();
  setBusyState(true, `Searching for "${query}"`, 'Connecting to Open-Meteo Geocoding API...');

  try {
    // 4. Fetch coordinates
    const locations = await getCoordinates(query, controller.signal);

    // Race condition check
    if (currentRequestId !== latestRequestId) return;

    if (!locations || locations.length === 0) {
      showError(
        `No locations found matching "${query}". Please check your spelling or search for a nearby major city.`,
        () => executeSearch(query)
      );
      return;
    }

    const topMatch = locations[0];
    const topMatchName = formatLocationName(topMatch);

    // Render disambiguation list if multiple candidates exist
    if (locations.length > 1) {
      renderLocationOptions(locations);
    }

    setBusyState(true, `Loading weather for ${topMatchName}`, 'Querying Open-Meteo Forecast API...');

    // 5. Fetch forecast metrics
    const weatherData = await getWeather(topMatch.latitude, topMatch.longitude, controller.signal);

    // Race condition check
    if (currentRequestId !== latestRequestId) return;

    // 6. Render UI
    displayWeather(weatherData, topMatch);
    hideError();
  } catch (error) {
    // Stale check
    if (currentRequestId !== latestRequestId) return;

    // Silently ignore superseded cancellations
    if (error.name === 'AbortError' && controller.signal.reason === 'superseded') {
      return;
    }

    const friendlyMessage = getFriendlyErrorMessage(error, controller.signal.reason);
    console.error(`[Weather Search Error for "${query}"]:`, error);

    // Preserve existing weather data if available; report error banner clearly
    showError(friendlyMessage, () => executeSearch(query));
  } finally {
    clearTimeout(timeoutTimer);
    if (currentRequestId === latestRequestId) {
      setBusyState(false);
      activeAbortController = null;
    }
  }
}

/**
 * Form submit interceptor.
 * @param {Event} event 
 */
function handleSearchSubmit(event) {
  if (event) {
    event.preventDefault();
  }

  const query = DOM.cityInput.value.trim();

  // Validate input
  if (!query) {
    showError('Please enter a city name before searching.');
    DOM.cityInput.focus();
    return;
  }

  if (query.length < 2) {
    showError('Please enter at least 2 characters for a city search.');
    DOM.cityInput.focus();
    return;
  }

  executeSearch(query);
}

/**
 * Handle "Current Location" button click.
 * Requests browser GPS location strictly upon user interaction,
 * performs reverse geocoding with coordinate fallback, and fetches real-time weather.
 */
function handleLocationClick() {
  hideError();
  hideLocationOptions();

  if (!('geolocation' in navigator)) {
    showError('Geolocation is not supported by your current browser.');
    return;
  }

  // Cancel any existing in-flight search
  if (activeAbortController) {
    activeAbortController.abort('superseded');
  }

  const controller = new AbortController();
  activeAbortController = controller;
  const currentRequestId = ++latestRequestId;

  setBusyState(true, 'Detecting your GPS location', 'Waiting for browser location permissions...');

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000 // 5 minutes cache
  };

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (currentRequestId !== latestRequestId) return;

      const { latitude, longitude } = position.coords;

      setBusyState(true, 'Resolving location & weather', 'Querying Open-Meteo for your coordinates...');

      const timeoutTimer = setTimeout(() => {
        controller.abort('timeout');
      }, API_CONFIG.REQUEST_TIMEOUT_MS);

      try {
        // Run reverse geocoding and forecast requests concurrently
        const [locationMeta, weatherData] = await Promise.all([
          reverseGeocode(latitude, longitude, controller.signal),
          getWeather(latitude, longitude, controller.signal)
        ]);

        if (currentRequestId !== latestRequestId) return;

        displayWeather(weatherData, locationMeta);
        hideError();
      } catch (weatherErr) {
        if (currentRequestId !== latestRequestId) return;
        if (weatherErr.name === 'AbortError' && controller.signal.reason === 'superseded') return;

        const friendly = getFriendlyErrorMessage(weatherErr, controller.signal.reason);
        console.error('[Current Location Weather Error]:', weatherErr);
        showError(friendly, handleLocationClick);
      } finally {
        clearTimeout(timeoutTimer);
        if (currentRequestId === latestRequestId) {
          setBusyState(false);
          activeAbortController = null;
        }
      }
    },
    (error) => {
      if (currentRequestId !== latestRequestId) return;

      setBusyState(false);
      activeAbortController = null;

      let userFriendlyMessage = 'Unable to access your current location.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          userFriendlyMessage = 'Location access was denied. Please allow location permissions in your browser or search for a city manually.';
          break;
        case error.POSITION_UNAVAILABLE:
          userFriendlyMessage = 'Your GPS position is currently unavailable. Please verify device location settings or enter a city name.';
          break;
        case error.TIMEOUT:
          userFriendlyMessage = 'The request to detect your GPS position timed out. Please try again or search by city name.';
          break;
      }

      console.warn(`[Geolocation Error ${error.code}]: ${error.message}`);
      showError(userFriendlyMessage, handleLocationClick);
    },
    geoOptions
  );
}

/**
 * Handle clear search button click.
 */
function handleClearInput() {
  if (DOM.cityInput) {
    DOM.cityInput.value = '';
    DOM.cityInput.focus();
    updateClearButtonVisibility();
  }
}

/**
 * Handle retry button clicks from error banner.
 */
function handleRetry() {
  if (typeof lastFailedAction === 'function') {
    const action = lastFailedAction;
    hideError();
    action();
  }
}

/* ==========================================================================
   9. Application Initialization & Single-Registration Listeners
   ========================================================================== */
function initApp() {
  // Search form submit listener (handles Enter key & search button click)
  if (DOM.searchForm) {
    DOM.searchForm.addEventListener('submit', handleSearchSubmit);
  }

  // Geolocation button listener (requested strictly on user click)
  if (DOM.locationBtn) {
    DOM.locationBtn.addEventListener('click', handleLocationClick);
  }

  // Search input typing listener for clear button toggle
  if (DOM.cityInput) {
    DOM.cityInput.addEventListener('input', updateClearButtonVisibility);
  }

  // Clear input button click
  if (DOM.clearInputBtn) {
    DOM.clearInputBtn.addEventListener('click', handleClearInput);
  }

  // Dismiss button for location disambiguation choices list
  if (DOM.closeSelectBtn) {
    DOM.closeSelectBtn.addEventListener('click', hideLocationOptions);
  }

  // Retry action button listener
  if (DOM.retryBtn) {
    DOM.retryBtn.addEventListener('click', handleRetry);
  }

  // Event delegation on location options list (prevents multiple duplicate listeners)
  if (DOM.locationOptions) {
    DOM.locationOptions.addEventListener('click', (event) => {
      const btn = event.target.closest('.location-option-btn');
      if (!btn) return;

      const index = parseInt(btn.getAttribute('data-index'), 10);
      if (isNaN(index) || !currentLocationCandidates[index]) return;

      const selectedLoc = currentLocationCandidates[index];
      hideLocationOptions();
      loadWeatherForLocation(selectedLoc);
    });
  }

  console.log('Real-Time Weather Dashboard: Step 5 features initialized successfully.');
}

// Initialize application when DOM is parsed
document.addEventListener('DOMContentLoaded', initApp);
