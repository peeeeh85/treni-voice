const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// 👉 GTFS Lombardia (TUO FILE locale)
let stopTimes = [];
let trips = [];

// 🧠 STAZIONE CORRETTA (dal tuo debug)
const STOP_ID = "S01738";

// --------------------
// 🚆 prossimo treno
// --------------------
function getNextTrain() {
  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const current = now.getHours() * 60 + now.getMinutes();

  const list = stopTimes
    .filter(s => (s.stop_id || "").trim() === STOP_ID)
    .map(s => {
      const [h, m] = s.arrival_time.split(":").map(Number);

      return {
        time: s.arrival_time,
        minutes: h * 60 + m,
        trip_id: s.trip_id
      };
    })
    .filter(t => t.minutes >= current)
    .sort((a, b) => a.minutes - b.minutes);

  return list[0];
}

// --------------------
// 🚆 numero treno
// --------------------
function getTrainNumber(trip_id) {
  const trip = trips.find(t => t.trip_id === trip_id);
  if (!trip) return null;

  const match = (trip.trip_headsign || "").match(/(\d+)/);
  return match ? match[1] : null;
}

// --------------------
// ⏱️ ritardo reale (fallback affidabile)
// --------------------
async function getDelay(num) {
  try {
    if (!num) return 0;

    const res = await axios.get(
      `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/cercaNumeroTreno/${num}`,
      { timeout: 10000 }
    );

    return res.data?.ritardo || 0;

  } catch (e) {
    console.log("delay error:", e.message);
    return 0;
  }
}

// --------------------
// 🚆 API
// --------------------
app.get("/treno", async (req, res) => {
  try {
    const next = getNextTrain();

    if (!next) {
      return res.json({ speech: "Nessun treno trovato" });
    }

    const num = getTrainNumber(next.trip_id);
    const delay = await getDelay(num);

    let speech = `Il prossimo treno per Milano parte alle ${next.time}`;

    speech += delay > 0
      ? ` ed ha ${delay} minuti di ritardo`
      : " ed è in orario";

    res.json({ speech });

  } catch (e) {
    console.log(e.message);
    res.json({ speech: "Errore sistema treni" });
  }
});

app.listen(PORT, () => {
  console.log("🚆 Server attivo");
});