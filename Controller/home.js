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

const ORG = INFLUX_ORG;
const DEFAULT_BUCKET = INFLUX_BUCKET;

async function isInfluxHealthy() {
  let startTime = Date.now();
  try {
    console.log("🔍 Starting health check to InfluxDB...");
    const queryApi = influxDB.getQueryApi(ORG);
    
    const result = await queryApi.collectRows(
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
export async function queryData(req, res) {
  try {
    const queryApi = influxDB.getQueryApi(ORG);

    const bucket = DEFAULT_BUCKET;
    const rangeInput = req.query.range || "-2h";
    const limit = Number(req.query.limit || 100);

    console.log("Bucket:", bucket);
    console.log("Range:", rangeInput);

    let q = `
performance = from(bucket: "${bucket}")
  |> range(start: ${rangeInput})
  |> filter(fn: (r) => r._measurement == "Performance" or r._measurement == "QUALITY")
  |> filter(fn: (r) => r.LINE == "Front_Line" or r.LINE == "RB" or r.LINE == "RC")
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

quality = from(bucket: "${bucket}")
  |> range(start: ${rangeInput})
  |> filter(fn: (r) => r._measurement == "QUALITY")
  |> filter(fn: (r) => r.LINE == "Front_Line" or r.LINE == "RB" or r.LINE == "RC")
  |> filter(fn: (r) => r._field == "reject" or r._field == "rework")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${limit})

union(tables: [performance, quality])
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${limit})
`;

    console.log("Flux Query:\n", q);

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
    console.error("❌ Influx query error:", err?.message);
    console.error("Stack:", err?.stack);
    return res.status(500).json({
      success: false,
      message: "Query failed",
      error: err?.message,
    });
  }
}