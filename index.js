const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const PIEVE = "S01738";
const NEXT_STOP_MILANO_DIR = "S01724"; // Locate Triulzi (dal tuo sample)

let stopTimes = [];
let trips = [];

// 🧠 costruisce mappa viaggi
function buildTrips() {
  const map = {};

  for (const s of stopTimes) {
    if (!map[s.trip_id]) map[s.trip_id] = [];
    map[s.trip_id].push(s);
  }

  return map;
}

// 🚆 trova direzione giusta (Pieve → Locate)
function getValidTrips() {
  const grouped = buildTrips();
  const valid = [];

  for (const [trip_id, stops] of Object.entries(grouped)) {
    const pieve = stops.find(s => s.stop_id === PIEVE);
    const locate = stops.find(s => s.stop_id === NEXT_STOP_MILANO_DIR);

    if (!pieve || !locate) continue;

    const [ph, pm] = pieve.arrival_time.split(":").map(Number);
    const [lh, lm] = locate.arrival_time.split(":").map(Number);

    const pMin = ph * 60 + pm;
    const lMin = lh * 60 + lm;

    // deve andare avanti nel tempo (direzione giusta)
    if (lMin <= pMin) continue;

    valid.push({
      trip_id,
      departure: pMin,
      arrival: lMin,
      departure_time: pieve.arrival_time
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
        speech: "Nessun treno in direzione Milano trovato"
      });
    }

    const delay = await getDelay(next.trip_id);

    let speech = `Il prossimo treno da Pieve Emanuele verso Milano parte alle ${next.departure_time}`;

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