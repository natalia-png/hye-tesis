// backend/src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API Plataforma Arquitectónica funcionando 🚀");
});

app.listen(4000, () => {
  console.log("Servidor backend en http://localhost:4000");
});
