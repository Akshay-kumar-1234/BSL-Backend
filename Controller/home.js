// controllers/influxController.js
import { influxDB, INFLUX_ORG, INFLUX_BUCKET } from '../db/influx.js';
import { flux } from '@influxdata/influxdb-client';

// Organize InfluxDB rows by line and field
function organizeData(rawData) {
  const result = {};

  rawData.forEach(item => {
    const line = item.LINE;
    const field = item._field;
    const time = item._time;
    const value = item._value;

    if (!result[line]) {
      result[line] = {};
    }

    if (!result[line][field]) {
      result[line][field] = [];
    }

    result[line][field].push({ time, value });
  });

  return result;
}

function computeJPH(organizedData) {
  const hrpFields = [
    "HRP06:00","HRP07:00","HRP08:00","HRP09:00",
    "HRP10:00","HRP11:00","HRP12:00","HRP13:00"
  ];

  for (const line of Object.keys(organizedData)) {
    let total = 0;
    let count = 0;

    hrpFields.forEach(field => {
      if (organizedData[line][field]) {
        organizedData[line][field].forEach(d => {
          total += Number(d.value) || 0;
          count++;
        });
      }
    });

    organizedData[line].JPH = count > 0 ? total / count : 0;
  }

  return organizedData;
}

const ORG = INFLUX_ORG;
const DEFAULT_BUCKET = INFLUX_BUCKET;

async function isInfluxHealthy() {
  const startTime = Date.now();
  try {
    console.log("🔍 Starting health check to InfluxDB...");
    const queryApi = influxDB.getQueryApi(ORG);

    await queryApi.collectRows(
      `from(bucket: "${DEFAULT_BUCKET}") |> range(start: -1h) |> limit(n: 1)`
    );

    const duration = Date.now() - startTime;
    console.log(`✅ Health check passed in ${duration}ms`);
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Health check failed after ${duration}ms`);
    console.error("   Error message:", error?.message);
    console.error("   Error code:", error?.code);
    if (error?.response) {
      console.error("   HTTP Status:", error.response.status);
      console.error("   Response body:", error.response.body);
    }
    return false;
  }
}

export async function checkConnection(req, res) {
  try {
    const ok = await isInfluxHealthy();
    if (!ok) {
      return res.status(500).json({ success: false, message: 'Influx is not healthy' });
    }
    return res.json({ success: true, message: 'Influx connected' });
  } catch (err) {
    console.error('Health check catch error:', err);
    return res.status(500).json({ success: false, message: 'Health check failed', error: err?.message });
  }
}

export async function queryData(req, res) {
  try {
    const bucket = DEFAULT_BUCKET;
    const rangeInput = req.query.range || "-2h";
    const limit = Number(req.query.limit || 50);

    const lines = String(req.query.lines || "Front_Line,RB,RC")
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const fields = String(req.query.fields || "Quality,OEE,Pass,Reject,Rework,Productivity,Avail,Total_Prod_Today,reject,rework")
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const lineFilter = lines.length
      ? lines.map((line) => `r.LINE == "${line}"`).join(' or ')
      : 'true';

    const fieldFilter = fields.length
      ? fields.map((field) => `r._field == "${field}"`).join(' or ')
      : 'true';

    const q = `
from(bucket: "${bucket}")
  |> range(start: ${rangeInput})
  |> filter(fn: (r) => ${lineFilter})
  |> filter(fn: (r) => ${fieldFilter})
  |> limit(n: ${limit})
`;

    console.log('Query bucket:', bucket);
    console.log('Query range:', rangeInput);
    console.log('Query lines:', lines);
    console.log('Query fields:', fields);
    console.log('Final Flux query:\n', q);

    const queryApi = influxDB.getQueryApi(ORG);
    const rows = await queryApi.collectRows(q);
    console.log(`Received ${rows.length} rows from InfluxDB`);

    let organized = organizeData(rows);
    organized = computeJPH(organized);

    return res.json({
      success: true,
      data: organized,
      rowCount: rows.length,
    });
  } catch (err) {
    console.error('❌ Influx query error:', err?.message);
    console.error('Stack:', err?.stack);
    return res.status(500).json({
      success: false,
      message: 'Query failed',
      error: err?.message,
    });
  }
}
