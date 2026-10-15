import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const API_KEY = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;
const FAVORITES_KEY = "weatherFavorites";
const RECENT_KEY = "weatherRecentSearches";
const THEME_KEY = "weatherTheme";

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function dayName(timestamp, timezone = 0) {
  return new Date((timestamp + timezone) * 1000).toLocaleDateString(
    "en-US",
    { weekday: "short", timeZone: "UTC" }
  );
}

function App() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [aqi, setAqi] = useState(null);
  const [favorites, setFavorites] = useState(() =>
    readStorage(FAVORITES_KEY, [])
  );
  const [recent, setRecent] = useState(() =>
    readStorage(RECENT_KEY, [])
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem(THEME_KEY) || "light"
  );
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [forecastSource, setForecastSource] = useState("5-day forecast");
  const [satellite, setSatellite] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [showClouds, setShowClouds] = useState(false);

  const aqiLabels = ["", "Good", "Fair", "Moderate", "Poor", "Very Poor"];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }, [recent]);

  function addRecent(name) {
    if (!name) return;
    setRecent((old) =>
      [name, ...old.filter(
        (item) => item.toLowerCase() !== name.toLowerCase()
      )].slice(0, 6)
    );
  }

  function buildAlerts(current, oneCall) {
    const result = [];
    const temp = current.main?.temp;
    const main = (current.weather?.[0]?.main || "").toLowerCase();
    const description = (
      current.weather?.[0]?.description || ""
    ).toLowerCase();

    if (temp >= 40) {
      result.push({
        id: "heat",
        title: "Extreme Heat Alert",
        message: "Temperature is 40°C or higher. Stay hydrated and avoid prolonged outdoor activity.",
      });
    }

    if (
      main === "thunderstorm" ||
      description.includes("heavy rain") ||
      description.includes("very heavy rain")
    ) {
      result.push({
        id: "rain",
        title: "Heavy Rain / Storm Caution",
        message: "Hazardous weather may occur. Check local official advisories before travelling.",
      });
    }

    (oneCall?.alerts || []).forEach((alert, index) => {
      result.push({
        id: "official-" + index,
        title: alert.event || "Official Weather Alert",
        message:
          (alert.sender_name ? alert.sender_name + ": " : "") +
          (alert.description || "Follow local authority guidance."),
      });
    });

    return result;
  }

  async function fetchCoordinates(lat, lon, fallbackName = "") {
    if (!API_KEY) {
      throw new Error(
        "API key missing. Add VITE_OPENWEATHERMAP_API_KEY to .env."
      );
    }

    const currentResponse = await axios.get(
      "https://api.openweathermap.org/data/2.5/weather",
      { params: { lat, lon, units: "metric", appid: API_KEY } }
    );
    const current = currentResponse.data;

    const forecastResponse = await axios.get(
      "https://api.openweathermap.org/data/2.5/forecast",
      { params: { lat, lon, units: "metric", appid: API_KEY } }
    );
    const slots = forecastResponse.data.list || [];

    // Default forecast API provides 5 days at 3-hour intervals.
    const dailyMap = new Map();

    slots.forEach((item) => {
      const key = new Date(item.dt * 1000).toISOString().slice(0, 10);
      if (!dailyMap.has(key)) {
        dailyMap.set(key, {
          dt: item.dt,
          temp: {
            min: item.main.temp_min,
            max: item.main.temp_max,
            day: item.main.temp,
          },
          pop: item.pop || 0,
          weather: item.weather,
          fallback: true,
        });
      } else {
        const day = dailyMap.get(key);
        day.temp.min = Math.min(day.temp.min, item.main.temp_min);
        day.temp.max = Math.max(day.temp.max, item.main.temp_max);
        day.pop = Math.max(day.pop, item.pop || 0);
      }
    });

    let oneCall = null;
    let daily = Array.from(dailyMap.values()).slice(0, 5);
    let source = "5-day forecast";

    // One Call 3.0 access may need to be enabled for your API account.
    try {
      const response = await axios.get(
        "https://api.openweathermap.org/data/3.0/onecall",
        {
          params: {
            lat,
            lon,
            units: "metric",
            appid: API_KEY,
            exclude: "minutely,hourly",
          },
        }
      );

      oneCall = response.data;
      daily = (oneCall.daily || []).slice(0, 7);
      source = "One Call 3.0 · 7-day forecast";
    } catch (error) {
      console.warn(
        "One Call 3.0 unavailable; using standard forecast if permitted."
      );
    }

    setWeather(current);
    setCity(current.name || fallbackName);
    setHourly(slots.slice(0, 8));
    setForecast(daily);
    setForecastSource(source);
    setAlerts(buildAlerts(current, oneCall));
    addRecent(current.name || fallbackName);

    try {
      const airResponse = await axios.get(
        "https://api.openweathermap.org/data/2.5/air_pollution",
        { params: { lat, lon, appid: API_KEY } }
      );
      setAqi(airResponse.data.list?.[0]?.main?.aqi ?? null);
    } catch {
      setAqi(null);
    }
  }

  async function getWeather(searchCity = city) {
    const query = searchCity.trim();

    if (!query) {
      alert("Please enter a city name.");
      return;
    }

    if (!API_KEY) {
      alert("API key missing. Check your .env file.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.get(
        "https://api.openweathermap.org/data/2.5/weather",
        { params: { q: query, units: "metric", appid: API_KEY } }
      );

      await fetchCoordinates(
        response.data.coord.lat,
        response.data.coord.lon,
        response.data.name
      );
    } catch (error) {
      const status = error.response?.status;

      if (error.message?.startsWith("API key missing")) {
        alert(error.message);
      } else if (status === 401) {
        alert("API key invalid, inactive, or not enabled for this endpoint.");
      } else if (status === 403) {
        alert("This API endpoint may not be enabled for your account.");
      } else if (status === 404) {
        alert("City not found. Check the spelling.");
      } else {
        alert("Unable to fetch weather. Check your connection and API status.");
      }
    } finally {
      setLoading(false);
    }
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      alert("Your browser does not support location access.");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await fetchCoordinates(coords.latitude, coords.longitude);
        } catch (error) {
          alert(error.response?.status === 401
            ? "API key invalid or inactive."
            : error.response?.status === 403
            ? "An API endpoint is not enabled for this account."
            : error.message || "Could not fetch your local weather.");
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        alert(error.code === 1
          ? "Allow location permission in your browser."
          : "Could not detect location. Try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function startVoiceSearch() {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      alert("Voice search is not supported in this browser. Try Chrome.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript.trim();
      setCity(spoken);
      getWeather(spoken);
    };
    recognition.onerror = () => alert("Voice search failed. Please try again.");
    recognition.start();
  }

  function addFavorite() {
    if (!weather) return;

    if (favorites.some(
      (name) => name.toLowerCase() === weather.name.toLowerCase()
    )) {
      alert("This city is already in favorites.");
      return;
    }

    setFavorites((old) => [...old, weather.name]);
  }

  const chartData = useMemo(() => forecast.map((day) => ({
    day: dayName(day.dt, weather?.timezone || 0),
    temperature: Math.round(
      day.fallback
        ? day.temp.day
        : day.temp?.day ?? day.temp?.max ?? 0
    ),
    rain: Math.round((day.pop || 0) * 100),
  })), [forecast, weather]);

  const weatherAdvice = () => {
    if (!weather) return "";
    const temp = weather.main.temp;
    const condition = (weather.weather?.[0]?.main || "").toLowerCase();

    if (temp >= 40) return "🔥 Extreme heat: drink water and avoid long outdoor activity.";
    if (temp >= 35) return "☀️ Hot weather: stay hydrated and seek shade.";
    if (temp < 10) return "❄️ Cold weather: wear warm clothes.";
    if (condition === "thunderstorm") return "⛈️ Thunderstorm: stay indoors where possible.";
    if (condition === "rain") return "☔ Rain expected: carry an umbrella.";
    return "😊 Have a great day!";
  };

  return (
    <div className="app">
      <div className="dashboard">
        <main className="card">
          <header className="title-row">
            <h1>🌤 Weather Pro</h1>
            <button
              className="theme-toggle"
              onClick={() => setTheme((old) => old === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
          </header>

          <div className="search-row">
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && getWeather()}
              placeholder="Enter city name..."
              aria-label="City name"
            />
            <button onClick={() => getWeather()} disabled={loading}>
              {loading ? "Loading..." : "Search"}
            </button>
          </div>

          <div className="button-row">
            <button onClick={startVoiceSearch}>🎤 Voice Search</button>
            <button onClick={detectLocation} disabled={loading}>
              📍 Use My Location
            </button>
          </div>

          {recent.length > 0 && (
            <section className="history-section">
              <h3>🕘 Recent Searches</h3>
              <div className="chip-row">
                {recent.map((name) => (
                  <button
                    className="history-chip"
                    key={name}
                    onClick={() => getWeather(name)}
                  >
                    {name}
                  </button>
                ))}
                <button className="secondary-button" onClick={() => setRecent([])}>
                  Clear History
                </button>
              </div>
            </section>
          )}

          {weather && (
            <>
              {alerts.length > 0 && (
                <section className="alerts-wrap" role="alert">
                  {alerts.map((item) => (
                    <div className="alert-banner" key={item.id}>
                      <strong>⚠️ {item.title}</strong>
                      <p>{item.message}</p>
                    </div>
                  ))}
                </section>
              )}

              <h2>{weather.name}, {weather.sys.country}</h2>

              <div className="current-weather">
                <div className="current-temp">
                  {Math.round(weather.main.temp)}°C
                </div>
                <div>
                  <p className="capitalize">
                    {weather.weather?.[0]?.description}
                  </p>
                  <p>Feels like {Math.round(weather.main.feels_like)}°C</p>
                  {weather.weather?.[0]?.icon && (
                    <img
                      src={"https://openweathermap.org/img/wn/" +
                        weather.weather[0].icon + "@2x.png"}
                      alt="Current weather"
                    />
                  )}
                </div>
              </div>

              <div className="ai-box"><p>{weatherAdvice()}</p></div>

              <div className="button-row">
                <button onClick={addFavorite}>⭐ Add Favorite</button>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span>💧 Humidity</span>
                  <strong>{weather.main.humidity}%</strong>
                </div>
                <div className="stat-card">
                  <span>💨 Wind</span>
                  <strong>{weather.wind.speed} m/s</strong>
                </div>
                <div className="stat-card">
                  <span>🧭 Pressure</span>
                  <strong>{weather.main.pressure} hPa</strong>
                </div>
                <div className="stat-card">
                  <span>👁️ Visibility</span>
                  <strong>{((weather.visibility || 0) / 1000).toFixed(1)} km</strong>
                </div>
                <div className="stat-card">
                  <span>😷 Air Quality</span>
                  <strong>
                    {aqi === null ? "Unavailable" : aqi + " (" + (aqiLabels[aqi] || "Unknown") + ")"}
                  </strong>
                </div>
              </div>

              <h2>📅 Extended Forecast</h2>
              <p className="muted">{forecastSource}</p>

              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      name="Temperature °C"
                      stroke="#f59e0b"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="rain"
                      name="Rain chance %"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="forecast-grid">
                {forecast.map((day, index) => {
                  const min = day.fallback ? day.temp.min : day.temp?.min;
                  const max = day.fallback ? day.temp.max : day.temp?.max;
                  const icon = day.weather?.[0]?.icon;
                  return (
                    <div className="forecast-card" key={day.dt + "-" + index}>
                      <strong>{dayName(day.dt, weather.timezone || 0)}</strong>
                      {icon && (
                        <img
                          src={"https://openweathermap.org/img/wn/" + icon + "@2x.png"}
                          alt={day.weather?.[0]?.description || "Weather"}
                        />
                      )}
                      <span>{day.weather?.[0]?.description || "Forecast"}</span>
                      <b>
                        {Math.round(max ?? day.temp?.day ?? 0)}° /
                        {" "}{Math.round(min ?? day.temp?.day ?? 0)}°C
                      </b>
                      <span>🌧 Rain chance: {Math.round((day.pop || 0) * 100)}%</span>
                    </div>
                  );
                })}
              </div>

              <h2>⏳ Hourly Forecast</h2>
              <div className="hourly-list">
                {hourly.map((item) => (
                  <div className="hourly-item" key={item.dt}>
                    <span>
                      {new Date(item.dt * 1000).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>{item.weather?.[0]?.description}</span>
                    <strong>{Math.round(item.main.temp)}°C</strong>
                    <span>🌧 {Math.round((item.pop || 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {weather && (
          <aside className="card extra-panel">
            <h2>🗺️ Weather Map</h2>
            <div className="button-row">
              <button onClick={() => setSatellite((old) => !old)}>
                {satellite ? "🗺️ Normal Map" : "🛰️ Satellite"}
              </button>
              <button onClick={() => setShowRain((old) => !old)}>
                {showRain ? "Hide Rain" : "🌧️ Rain Layer"}
              </button>
              <button onClick={() => setShowClouds((old) => !old)}>
                {showClouds ? "Hide Clouds" : "☁️ Cloud Layer"}
              </button>
            </div>

            <MapContainer
              key={weather.name + "-" + satellite}
              center={[weather.coord.lat, weather.coord.lon]}
              zoom={9}
              style={{ height: 340, width: "100%", marginTop: 12, borderRadius: 12 }}
            >
              <TileLayer
                attribution={satellite ? "&copy; Esri" : "&copy; OpenStreetMap"}
                url={satellite
                  ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
              />
              {showRain && (
                <TileLayer
                  url={"https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=" + API_KEY}
                  opacity={0.6}
                />
              )}
              {showClouds && (
                <TileLayer
                  url={"https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=" + API_KEY}
                  opacity={0.5}
                />
              )}
              <Marker position={[weather.coord.lat, weather.coord.lon]} />
            </MapContainer>

            <h2>⭐ Favorite Cities</h2>
            {favorites.length === 0 ? (
              <p>No favorite cities yet. Search a city and add it.</p>
            ) : (
              favorites.map((name) => (
                <div className="favorite-row" key={name}>
                  <button className="favorite-city" onClick={() => getWeather(name)}>
                    {name}
                  </button>
                  <button onClick={() => setFavorites((old) => old.filter((item) => item !== name))}>
                    Remove
                  </button>
                </div>
              ))
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;
