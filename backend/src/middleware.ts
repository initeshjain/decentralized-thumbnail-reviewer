import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, WORKER_JWT_SECRET } from "./config";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] ?? "";

  try {
    const decoded = jwt.verify(authHeader, JWT_SECRET);
    // @ts-ignore
    if (decoded.userId) {
      // @ts-ignore
      req.userId = decoded.userId;
      next();
    } else {
      return res.status(401).json({
        ok: false,
        message: "not authorized"
      })
    }
  } catch (e) {
    console.error(e);
    return res.status(401).json({
      ok: false,
      message: "not authorized"
    })
  }

}

export function workerAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] ?? "";

  try {
    const decoded = jwt.verify(authHeader, WORKER_JWT_SECRET);
    // @ts-ignore
    if (decoded.userId) {
      // @ts-ignore
      req.userId = decoded.userId;
      next();
    } else {
      return res.status(401).json({
        ok: false,
        message: "not authorized"
      })
    }
  } catch (e) {
    console.error(e);
    return res.status(401).json({
      ok: false,
      message: "not authorized"
    })
  }
}