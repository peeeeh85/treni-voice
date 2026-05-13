const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const STOP_ID = "S01104";

let stopTimes = [];
let trips = [];

// 📥 GTFS stop_times
function loadStopTimes() {
  return new Promise((resolve) => {
    const results = [];

    fs.createReadStream("./gtfs/stop_times.txt")
      .pipe(csv())
      .on("data", (d) => results.push(d))
      .on("end", () => {
        stopTimes = results;
        resolve();
      });
  });
}

// 📥 GTFS trips
function loadTrips() {
  return new Promise((resolve) => {
    const results = [];

    fs.createReadStream("./gtfs/trips.txt")
      .pipe(csv())
      .on("data", (d) => results.push(d))
      .on("end", () => {
        trips = results;
        resolve();
      });
  });
}

// 🧠 tempo
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 🚆 prossimo treno (SOLO GTFS affidabile)
function getNextTrain() {
  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const current = now.getHours() * 60 + now.getMinutes();

  const list = stopTimes
    .filter(s => s.stop_id === STOP_ID && s.arrival_time)
    .map(s => {
      const minutes = toMinutes(s.arrival_time);

      return {
        time: s.arrival_time,
        minutes,
        trip_id: s.trip_id
      };
    })
    .filter(t => t.minutes >= current)
    .sort((a, b) => a.minutes - b.minutes);

  return list[0];
}

// 🔍 numero treno da GTFS trips
function getTrainNumber(trip_id) {
  const trip = trips.find(t => t.trip_id === trip_id);
  if (!trip) return null;

  const match = trip.trip_headsign?.match(/(\d+)/);
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
    console.log(e.message);

    res.json({ speech: "Errore nel sistema treni" });
  }
});

Promise.all([loadStopTimes(), loadTrips()]).then(() => {
  app.listen(PORT, () => console.log("Server attivo"));
});