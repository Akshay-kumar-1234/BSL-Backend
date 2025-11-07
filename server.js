import express from 'express'
import compression from "compression";
import cors from 'cors'
import dotenv from 'dotenv';
// import home from "./Routes/home.js";
import InfluxRouter from './Routes/home.js';
dotenv.config();
app.use(express.json())
const app = express();

// ✅ Enable gzip compression for all responses
app.use(compression());
app.use(cors({
  origin: "*", // allow any origin
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // allow all HTTP methods
  allowedHeaders: "*", // allow any headers
}));

// app.options("*", (req, res) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
//   res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
//   res.sendStatus(200);
// });


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

