import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  MapContainer,
  TileLayer,
  Marker,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

// OpenWeatherMap API key
const API_KEY = "6b4321daec4e8f2147ecf32e81fb9af8";

function App() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [aqi, setAqi] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [time, setTime] = useState(new Date());

  const [satellite, setSatellite] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [showClouds, setShowClouds] = useState(false);
  const [loading, setLoading] = useState(false);

  // Clock
  useEffect(() => {
    const clock = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(clock);
  }, []);

  // Load favorite cities
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("weatherFavorites") || "[]"
      );

      setFavorites(Array.isArray(saved) ? saved : []);
    } catch {
      setFavorites([]);
    }
  }, []);

  // Weather advice
  const getAI = () => {
    if (!weather) return "";

    const temp = weather.main.temp;
    const condition = weather.weather[0].main.toLowerCase();

    if (temp > 35) return "🔥 Too hot! Stay hydrated.";
    if (temp < 10) return "❄️ Cold! Wear warm clothes.";
    if (condition.includes("thunderstorm")) {
      return "⛈️ Thunderstorm possible. Stay safe.";
    }
    if (condition.includes("rain")) {
      return "☔ Carry an umbrella.";
    }

    return "😊 Have a great day!";
  };

  // Fetch weather, forecast and AQI
  const getWeather = async (searchCity = city) => {
    const query = searchCity.trim();

    if (!query) {
      alert("Please enter a city name.");
      return;
    }

    setLoading(true);

    try {
      const currentResponse = await axios.get(
        "https://api.openweathermap.org/data/2.5/weather",
        {
          params: {
            q: query,
            units: "metric",
            appid: API_KEY,
          },
        }
      );

      const current = currentResponse.data;

      const forecastResponse = await axios.get(
        "https://api.openweathermap.org/data/2.5/forecast",
        {
          params: {
            q: query,
            units: "metric",
            appid: API_KEY,
          },
        }
      );

      setWeather(current);
      setCity(current.name);

      const weekly = forecastResponse.data.list
        .filter((item, index) => index % 8 === 0)
        .slice(0, 5)
        .map((item) => ({
          day: new Date(item.dt * 1000).toLocaleDateString(
            "en-US",
            { weekday: "short" }
          ),
          temp: item.main.temp,
        }));

      setForecast(weekly);
      setHourly(forecastResponse.data.list.slice(0, 8));

      // AQI request
      try {
        const aqiResponse = await axios.get(
          "https://api.openweathermap.org/data/2.5/air_pollution",
          {
            params: {
              lat: current.coord.lat,
              lon: current.coord.lon,
              appid: API_KEY,
            },
          }
        );

        setAqi(
          aqiResponse.data.list[0]?.main?.aqi ?? null
        );
      } catch {
        setAqi(null);
      }
    } catch (error) {
      setWeather(null);
      setForecast([]);
      setHourly([]);
      setAqi(null);

      if (error.response?.status === 401) {
        alert("API key invalid or not activated yet.");
      } else if (error.response?.status === 404) {
        alert("City not found. Check the spelling.");
      } else {
        alert("Weather fetch failed. Check internet connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Voice search
  const startVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search is not supported. Try Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const spokenCity =
        event.results[0][0].transcript.trim();

      setCity(spokenCity);
      getWeather(spokenCity);
    };

    recognition.onerror = () => {
      alert("Voice recognition failed. Please try again.");
    };

    recognition.start();
  };

  // Auto location
  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        setLoading(true);

        try {
          const response = await axios.get(
            "https://api.openweathermap.org/data/2.5/weather",
            {
              params: {
                lat: latitude,
                lon: longitude,
                units: "metric",
                appid: API_KEY,
              },
            }
          );

          await getWeather(response.data.name);
        } catch (error) {
          alert(
            error.response?.status === 401
              ? "API key invalid or not activated."
              : "Unable to get weather for your location."
          );
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        alert(
          error.code === 1
            ? "Please allow location access in browser settings."
            : "Unable to detect your location. Try again."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Add favorite
  const addFavorite = () => {
    if (!weather) return;

    const name = weather.name;

    const exists = favorites.some(
      (fav) => fav.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      alert("City already exists in favorites.");
      return;
    }

    const updated = [...favorites, name];

    setFavorites(updated);

    localStorage.setItem(
      "weatherFavorites",
      JSON.stringify(updated)
    );
  };

  // Remove favorite
  const removeFavorite = (name) => {
    const updated = favorites.filter(
      (fav) => fav !== name
    );

    setFavorites(updated);

    localStorage.setItem(
      "weatherFavorites",
      JSON.stringify(updated)
    );
  };

  const aqiLabels = [
    "",
    "Good",
    "Fair",
    "Moderate",
    "Poor",
    "Very Poor",
  ];

  return (
    <div className="app">
      <div className="dashboard">

        {/* LEFT PANEL */}
        <div className="card">
          <h1>🌤 Weather Pro</h1>

          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") getWeather();
            }}
            placeholder="Enter city name"
          />

          <button
            onClick={() => getWeather()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Search"}
          </button>

          <button onClick={startVoice}>
            🎤 Speak
          </button>

          <button
            onClick={detectLocation}
            disabled={loading}
          >
            📍 Auto Location
          </button>

          {weather && (
            <>
              <h2>
                {weather.name}, {weather.sys.country}
              </h2>

              <h3>
                {Math.round(weather.main.temp)}°C
              </h3>

              <p>{weather.weather[0].description}</p>

              <p>
                🕒 {time.toLocaleTimeString()}
              </p>

              <div className="ai-box">
                <p>{getAI()}</p>
              </div>

              <button onClick={addFavorite}>
                ⭐ Add Favorite
              </button>

              <p>
                😷 AQI:{" "}
                {aqi === null
                  ? "Unavailable"
                  : aqi + " (" + (aqiLabels[aqi] || "Unknown") + ")"}
              </p>

              <h2>📅 Weather Forecast</h2>

              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecast}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="temp"
                      name="Temperature °C"
                      stroke="#ffd166"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <h2>⏳ Hourly Forecast</h2>

              {hourly.map((item) => (
                <p key={item.dt}>
                  {new Date(item.dt * 1000).toLocaleTimeString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}{" "}
                  — {Math.round(item.main.temp)}°C
                </p>
              ))}
            </>
          )}
        </div>

        {/* RIGHT PANEL */}
        {weather && (
          <div className="extra-panel">
            <h2>📊 Weather Details</h2>

            <p>
              🌡️ Feels like: {weather.main.feels_like}°C
            </p>

            <p>
              💨 Wind speed: {weather.wind.speed} m/s
            </p>

            <p>
              🧭 Pressure: {weather.main.pressure} hPa
            </p>

            <p>
              💧 Humidity: {weather.main.humidity}%
            </p>

            <p>
              👁️ Visibility:{" "}
              {(weather.visibility / 1000).toFixed(1)} km
            </p>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setSatellite(!satellite)}
              >
                {satellite ? "🗺 Normal Map" : "🛰 Satellite"}
              </button>

              <button
                onClick={() => setShowRain(!showRain)}
              >
                {showRain ? "Hide Rain" : "🌧 Rain"}
              </button>

              <button
                onClick={() => setShowClouds(!showClouds)}
              >
                {showClouds ? "Hide Clouds" : "☁ Clouds"}
              </button>
            </div>

            <MapContainer
              key={weather.name + "-" + weather.coord.lat}
              center={[
                weather.coord.lat,
                weather.coord.lon,
              ]}
              zoom={10}
              style={{ height: 400, width: "100%" }}
            >
              <TileLayer
                attribution={
                  satellite
                    ? "&copy; Esri"
                    : "&copy; OpenStreetMap contributors"
                }
                url={
                  satellite
                    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                }
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

              <Marker
                position={[
                  weather.coord.lat,
                  weather.coord.lon,
                ]}
              />
            </MapContainer>

            <h2>⭐ Favorite Cities</h2>

            {favorites.length === 0 ? (
              <p>No favorite cities added yet.</p>
            ) : (
              favorites.map((fav) => (
                <div
                  key={fav}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <button
                    style={{ flex: 1 }}
                    onClick={() => getWeather(fav)}
                  >
                    {fav}
                  </button>

                  <button onClick={() => removeFavorite(fav)}>
                    ❌
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
