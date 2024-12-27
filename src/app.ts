import "./sentry";
import cookieParser from "cookie-parser"
import express, { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import dotenv from "dotenv";
import cors from "cors";
import { _jwt_payload } from "./types/models.type";

dotenv.config();

const allowedOrigins = ["http://localhost:3000", "https://fb1f-31-35-73-93.ngrok-free.app"]; // Liste des origines autorisées
const app = express();
app.use(cookieParser())
app.use(express.json())
const PORT = process.env.PORT || 80;

// Middleware
Sentry.setupExpressErrorHandler(app);

app.use(
  cors({
    origin: (origin, callback) => {

      if (allowedOrigins.includes(origin || "")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Autorise les cookies et les headers d'authentification
  })
);

// Routes de base
app.get("/", (req: Request, res: Response) => {
  res.send("Bienvenue sur le serveur !");
});

// Importer les routes d'API
import apiRoutes from "./routes/api";
app.use("/api", apiRoutes);

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});


declare global {
  namespace Express {
    interface Request {
      user?: _jwt_payload
    }
  }
}
