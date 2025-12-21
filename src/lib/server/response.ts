import type { NextApiResponse } from "next";

export function json(res: NextApiResponse, status: number, body: unknown) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function error(res: NextApiResponse, status: number, message: string) {
  json(res, status, { error: message });
}
