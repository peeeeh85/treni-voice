const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const STATION = "S01104";

// 🚆 prendi treni REALI già con ritardo
async function getNextTrain() {
  const res = await axios.get(
    `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${STATION}`
  );

  const data = res.data;

  if (!Array.isArray(data) || data.length === 0) return null;

  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const current = now.getHours() * 60 + now.getMinutes();

  const parsed = data
    .map(t => {
      const time = t.orarioPartenza || t.oraPartenza || t.orario;

      if (!time) return null;

      const [h, m] = time.split(":").map(Number);

      return {
        time,
        minutes: h * 60 + m,
        numeroTreno: t.numeroTreno,
        ritardo: t.ritardo || 0,
        destinazione: t.destinazione
      };
    })
    .filter(Boolean)
    .filter(t => t.minutes >= current)
    .sort((a, b) => a.minutes - b.minutes);

  return parsed[0] || null;
}

// 🚆 API
app.get("/treno", async (req, res) => {
  try {
    const next = await getNextTrain();

    if (!next) {
      return res.json({
        speech: "Non ci sono treni disponibili al momento"
      });
    }

    let speech = `Il prossimo treno per Milano parte alle ${next.time}`;

    if (!next.ritardo || next.ritardo === 0) {
      speech += " ed è in orario";
    } else {
      speech += ` ed ha ${next.ritardo} minuti di ritardo`;
    }

    return res.json({ speech });

  } catch (err) {
    console.log(err.message);

    return res.json({
      speech: "Errore nel recupero dati treni"
    });
  }
});

app.get("/", (req, res) => {
  res.send("API treni reale attiva 🚆");
});

app.listen(PORT, () => {
  console.log("Server attivo su porta " + PORT);
});