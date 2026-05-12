const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// 🚆 Simulazione realistica treni Pieve Emanuele → Milano
const treni = [
  { ora: "12:05", ritardo: 0 },
  { ora: "12:20", ritardo: 2 },
  { ora: "12:35", ritardo: 0 },
  { ora: "12:50", ritardo: 5 },
  { ora: "13:05", ritardo: 0 },
  { ora: "13:20", ritardo: 3 },
  { ora: "13:35", ritardo: 0 },
  { ora: "13:50", ritardo: 1 }
];

app.get("/treno", (req, res) => {
  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let prossimo = null;

    for (const t of treni) {
      const [h, m] = t.ora.split(":").map(Number);
      const minutes = h * 60 + m;

      if (minutes >= currentMinutes) {
        prossimo = t;
        break;
      }
    }

    if (!prossimo) {
      return res.json({
        speech: "Non ci sono altri treni per Milano oggi"
      });
    }

    return res.json({
      speech: `Il prossimo treno per Milano parte alle ${prossimo.ora} e ha ${prossimo.ritardo} minuti di ritardo`
    });

  } catch (err) {
    console.error("Errore server:", err);

    return res.json({
      speech: "Errore nel calcolo del prossimo treno"
    });
  }
});

// endpoint test base
app.get("/", (req, res) => {
  res.send("API treni attiva 🚆");
});

app.listen(PORT, () => {
  console.log("Server attivo sulla porta " + PORT);
});