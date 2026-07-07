import express, { type Express, type Request, type Response, type NextFunction } from "express";
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

// CORS configuration.
//
// Development: allow all origins (open).
// Production: allow only origins explicitly listed in FRONTEND_URL (comma-separated)
//   plus server-to-server requests (no Origin header, e.g. Vercel proxy).
//   If FRONTEND_URL is not set in production the server starts but rejects all
//   browser cross-origin requests — this is intentional fail-closed behaviour.
//   Set FRONTEND_URL to the frontend domain(s) to permit browser traffic.
const rawFrontendUrls = (process.env.FRONTEND_URL ?? "").trim();
const allowedOrigins = rawFrontendUrls
  ? rawFrontendUrls.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const isProduction = process.env.NODE_ENV === "production";

const corsOrigin: cors.CorsOptions["origin"] = isProduction
  ? (origin, callback) => {
      // No Origin header = server-to-server request (e.g. Vercel proxy). Always allow.
      if (!origin) return callback(null, true);
      // Browser cross-origin: only listed origins are permitted.
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin "${origin}" is not allowed`));
    }
  : true; // Development: allow all origins

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

// Global error handler — catches any unhandled async errors from route handlers.
// Without this, Express 5 propagates them as a plain 500 HTML response.
// Must be 4 arguments for Express to recognise it as an error handler.
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, 'Unhandled route error');
  if (res.headersSent) return next(err);
  // Return a generic message in production to avoid leaking internal details.
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (err.message ?? 'Internal server error');
  res.status(500).json({ error: message });
});

export default app;
