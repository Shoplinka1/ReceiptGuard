import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// CORS — restrict to known origin in production, open in development
const corsOrigin: cors.CorsOptions["origin"] =
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL ?? false
    : true;
app.use(cors({ origin: corsOrigin, credentials: true }));

// Raw body capture for Paystack webhook signature verification.
// Must be registered BEFORE express.json() so the webhook route
// receives the untouched byte stream that Paystack signed.
app.use(
  "/api/paystack/webhook",
  express.raw({ type: "application/json" }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(router);

export default app;
