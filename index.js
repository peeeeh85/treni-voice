const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// 🚉 Pieve Emanuele
const STOP_ID = "S01104";

let stopTimes = [];
let trips = [];

// 📥 carica stop_times
function loadStopTimes() {
  return new Promise((resolve) => {
    const results = [];

    fs.createReadStream("./gtfs/stop_times.txt")
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        stopTimes = results;
        console.log("stop_times caricati:", stopTimes.length);
        resolve();
      });
  });
}

// 📥 carica trips
function loadTrips() {
  return new Promise((resolve) => {
    const results = [];

    fs.createReadStream("./gtfs/trips.txt")
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        trips = results;
        console.log("trips caricati:", trips.length);
        resolve();
      });
  });
}

// 🧠 converte orario GTFS → minuti (gestisce oltre 24h)
function timeToMinutes(gtfsTime) {
  const [h, m] = gtfsTime.split(":").map(Number);

  return (h % 24) * 60 + m + (h >= 24 ? 1440 : 0);
}

// 🧠 trova prossimo treno
function getNextTrain() {
  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const list = stopTimes
    .filter((s) => s.stop_id === STOP_ID && s.arrival_time)
    .map((s) => {
      const [h, m] = s.arrival_time.split(":").map(Number);

      let minutes = h * 60 + m;

      // GTFS dopo mezzanotte
      if (h >= 24) {
        minutes = (h - 24) * 60 + m + 1440;
      }

      return {
        time: s.arrival_time,
        minutes,
        trip_id: s.trip_id
      };
    })
    .sort((a, b) => a.minutes - b.minutes);

  // 🔥 PRIMA scelta: futuro
  let next = list.find(t => t.minutes >= currentMinutes);

  // 🔥 FALLBACK: se non trova → primo disponibile (oggi o ciclo)
  if (!next) {
    next = list[0];
  }

  return next;
}

// 🔍 estrai numero treno da headsign
function extractTrainNumber(tripInfo) {
  if (!tripInfo || !tripInfo.trip_headsign) return null;

  const match = tripInfo.trip_headsign.match(/(\d+)/);
  return match ? match[1] : null;
}

// ⏱️ recupera ritardo reale
async function getDelay(numeroTreno) {
  try {
    if (!numeroTreno) return 0;

    const response = await axios.get(
      `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/cercaNumeroTreno/${numeroTreno}`,
      { timeout: 8000 }
    );

    const data = response.data;

    if (!data || !data.ritardo) return 0;

    return data.ritardo;

  } catch (err) {
    console.log("Errore ritardo:", err.message);
    return 0;
  }
}

// 🚆 endpoint principale
app.get("/treno", async (req, res) => {
  try {
    const next = getNextTrain();

    if (!next) {
      return res.json({
        speech: "Non ci sono più treni per Milano oggi"
      });
    }

    const tripInfo = trips.find(t => t.trip_id === next.trip_id);

    const numeroTreno = extractTrainNumber(tripInfo);

    console.log("Trip ID:", next.trip_id);
    console.log("Numero treno:", numeroTreno);

    const ritardo = await getDelay(numeroTreno);

    let frase = `Il prossimo treno per Milano parte alle ${next.time}`;

    if (ritardo === 0) {
      frase += " ed è in orario";
    } else {
      frase += ` ed ha ${ritardo} minuti di ritardo`;
    }

    return res.json({ speech: frase });

  } catch (err) {
    console.error("Errore:", err);

    return res.json({
      speech: "Errore nel recupero dei dati"
    });
  }
});

// 🧪 test base
app.get("/", (req, res) => {
  res.send("API treni reale attiva 🚆");
});

// 🚀 avvio server
Promise.all([loadStopTimes(), loadTrips()]).then(() => {
  app.listen(PORT, () => {
    console.log("Server attivo su porta " + PORT);
  });
});