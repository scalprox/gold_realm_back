import "./sentry";
import "./scheduler/scheduler.ts"
import cookieParser from "cookie-parser"
import apiRoutes from "./routes/api.routes";
import * as Sentry from "@sentry/node";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { _jwt_payload, _staked_nft } from "./types/models.type";

dotenv.config();

const allowedOrigins = ["http://localhost:3000", "https://fb1f-31-35-73-93.ngrok-free.app"]; // Liste des origines autorisées
const app = express();
app.use(cookieParser())
app.use(express.json())
const PORT = process.env.PORT || 5000;

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

app.use((req, res, next) => {

  console.log(`${req.headers.host} => ${req.path} at ${new Date().toISOString()}`);
  next()

})
//test

// Routes de base

app.use("/api", apiRoutes);

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});


declare global {
  namespace Express {
    interface Request {
      user?: _jwt_payload
      nftList: {
        toClaim?: _staked_nft[]
        lostNft?: _staked_nft[]
        toSend?: _staked_nft[]
      }
    }
  }
}
