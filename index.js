const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const PIEVE = "S01104";
const LOCATE = "S01801";

let stopTimes = [];
let trips = [];

// 🧠 costruisce mappa trip → stops ordinati
function buildTrips() {
  const map = {};

  for (const s of stopTimes) {
    if (!map[s.trip_id]) map[s.trip_id] = [];

    map[s.trip_id].push({
      stop_id: s.stop_id,
      time: s.arrival_time
    });
  }

  return map;
}

// 🚆 trova trip validi Pieve → Locate
function getValidTrips() {
  const grouped = buildTrips();
  const valid = [];

  for (const [trip_id, stops] of Object.entries(grouped)) {
    const pieve = stops.find(s => s.stop_id === PIEVE);
    const locate = stops.find(s => s.stop_id === LOCATE);

    if (!pieve || !locate) continue;

    const [ph, pm] = pieve.time.split(":").map(Number);
    const [lh, lm] = locate.time.split(":").map(Number);

    const pMin = ph * 60 + pm;
    const lMin = lh * 60 + lm;

    // deve essere direzione corretta
    if (lMin <= pMin) continue;

    valid.push({
      trip_id,
      departure: pMin,
      departure_time: pieve.time
    });
  }

  return valid;
}

// 🚆 prossimo treno
function getNextTrain() {
  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const current = now.getHours() * 60 + now.getMinutes();

  return getValidTrips()
    .filter(t => t.departure >= current)
    .sort((a, b) => a.departure - b.departure)[0];
}

// ⏱️ ritardo reale
async function getDelay(trip_id) {
  try {
    const res = await axios.get(
      `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/cercaNumeroTreno/${trip_id}`,
      { timeout: 10000 }
    );

    return res.data?.ritardo || 0;
  } catch {
    return 0;
  }
}

// 🚆 API
app.get("/treno", async (req, res) => {
  try {
    const next = getNextTrain();

    if (!next) {
      return res.json({
        speech: "Nessun treno Pieve → Locate trovato"
      });
    }

    const delay = await getDelay(next.trip_id);

    let speech = `Il prossimo treno da Pieve Emanuele a Locate Triulzi parte alle ${next.departure_time}`;

    speech += delay > 0
      ? ` ed ha ${delay} minuti di ritardo`
      : " ed è in orario";

    res.json({ speech });

  } catch (e) {
    res.json({ speech: "Errore sistema treni" });
  }
});

app.listen(PORT, () => {
  console.log("🚆 Server attivo");
});