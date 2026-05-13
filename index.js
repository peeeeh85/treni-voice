const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const ORIGINE = "S01104";     // Pieve Emanuele
const DESTINAZIONE = "S01801"; // Locate Triulzi

// 🚆 prendi lista treni già pronta da ViaggiaTreno
async function getTrains() {
  const url = `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/dettaglioViaggio/${ORIGINE}/${DESTINAZIONE}`;

  const res = await axios.get(url, {
    timeout: 50000,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  return res.data;
}

// 🧠 prendi prossimo treno valido
function pickNext(trains) {
  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return trains
    .map(t => {
      const [h, m] = (t.compOrarioPartenza || "").split(":").map(Number);

      if (isNaN(h) || isNaN(m)) return null;

      return {
        ...t,
        minutes: h * 60 + m
      };
    })
    .filter(Boolean)
    .filter(t => t.minutes >= currentMinutes)
    .sort((a, b) => a.minutes - b.minutes)[0];
}

// 🚆 API
app.get("/treno", async (req, res) => {
  try {
    const url =
      "http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/dettaglioViaggio/S01104/S01801";

    const response = await axios.get(url, { timeout: 10000 });

    const trains = response.data;

    if (!Array.isArray(trains) || trains.length === 0) {
      return res.json({ speech: "Nessun treno disponibile" });
    }

    const next = pickNext(trains);

    if (!next) {
      return res.json({ speech: "Nessun treno futuro trovato" });
    }

    const delay = next.ritardo || 0;

    let speech = `Il prossimo treno da Pieve Emanuele a Locate Triulzi è previsto alle ${next.compOrarioPartenza}`;

    speech += delay > 0
      ? ` ed ha un ritardo di ${delay} minuti`
      : " ed è in orario";

    res.json({ speech });

  } catch (e) {
    console.log(e.message);
    res.json({ speech: "Errore nel recupero dati treni" });
  }
});

app.listen(PORT, () => {
  console.log("🚆 Server attivo");
});