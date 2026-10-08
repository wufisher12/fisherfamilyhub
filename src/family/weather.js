/* ------------------------------------------------------------------ */
/*  Weather (direct forecast API — no key needed)                      */
/* ------------------------------------------------------------------ */
const WMO = {
  0: "Clear and sunny", 1: "Mostly sunny", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Foggy", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow", 80: "Rain showers",
  81: "Rain showers", 82: "Heavy showers", 85: "Snow showers", 86: "Snow showers",
  95: "Thunderstorms", 96: "Thunderstorms", 99: "Thunderstorms",
};

function familySummary(condition, hiF) {
  const wet = /rain|drizzle|shower|storm|snow/i.test(condition);
  if (wet) return "Looks like an indoor-fort kind of day — have the crayons ready.";
  if (hiF >= 85) return "A hot one — sunscreen, hats, and the sprinkler after nap.";
  if (hiF >= 70) return "Great day to get the kids outside — playground weather.";
  if (hiF >= 55) return "Mild out — a stroller walk with light layers works nicely.";
  if (hiF >= 40) return "Chilly — bundle the kids up if you head out.";
  return "Cold one — hot cocoa and cozy indoor plans.";
}

export async function fetchWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=42.0417&longitude=-70.6723"
    + "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min"
    + "&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=1";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`forecast service ${resp.status}`);
  const d = await resp.json();
  const condition = WMO[d.current.weather_code] || "Mixed skies";
  const hiF = d.daily.temperature_2m_max[0];
  return {
    tempF: d.current.temperature_2m,
    hiF,
    loF: d.daily.temperature_2m_min[0],
    condition,
    summary: familySummary(condition, hiF),
  };
}
