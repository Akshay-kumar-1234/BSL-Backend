
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
    // 1️⃣ Create queryApi FIRST
    const queryApi = influxDB.getQueryApi(ORG);

    // 2️⃣ Setup params
    const bucket = DEFAULT_BUCKET;
    const field = req.query.field;
    const rangeInput = req.query.range || "-12h";
    const limit = Number(req.query.limit || 100);

    console.log("Bucket:", bucket);
    console.log("Range:", rangeInput);


let q = `
performance = from(bucket: "${bucket}")
  |> range(start: ${rangeInput})
  |> filter(fn: (r) => r._measurement == "Performance")
  |> filter(fn: (r) => r.LINE == "Front_Line" or r.LINE == "RB" or r.LINE == "RC")
  |> filter(fn: (r) =>
      r._field == "Quality" or 
      r._field == "OEE" or 
      r._field == "JPH" or
      r._field == "Pass" or 
      r._field == "Reject" or 
      r._field == "Rework" or
      r._field == "HRP06:00" or 
      r._field == "HRP07:00" or 
      r._field == "HRP08:00" or 
      r._field == "HRP09:00" or 
      r._field == "HRP10:00" or 
      r._field == "HRP11:00" or 
      r._field == "HRP12:00" or 
      r._field == "HRP13:00" or 
      r._field == "total_production_set" or
      r._field == "Productivity" or
      r._field == "Avail" or
      r._field == "Total_Prod_Today"
  )

quality = from(bucket: "${bucket}")
  |> range(start: ${rangeInput})
  |> filter(fn: (r) => r._measurement == "QUALITY")
  |> filter(fn: (r) => r.LINE == "Front_Line" or r.LINE == "RB" or r.LINE == "RC")
  |> filter(fn: (r) => r._field == "reject" or r._field == "rework")

union(tables: [performance, quality])
  |> sort(columns: ["_time"], desc: true)
`;


    if (field) {
      q += flux`|> filter(fn: (r) => r._field == ${field})\n`;
    }

    const tags = []
      .concat(req.query.tag || [])
      .filter(Boolean)
      .map((t) => {
        const [k, ...rest] = String(t).split("=");
        return [k, rest.join("=")];
      })
      .filter(([k, v]) => k && v);

    for (const [k, v] of tags) {
      q += flux`|> filter(fn: (r) => r[${k}] == ${v})\n`;
    }

    q += flux`
    |> sort(columns: ["_time"], desc: true)
    `;

    console.log("Final Flux:\n", String(q));

    // 4️⃣ Run query AFTER building it
    const rows = await queryApi.collectRows(q);

    // 5️⃣ Organize rows (group by LINE + field)
    let organized = organizeData(rows);

    // joo mena add kri badd ma dekhoo necha 
      organized = computeJPH(organized);

    // 6️⃣ Return ONLY organized data
    return res.json({
      success: true,
      data: organized,
      // flux: String(q), // keep flux for debugging
    });
  } catch (err) {
    console.error("Influx query error:", err);
    return res.status(500).json({
      success: false,
      message: "Query failed",
      error: err?.message,
    });
  }
}















