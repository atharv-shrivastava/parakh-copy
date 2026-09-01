import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'parakh-backend',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/dashboard/summary', (_req, res) => {
  res.json({
    inspectionsToday: 24,
    potentialViolations: 7,
    pendingVerification: 5,
    complianceRate: 82
  });
});

app.listen(PORT, () => {
  console.log(`PARAKH API running on port ${PORT}`);
});
