import { RequestHandler } from "express";

export function deprecationHeaders(options: { sunset: string; link?: string }): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", options.sunset);
    if (options.link) {
      res.setHeader("Link", `<${options.link}>; rel="successor-version"`);
    }
    next();
  };
}
