import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv';
// import home from "./Routes/home.js";
import InfluxRouter from './Routes/home.js';
dotenv.config();
const app = express();
app.use(express.json())

// ✅ Enable gzip compression for all responses
app.use(cors({
  origin: "*", // allow any origin
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // allow all HTTP methods
  allowedHeaders: "*", // allow any headers
  exposedHeaders: ["X-Requested-With", "Content-Type", "Accept", "Authorization"],
}));

// Explicit CORS headers for any route, including errors
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});


app.get('/', (req, res) => {
  res.json({ message: "hiii " })
});


//Api route made by me 
app.use('/influx',InfluxRouter);


// // const Server=app.listen(3001)  // this already present 
 const PORT = process.env.PORT || 3001; 


// // done by me for the app 
const Server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

