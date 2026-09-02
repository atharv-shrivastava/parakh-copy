import crypto from "node:crypto";
import prisma from "../lib/prisma.js";

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function makePasswordHash(password) {
  if (typeof password !== "string" || password.length < 6) throw new Error("Password must be at least 6 characters");
  return hashPassword(password);
}

export function checkPassword(password, stored) {
  try { return verifyPassword(password, stored); } catch { return false; }
}

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Authentication required" });
    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) return res.status(401).json({ error: "Session expired" });
    req.user = session.user;
    req.session = session;
    next();
  } catch (error) { next(error); }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Admin access required" });
  next();
}
