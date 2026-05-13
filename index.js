const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const STOP_PIEVE = "S01738";   // dal tuo GTFS
const STOP_ROGOREDO = "S01820";

let stopTimes = [];
let trips = [];

// 🧠 trova tutti i trip validi Pieve → Rogoredo
function getValidTrips() {
  const grouped = {};

  for (const s of stopTimes) {
    if (!grouped[s.trip_id]) grouped[s.trip_id] = [];

    grouped[s.trip_id].push({
      stop_id: s.stop_id,
      time: s.arrival_time
    });
  }

  const valid = [];

  for (const [trip_id, stops] of Object.entries(grouped)) {
    const hasPieve = stops.find(s => s.stop_id === STOP_PIEVE);
    const hasRogo = stops.find(s => s.stop_id === STOP_ROGOREDO);

    if (!hasPieve || !hasRogo) continue;

    const t1 = hasPieve.time;
    const t2 = hasRogo.time;

    if (!t1 || !t2) continue;

    const [h1, m1] = t1.split(":").map(Number);
    const [h2, m2] = t2.split(":").map(Number);

    const min1 = h1 * 60 + m1;
    const min2 = h2 * 60 + m2;

    // deve andare Pieve → Rogoredo (ordine corretto)
    if (min2 <= min1) continue;

    valid.push({
      trip_id,
      departure: min1,
      arrival: min2,
      departure_time: t1
    });
  }

  return valid;
}

// 🧠 prossimo treno reale
function getNextTrain() {
  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const current = now.getHours() * 60 + now.getMinutes();

  const valid = getValidTrips()
    .filter(t => t.departure >= current)
    .sort((a, b) => a.departure - b.departure);

  return valid[0];
}

// 🚆 ritardo reale (ViaggiaTreno)
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
        speech: "Nessun treno Pieve → Rogoredo trovato"
      });
    }

    const delay = await getDelay(next.trip_id);

    let speech = `Il prossimo treno per Milano Rogoredo parte alle ${next.departure_time}`;

    speech += delay > 0
      ? ` ed ha ${delay} minuti di ritardo`
      : " ed è in orario";

    res.json({ speech });

  } catch (e) {
    res.json({ speech: "Errore sistema treni" });
  }
});

app.listen(PORT, () => console.log("Server attivo"));