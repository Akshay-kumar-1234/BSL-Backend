
import { InfluxDB } from '@influxdata/influxdb-client';
import { BucketsAPI } from '@influxdata/influxdb-client-apis';

const url ="http://20.198.22.6:8086"
const token = "Y__1DCnm2uTaCeqnTy2Xe6AScyzrM1zSwfrPBiXy9ZjuxEx5DAWfOz4BD-weu0NyQDeR7ig_uBaj2k8B8gKc9A=="
const org = "BSL Kharkhoda";  // 👈 ADD THIS (must match InfluxDB Org exactly!)
const bucket = "SHIFT_A";
export const influxDB = new InfluxDB({ url, token, });
export const bucketsAPI = new BucketsAPI(influxDB);


export const INFLUX_ORG = org;
export const INFLUX_BUCKET = bucket;


console.log(url, "connected ✅");