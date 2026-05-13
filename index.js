const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
const PORT = process.env.PORT || 3000;

const STOP_ID = "S01104";

let stopTimes = [];

const axios = require("axios");

// 🧠 esempio: estrai numero treno dal trip_id
function extractTrainNumber(tripId) {
  // dipende dal GTFS, esempio semplice:
  return tripId.replace(/\D/g, "").slice(0, 5);
}

async function getDelay(tripId) {
  try {
    const numeroTreno = extractTrainNumber(tripId);

    const response = await axios.get(
      `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/cercaNumeroTreno/${numeroTreno}`,
      {
        timeout: 8000
      }
    );

    const data = response.data;

    if (!data || !data.ritardo) return 0;

    return data.ritardo;

  } catch (err) {
    console.log("Errore ritardo:", err.message);
    return 0;
  }
}

// 📥 carica GTFS
function loadGTFS() {
  return new Promise((resolve) => {
    const results = [];

    fs.createReadStream("./gtfs/stop_times.txt")
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        stopTimes = results;
        resolve();
      });
  });
}

// 🧠 calcolo prossimo treno reale
function getNextTrain() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" })
  );

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const filtered = stopTimes.filter((s) => s.stop_id === STOP_ID);

  const future = filtered
    .map((s) => {
      if (!s.arrival_time) return null;

      const [h, m] = s.arrival_time.split(":");
      const minutes = parseInt(h) * 60 + parseInt(m);

      return {
        time: s.arrival_time,
        minutes,
		trip_id: s.trip_id
      };
    })
    .filter(Boolean)
    .filter((t) => t.minutes >= currentMinutes)
    .sort((a, b) => a.minutes - b.minutes);

  return future[0];
}

app.get("/treno", async (req, res) => {
  try {
    const next = getNextTrain();

    if (!next) {
      return res.json({
        speech: "Non ci sono più treni per Milano oggi"
      });
    }

    // 🔥 qui serve trip_id (devi salvarlo prima)
    const tripId = next.trip_id;

    const ritardo = await getDelay(tripId);

    let frase = `Il prossimo treno per Milano parte alle ${next.time}`;

    if (ritardo === 0) {
      frase += " ed è in orario";
    } else {
      frase += ` ed ha ${ritardo} minuti di ritardo`;
    }

    return res.json({ speech: frase });

  } catch (err) {
    return res.json({
      speech: "Errore nel recupero dei dati"
    });
  }
});

loadGTFS().then(() => {
  app.listen(PORT, () => {
    console.log("GTFS server attivo su porta " + PORT);
  });
});