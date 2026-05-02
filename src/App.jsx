import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function App() {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [aqi, setAqi] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [time, setTime] = useState(new Date());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState(null);

  const [satellite, setSatellite] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [showClouds, setShowClouds] = useState(false);

  const apiKey = "6b4321daec4e8f2147ecf32e81fb9af8";

  const getToken = () => localStorage.getItem("token");

  const authHeader = () => ({
    headers: {
      Authorization: "Bearer " + getToken()
    }
  });

  // ⏰ CLOCK
  useEffect(() => {
    const clock = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // 🔐 LOGIN
  const login = async () => {
    try {
      const res = await axios.post("http://localhost:5000/login", {
        email,
        password
      });

      localStorage.setItem("token", res.data.token);
      setUserId(res.data.userId);

      alert("Login success ✅");
      getFavorites();
    } catch (err) {
      alert(err.response?.data?.msg || "Login failed ❌");
    }
  };

  // 🚪 LOGOUT
  const logout = () => {
    localStorage.removeItem("token");
    setUserId(null);
    setWeather(null);
    setFavorites([]);
    alert("Logged out 🔓");
  };

  // ⭐ FAVORITES
  const getFavorites = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/favorites",
        authHeader()
      );
      setFavorites(res.data);
    } catch (err) {
      if (err.response?.status === 401) logout();
    }
  };

  const addFavorite = async () => {
    try {
      await axios.post(
        "http://localhost:5000/add-fav",
        { city: weather.name },
        authHeader()
      );
      getFavorites();
    } catch (err) {
      if (err.response?.status === 401) logout();
    }
  };

  // 🎤 VOICE
  const startVoice = () => {
    if (!getToken()) return alert("Login first 🔐");

    const rec = new window.webkitSpeechRecognition();
    rec.onresult = (e) => {
      const c = e.results[0][0].transcript;
      setCity(c);
      getWeather(c);
    };
    rec.start();
  };

  // 📍 LOCATION
  const detectLocation = () => {
    if (!getToken()) return alert("Login first 🔐");

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;

      const res = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`
      );

      setWeather(res.data);
    });
  };

  // 🤖 AI
  const getAI = () => {
    if (!weather) return "";
    const t = weather.main.temp;

    if (t > 35) return "🔥 Too hot!";
    if (t < 10) return "❄ Cold!";
    if (weather.weather[0].main.includes("Rain"))
      return "☔ Carry umbrella";

    return "😊 Nice weather";
  };

  // 🌦 WEATHER (public API, but login check for UX)
  const getWeather = async (searchCity = city) => {
    if (!getToken()) {
      alert("Login first 🔐");
      return;
    }

    try {
      const current = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${searchCity}&units=metric&appid=${apiKey}`
      );

      const forecastData = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?q=${searchCity}&units=metric&appid=${apiKey}`
      );

      setWeather(current.data);

      const weekly = forecastData.data.list
        .filter((_, i) => i % 8 === 0)
        .slice(0, 7)
        .map((item) => ({
          day: new Date(item.dt_txt).toLocaleDateString("en-US", {
            weekday: "short"
          }),
          temp: item.main.temp
        }));

      setForecast(weekly);
      setHourly(forecastData.data.list.slice(0, 8));

      const { lat, lon } = current.data.coord;

      const aqiRes = await axios.get(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
      );

      setAqi(aqiRes.data.list[0].main.aqi);

    } catch {
      alert("City not found ❌");
    }
  };

  return (
    <div className="app">
      <div className="dashboard">

        {/* LEFT */}
        <div className="card">
          <h1>🌤 Weather Pro</h1>

          {!getToken() ? (
            <>
              <input placeholder="Email" onChange={(e)=>setEmail(e.target.value)} />
              <input type="password" placeholder="Password" onChange={(e)=>setPassword(e.target.value)} />
              <button onClick={login}>Login</button>
            </>
          ) : (
            <button onClick={logout}>🚪 Logout</button>
          )}

          <input value={city} onChange={(e)=>setCity(e.target.value)} placeholder="City" />

          <button onClick={()=>getWeather()}>Search</button>
          <button onClick={startVoice}>🎤 Speak</button>
          <button onClick={detectLocation}>📍 Auto</button>

          {weather && (
            <>
              <h2>{weather.name}</h2>
              <h1>{weather.main.temp}°C</h1>
              <p>{weather.weather[0].description}</p>
              <p>🕒 {time.toLocaleTimeString()}</p>
              <p>{getAI()}</p>

              <button onClick={addFavorite}>⭐ Favorite</button>

              <p>😷 AQI: {aqi}</p>

              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <LineChart data={forecast}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line dataKey="temp" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <h3>⏳ Hourly</h3>
              {hourly.map((h,i)=>(
                <p key={i}>{h.dt_txt.split(" ")[1]} - {h.main.temp}°C</p>
              ))}
            </>
          )}
        </div>

        {/* RIGHT */}
        {weather && (
          <div className="extra-panel">

            <h2>📊 Details</h2>

            <p>Feels: {weather.main.feels_like}</p>
            <p>Wind: {weather.wind.speed}</p>
            <p>Pressure: {weather.main.pressure}</p>

            <div>
              <button onClick={()=>setSatellite(!satellite)}>
                {satellite ? "🗺 Normal" : "🛰 Satellite"}
              </button>

              <button onClick={()=>setShowRain(!showRain)}>🌧 Rain</button>
              <button onClick={()=>setShowClouds(!showClouds)}>☁ Clouds</button>
            </div>

            <MapContainer
              center={[weather.coord.lat, weather.coord.lon]}
              zoom={10}
              style={{ height: 400 }}
            >
              <TileLayer
                url={
                  satellite
                    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                }
              />

              {showRain && (
                <TileLayer
                  url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`}
                  opacity={0.6}
                />
              )}

              {showClouds && (
                <TileLayer
                  url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`}
                  opacity={0.5}
                />
              )}

              <Marker position={[weather.coord.lat, weather.coord.lon]} />
            </MapContainer>

            <h3>⭐ Favorites</h3>
            {favorites.map((f,i)=>(
              <p key={i} onClick={()=>getWeather(f)}>{f}</p>
            ))}

          </div>
        )}
      </div>
    </div>
  );
}

export default App;