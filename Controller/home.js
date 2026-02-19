
// controllers/influxController.js
import { influxDB,INFLUX_ORG,INFLUX_BUCKET } from '../db/influx.js';
import { flux } from '@influxdata/influxdb-client';

// 🛠️ Organize InfluxDB data
function organizeData(rawData) {
  const result = {};

  rawData.forEach(item => {
    const line = item.LINE;      // Example: Front_Line, RB, RC
    const field = item._field;   // Example: HRP06:00, OEE, Quality
    const time = item._time;     // Example: 2025-09-08T04:33:28Z
    const value = item._value;   // Example: 11

    // ✅ Create a new line group if not exist
    if (!result[line]) {
      result[line] = {};
    }

    // ✅ Create a new field group if not exist
    if (!result[line][field]) {
      result[line][field] = [];
    }

    // ✅ Push data into that field
    result[line][field].push({ time, value });
  });

  return result;
}
// ya bheee mena addd kra khud necha ka 

function computeJPH(organizedData) {
  const hrpFields = [
    "HRP06:00","HRP07:00","HRP08:00","HRP09:00",
    "HRP10:00","HRP11:00","HRP12:00","HRP13:00"
  ];

  for (const line of Object.keys(organizedData)) {
    let total = 0, count = 0;

    hrpFields.forEach(field => {
      if (organizedData[line][field]) {
        organizedData[line][field].forEach(d => {
          total += Number(d.value) || 0;
          count++;
        });
      }
    });

    // store average JPH (or 0 if no HRP data)
    organizedData[line].JPH = count > 0 ? total / count : 0;
  }
  return organizedData;  
}

 // yha tkkk 



const ORG = INFLUX_ORG;
const DEFAULT_BUCKET = INFLUX_BUCKET;

export async function checkConnection(req, res) {
  try {
    const ok = await isInfluxHealthy();
    if (!ok) return res.status(500).json({ success: false, message: 'Influx is not healthy' });
    res.json({ success: true, message: 'Influx connected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Health check failed', error: err?.message });
  }
}
export async function queryData(req, res) {
  try {
    const queryApi = influxDB.getQueryApi(ORG);

    const bucket = DEFAULT_BUCKET;
    const rangeInput = req.query.range || "-12h";
    const limit = Number(req.query.limit || 100);

    const fluxQuery = `
from(bucket: "${bucket}")
  |> range(start: ${rangeInput})
  |> filter(fn: (r) =>
      r._measurement == "Performance" or
      r._measurement == "QUALITY"
  )
  |> filter(fn: (r) =>
      r.LINE == "Front_Line" or
      r.LINE == "RB" or
      r.LINE == "RC"
  )
  |> filter(fn: (r) =>
      r._field == "Quality" or
      r._field == "OEE" or
      r._field == "Pass" or
      r._field == "Reject" or
      r._field == "Rework" or
      r._field == "Productivity" or
      r._field == "Avail" or
      r._field == "Total_Prod_Today"
  )
  |> aggregateWindow(every: 10m, fn: mean, createEmpty: false)
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${limit})
`;

    console.log("Final Flux Query:\n", fluxQuery);

    const rows = await queryApi.collectRows(fluxQuery);

    let organized = organizeData(rows);
    organized = computeJPH(organized);

    return res.json({
      success: true,
      data: organized,
    });

  } catch (err) {
    console.error("Influx query error:", err);

    return res.status(500).json({
      success: false,
      message: "Query failed",
      error: err.message,
    });
  }
}

