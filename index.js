const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
const PORT = process.env.PORT || 3000;

const STOP_ID = "S01104";

let stopTimes = [];

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
        minutes
      };
    })
    .filter(Boolean)
    .filter((t) => t.minutes >= currentMinutes)
    .sort((a, b) => a.minutes - b.minutes);

  return future[0];
}

app.get("/treno", (req, res) => {
  const next = getNextTrain();

  if (!next) {
    return res.json({
      speech: "Non ci sono più treni disponibili oggi"
    });
  }

  return res.json({
    speech: `Il prossimo treno per Milano parte alle ${next.time}`
  });
});

loadGTFS().then(() => {
  app.listen(PORT, () => {
    console.log("GTFS server attivo su porta " + PORT);
  });
});