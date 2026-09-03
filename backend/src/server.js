import express from "express";
import cors from "cors";
import categoriesRouter from "./routes/categories.js";
import productsRouter from "./routes/products.js";
import authRouter from "./routes/auth.js";
import shopsRouter from "./routes/shops.js";
import adminRouter from "./routes/admin.js";
import rulesRouter from "./routes/rules.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "25mb" }));

app.get("/", (_req, res) => res.json({ message: "PARAKH backend is running" }));
app.get("/health", (_req, res) => res.json({ status: "ok", service: "parakh-backend" }));
app.use("/api/auth", authRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/shops", shopsRouter);
app.use("/api/rules", rulesRouter);
app.use("/api/admin", adminRouter);

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => console.log(`PARAKH backend running on http://localhost:${PORT}`));
