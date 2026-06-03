
import { InfluxDB } from '@influxdata/influxdb-client';
import { BucketsAPI } from '@influxdata/influxdb-client-apis';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.INFLUX_URL || "http://20.198.22.6:8086";
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET || "SHIFT_A";

if (!token) {
  console.error("❌ INFLUX_TOKEN not set in .env file!");
  process.exit(1);
}

if (!org) {
  console.error("❌ INFLUX_ORG not set in .env file!");
  process.exit(1);
}

console.log(`📡 Connecting to InfluxDB: ${url}`);
console.log(`🏢 Organization: ${org}`);
console.log(`📦 Bucket: ${bucket}`);

export const influxDB = new InfluxDB({ 
  url, 
  token,
  timeout: 30000,  // 30 second timeout for all requests
  retryAttempts: 2,
  retryDelay: 1000
});
export const bucketsAPI = new BucketsAPI(influxDB);

export const INFLUX_ORG = org;
export const INFLUX_BUCKET = bucket;

console.log("✅ InfluxDB client initialized");