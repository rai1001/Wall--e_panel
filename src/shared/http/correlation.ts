import { RequestHandler } from "express";
import { createId } from "../id";

export const attachCorrelationId: RequestHandler = (req, res, next) => {
  const fromHeader = req.header("x-correlation-id");
  req.correlationId = fromHeader && fromHeader.trim().length > 0 ? fromHeader : createId("corr");
  res.setHeader("x-correlation-id", req.correlationId);
  next();
};
