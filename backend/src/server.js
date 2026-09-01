import express from "express";
import cors from "cors";
import categoriesRouter from "./routes/categories.js";
import productsRouter from "./routes/products.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ message: "PARAKH backend is running" });
});

app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`PARAKH backend running on http://localhost:${PORT}`);
});
