import express from "express";
import cors from "cors";
import categoriesRouter from "./routes/categories.js";
import productsRouter from "./routes/products.js";
import authRouter from "./routes/auth.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "25mb" }));

app.get("/", (_req, res) => res.json({ message: "PARAKH backend is running" }));
app.get("/health", (_req, res) => res.json({ status: "ok", service: "parakh-backend" }));
app.use("/api/auth", authRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => console.log(`PARAKH backend running on http://localhost:${PORT}`));
