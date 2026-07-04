import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/supabase';

// Extend Express Request to carry the authenticated userId
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/**
 * requireAuth — validates the Supabase JWT in the Authorization header.
 * Sets req.userId on success; responds 401 on failure.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    req.userId = await verifyToken(req.headers.authorization);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * optionalAuth — like requireAuth but doesn't reject unauthenticated requests.
 * Sets req.userId if valid token present, otherwise leaves it undefined.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.headers.authorization) {
      req.userId = await verifyToken(req.headers.authorization);
    }
  } catch {
    // ignore — optional
  }
  next();
}
