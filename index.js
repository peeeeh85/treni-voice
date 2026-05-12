const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const STAZIONE_ID = "S05037";

app.get("/treno", async (req, res) => {
  try {
    const response = await axios.get(
      `http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${STAZIONE_ID}`
    );

    const treni = response.data;

    const filtrati = treni
      .filter(t => t.destinazione.includes("MILANO"))
      .sort((a, b) => a.orarioPartenza - b.orarioPartenza);

    if (filtrati.length === 0) {
      return res.json({
        speech: "Non ci sono treni per Milano nelle prossime ore"
      });
    }

    const prossimo = filtrati[0];

    const orario = new Date(prossimo.orarioPartenza).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const ritardo = prossimo.ritardo || 0;

    const risposta = `Il prossimo treno per Milano parte alle ${orario} e ha ${ritardo} minuti di ritardo`;

    res.json({ speech: risposta });

  } catch (err) {
    console.error(err);
    res.json({
      speech: "Errore nel recupero dei dati"
    });
  }
});

app.listen(PORT, () => {
  console.log("Server attivo su porta " + PORT);
});