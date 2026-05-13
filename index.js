const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const STATION = "S01104";

// 🧠 STEP 1: prendi lista partenze (RAW HTML-ish, ma funziona)
async function getDepartures() {
  const res = await axios.get(
    `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${STATION}`,
    { timeout: 8000 }
  );

  return res.data;
}

// 🧠 STEP 2: estrai primo treno valido
function pickNext(raw) {
  if (!Array.isArray(raw)) return null;

  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const current = now.getHours() * 60 + now.getMinutes();

  const parsed = raw
    .map(t => {
      const time = t.oraPartenza || t.orarioPartenza;

      if (!time) return null;

      const [h, m] = time.split(":").map(Number);

      return {
        time,
        minutes: h * 60 + m,
        numeroTreno: t.numeroTreno
      };
    })
    .filter(Boolean)
    .filter(t => t.minutes >= current)
    .sort((a, b) => a.minutes - b.minutes);

  return parsed[0];
}

// 🧠 STEP 3: ritardo reale (QUESTO è il punto chiave)
async function getDelay(numeroTreno) {
  try {
    if (!numeroTreno) return 0;

    const res = await axios.get(
      `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/cercaNumeroTreno/${numeroTreno}`,
      { timeout: 8000 }
    );

    const data = res.data;

    return data?.ritardo || 0;

  } catch (e) {
    console.log("delay error:", e.message);
    return 0;
  }
}

// 🚆 API
app.get("/treno", async (req, res) => {
  try {
    const raw = await getDepartures();

    const next = pickNext(raw);

    if (!next) {
      return res.json({
        speech: "Non ci sono treni disponibili"
      });
    }

    const ritardo = await getDelay(next.numeroTreno);

    let speech = `Il prossimo treno per Milano parte alle ${next.time}`;

    if (ritardo === 0) {
      speech += " ed è in orario";
    } else {
      speech += ` ed ha ${ritardo} minuti di ritardo`;
    }

    return res.json({ speech });

  } catch (err) {
    console.log("ERROR:", err.message);

    return res.json({
      speech: "Errore nel recupero dati treni"
    });
  }
});

app.listen(PORT, () => {
  console.log("Server attivo");
});