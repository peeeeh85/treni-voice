const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const STATION = "S01738"; // 👈 preso dal tuo dataset (uno valido)

// 🚆 prendi partenze REALI dalla stazione
async function getDepartures() {
  const res = await axios.get(
    `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${STATION}`,
    { timeout: 8000 }
  );

  return res.data;
}

// 🧠 prossimo treno
function pickNext(data) {
  const now = new Date(
    new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })
  );

  const current = now.getHours() * 60 + now.getMinutes();

  const list = data
    .map(t => {
      const time = t.oraPartenza || t.orarioPartenza;

      if (!time) return null;

      const [h, m] = time.split(":").map(Number);

      return {
        time,
        minutes: h * 60 + m,
        numeroTreno: t.numeroTreno,
        destinazione: t.destinazione
      };
    })
    .filter(Boolean)
    .filter(t => t.minutes >= current)
    .sort((a, b) => a.minutes - b.minutes);

  return list[0];
}

// ⏱️ ritardo reale
async function getDelay(num) {
  try {
    if (!num) return 0;

    const res = await axios.get(
      `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/cercaNumeroTreno/${num}`,
      { timeout: 8000 }
    );

    return res.data?.ritardo || 0;
  } catch (e) {
    return 0;
  }
}

// 🚆 API
app.get("/treno", async (req, res) => {
  try {
    const data = await getDepartures();

    const next = pickNext(data);

    if (!next) {
      return res.json({
        speech: "Nessun treno disponibile al momento"
      });
    }

    const ritardo = await getDelay(next.numeroTreno);

    let speech = `Il prossimo treno per Milano parte alle ${next.time}`;

    speech += ritardo
      ? ` ed ha ${ritardo} minuti di ritardo`
      : " ed è in orario";

    return res.json({ speech });

  } catch (err) {
    return res.json({
      speech: "Errore nel recupero dati treni"
    });
  }
});

app.listen(PORT, () => {
  console.log("Server attivo");
});