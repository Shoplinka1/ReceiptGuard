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

// CORS — in production, allow every origin listed in FRONTEND_URL (comma-separated).
// If FRONTEND_URL is not set the server falls back to permissive (all origins) so
// the app keeps working during initial deployment; set FRONTEND_URL on your host to
// lock it down once the production URL is stable.
const rawFrontendUrls = (process.env.FRONTEND_URL ?? "").trim();
const allowedOrigins = rawFrontendUrls
  ? rawFrontendUrls.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const corsOrigin: cors.CorsOptions["origin"] =
  process.env.NODE_ENV !== "production" || allowedOrigins.length === 0
    ? true // open: dev mode, or prod without FRONTEND_URL configured
    : (origin, callback) => {
        // Allow server-to-server requests (no Origin header) and listed origins.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin "${origin}" is not allowed`));
        }
      };

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
