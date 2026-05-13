const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const STOP_ID = "S01104";

let stopTimes = [];
let trips = [];

// 📥 GTFS stop_times (NORMALIZZATO)
function loadStopTimes() {
  return new Promise((resolve) => {
    const results = [];

    fs.createReadStream("./gtfs/stop_times.txt")
      .pipe(csv())
      .on("data", (d) => {
        results.push({
          stop_id: (d.stop_id || "").trim(),
          arrival_time: (d.arrival_time || "").trim(),
          trip_id: (d.trip_id || "").trim()
        });
      })
      .on("end", () => {
        stopTimes = results;
        console.log("stopTimes:", stopTimes.length);
        resolve();
      });
  });
}

// 📥 GTFS trips (NORMALIZZATO)
function loadTrips() {
  return new Promise((resolve) => {
    const results = [];

    fs.createReadStream("./gtfs/trips.txt")
      .pipe(csv())
      .on("data", (d) => {
        results.push({
          trip_id: (d.trip_id || "").trim(),
          trip_headsign: (d.trip_headsign || "").trim()
        });
      })
      .on("end", () => {
        trips = results;
        console.log("trips:", trips.length);
        resolve();
      });
  });
}

// 🧠 tempo
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 🚆 prossimo treno
function getNextTrain() {
  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const current = now.getHours() * 60 + now.getMinutes();

  const list = stopTimes
    .filter(s => s.stop_id === STOP_ID)
    .map(s => ({
      time: s.arrival_time,
      minutes: toMinutes(s.arrival_time),
      trip_id: s.trip_id
    }))
    .filter(t => t.minutes >= current)
    .sort((a, b) => a.minutes - b.minutes);

  return list[0];
}

// 🔍 numero treno
function getTrainNumber(trip_id) {
  const trip = trips.find(t => t.trip_id === trip_id);
  if (!trip) return null;

  const match = trip.trip_headsign.match(/(\d+)/);
  return match ? match[1] : null;
}

// ⏱️ ritardo vero
async function getDelay(num) {
  try {
    if (!num) return 0;

    const res = await axios.get(
      `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/cercaNumeroTreno/${num}`,
      { timeout: 8000 }
    );

    return res.data?.ritardo || 0;
  } catch (e) {
    console.log("delay error:", e.message);
    return 0;
  }
}

app.get("/debug", (req, res) => {
  const sample = stopTimes.slice(0, 20);

  res.json({
    total: stopTimes.length,
    sample
  });
});

app.get("/find/:id", (req, res) => {
  const id = req.params.id.toLowerCase();

  const matches = stopTimes.filter(s =>
    s.stop_id.toLowerCase().includes(id)
  );

  res.json(matches.slice(0, 50));
});

// 🚆 API
app.get("/treno", async (req, res) => {
  try {
    const next = getNextTrain();

    if (!next) {
      return res.json({ speech: "Nessun treno trovato" });
    }

    const num = getTrainNumber(next.trip_id);

    const ritardo = await getDelay(num);

    let speech = `Il prossimo treno per Milano parte alle ${next.time}`;

    speech += ritardo
      ? ` ed ha ${ritardo} minuti di ritardo`
      : " ed è in orario";

    res.json({ speech });

  } catch (e) {
    console.log("ERROR:", e.message);

    res.json({ speech: "Errore nel sistema treni" });
  }
});

Promise.all([loadStopTimes(), loadTrips()]).then(() => {
  app.listen(PORT, () => console.log("Server attivo"));
});