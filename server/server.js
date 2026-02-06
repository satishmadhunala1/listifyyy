require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("./config/passport");
const connectDB = require("./config/database");

// Initialize app
const app = express();

/* ===============================
   TRUST PROXY (REQUIRED FOR RENDER)
================================ */
app.set("trust proxy", 1);

/* ===============================
   CORS CONFIG (Vercel Frontend)
================================ */
const allowedOrigins = [
  "http://localhost:5173",
  "https://listifyyy.vercel.app",
  "https://listifyyy.onrender.com"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow Postman / mobile apps
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* ===============================
   BODY PARSER
================================ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   DATABASE CONNECTION
================================ */
connectDB();

/* ===============================
   SESSION STORE (MongoDB)
================================ */
const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: "sessions",
  expires: 1000 * 60 * 60 * 24 * 7, // 7 days
});

store.on("error", (error) => {
  console.error("Session Store Error:", error);
});

/* ===============================
   SESSION CONFIG
================================ */
app.use(
  session({
    name: "listify.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

/* ===============================
   PASSPORT
================================ */
app.use(passport.initialize());
app.use(passport.session());

/* ===============================
   ROUTES
================================ */
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

/* ===============================
   TEST ENDPOINT
================================ */
app.get("/api/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is working!",
    environment: process.env.NODE_ENV,
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    session: req.sessionID ? "Active" : "No session",
    timestamp: new Date().toISOString(),
  });
});

/* ===============================
   HEALTH CHECK
================================ */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

/* ===============================
   ROOT
================================ */
app.get("/", (req, res) => {
  res.json({
    message: "Listify Authentication API",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
  });
});

/* ===============================
   404 HANDLER
================================ */
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Resource not found",
    path: req.originalUrl,
    method: req.method,
  });
});

/* ===============================
   GLOBAL ERROR HANDLER
================================ */
app.use((err, req, res, next) => {
  console.error("Error:", err.message);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

/* ===============================
   GRACEFUL SHUTDOWN
================================ */
const shutdown = () => {
  console.log("Shutting down gracefully...");

  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("MongoDB disconnected");
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error("Force shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

module.exports = app;
