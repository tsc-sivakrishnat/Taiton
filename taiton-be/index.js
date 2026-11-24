const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { testConnection } = require('./src/resources/connection');
const cpanelRoutes = require('./src/main/routes/api.routes');

// 1. Base / fallback .env
dotenv.config();

// 2. Load environment variables dynamically based on NODE_ENV (development vs production) with override
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env.development';
const envFilePath = path.join(__dirname, envFile);

if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath, override: true });
}

const app = express();
const PORT = process.env.PORT || 8788;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploads folder statically
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/cpanel-api/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Favicon handler to avoid 404/503 browser noise
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health Check Routes
app.get('/health', async (req, res) => {
  const dbConnected = await testConnection();
  const statusCode = dbConnected ? 200 : 503;
  res.status(statusCode).json({
    status: 'online',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/db', async (req, res) => {
  const dbConnected = await testConnection();
  if (dbConnected) {
    return res.status(200).json({
      success: true,
      status: 'connected',
      database: process.env.DB_NAME || 'u418448115_taiton_cpanel1',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
    });
  } else {
    return res.status(503).json({
      success: false,
      status: 'disconnected',
      database: process.env.DB_NAME || 'u418448115_taiton_cpanel1',
      error: 'Could not establish connection to MySQL database server',
    });
  }
});

// Primary CPanel API Routes mounted under /cpanel-api and /api
app.use('/cpanel-api', cpanelRoutes);
app.use('/api', cpanelRoutes);

// Serve frontend static build if available
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const localDistPath = path.join(__dirname, 'public/dist');
const directPublicPath = path.join(__dirname, 'public');

let targetDist = null;
if (fs.existsSync(path.join(frontendDistPath, 'index.html'))) {
  targetDist = frontendDistPath;
} else if (fs.existsSync(path.join(localDistPath, 'index.html'))) {
  targetDist = localDistPath;
} else if (fs.existsSync(path.join(directPublicPath, 'index.html'))) {
  targetDist = directPublicPath;
}

if (targetDist) {
  app.use(express.static(targetDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/cpanel-api') && !req.path.startsWith('/api') && !req.path.startsWith('/health') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(targetDist, 'index.html'));
    }
    next();
  });
} else {
  // Root Route for API when frontend is hosted separately
  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'Taiton CPanel API',
      status: 'online',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        dbHealth: '/health/db',
        cpanelApi: '/cpanel-api',
      },
    });
  });
}

// Global 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Start listening immediately so Hostinger/Passenger/Proxy does not time out with 503
const server = app.listen(PORT, () => {
  console.log(`[Server] Taiton Backend running on port ${PORT}`);

  // Verify Database Connection asynchronously in background without delaying port binding
  testConnection()
    .then((isDbConnected) => {
      if (!isDbConnected) {
        console.warn('[Server] Warning: Proceeding without verified database connection.');
      } else {
        console.log('[Server] Database verified and ready.');
      }
    })
    .catch((err) => {
      console.error('[Server] Database check error:', err.message);
    });
});


