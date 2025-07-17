import express from 'express';
import cors from 'cors';
import { Client } from 'ssh2';
import net from 'net';
import pkg from 'pg';

const { Pool } = pkg;

// SSH & DB Config (Hardcoded)
const sshConfig = {
  host: '69.62.84.28',
  port: 22,
  username: 'root',
  password: 'Eltrive@0011',
  keepaliveInterval: 10000,
  keepaliveCountMax: 5,
  readyTimeout: 20000
};

const tunnelConfig = {
  localHost: '127.0.0.1',
  localPort: 55432,
  remoteHost: '127.0.0.1',
  remotePort: 5432
};

const dbConfig = {
  user: 'postgres',
  host: '127.0.0.1',
  database: 'vts_data',
  password: 'Eltrive@0011',
  port: 55432
};

const app = express();
app.use(cors());
app.use(express.json());

let conn = null;
let localServer = null;
let pool = null;

/**
 * Create SSH tunnel with auto-reconnection
 */
function startTunnel() {
  return new Promise((resolve, reject) => {
    if (localServer) {
      console.log('✅ Closing old tunnel server...');
      localServer.close();
      localServer = null;
    }

    conn = new Client();

    conn.on('ready', () => {
      console.log('✅ SSH connection ready.');

      localServer = net.createServer((localSocket) => {
        conn.forwardOut(
          localSocket.remoteAddress || '127.0.0.1',
          localSocket.remotePort || 0,
          tunnelConfig.remoteHost,
          tunnelConfig.remotePort,
          (err, stream) => {
            if (err) {
              console.error('❌ Tunnel error:', err.message);
              localSocket.end();
              return;
            }
            localSocket.pipe(stream).pipe(localSocket);
          }
        );
      }).listen(tunnelConfig.localPort, tunnelConfig.localHost, () => {
        console.log(`✅ Tunnel established: localhost:${tunnelConfig.localPort} → ${tunnelConfig.remoteHost}:${tunnelConfig.remotePort}`);
        resolve();
      });
    });

    conn.on('error', (err) => {
      console.error('❌ SSH error:', err.message);
      setTimeout(() => {
        console.log('🔁 Reconnecting SSH...');
        startTunnel().catch(console.error);
      }, 5000);
    });

    conn.on('close', () => {
      console.error('❌ SSH connection closed.');
      setTimeout(() => {
        console.log('🔁 Reconnecting SSH...');
        startTunnel().catch(console.error);
      }, 5000);
    });

    conn.connect(sshConfig);
  });
}

/**
 * Create Postgres connection pool
 */
async function createPool() {
  if (pool) {
    console.log('✅ Closing old Postgres pool...');
    await pool.end().catch(() => {});
    pool = null;
  }

  pool = new Pool(dbConfig);

  try {
    await pool.query('SELECT 1');
    console.log('✅ Postgres pool connected.');
  } catch (err) {
    console.error('❌ Postgres connection error:', err.message);
    console.log('🔁 Retrying Postgres connection in 5 seconds...');
    setTimeout(createPool, 5000);
  }

  pool.on('error', (err) => {
    console.error('❌ Postgres pool error:', err.message);
    console.log('🔁 Reconnecting Postgres pool in 5 seconds...');
    setTimeout(createPool, 5000);
  });
}

/**
 * Initialize backend
 */
async function startServer() {
  try {
    await startTunnel();
    await createPool();

    app.get('/', (req, res) => {
      res.json({ message: '✅ Backend running and SSH tunnel established.' });
    });

    app.get('/api/vehicle-data', async (req, res) => {
      if (!pool) {
        return res.status(503).json({ error: 'Database connection not ready.' });
      }

      try {
        const result = await pool.query(`
          SELECT imei, timestamp, priority, latitude, longitude, altitude, angle, satellites, speed, voltage, current, soc,
                 max_cell_voltage, max_cell_id, min_cell_voltage, min_cell_id,
                 max_temp, max_temp_cell, min_temp, min_temp_cell,
                 cv1, cv2, cv3, cv4, cv5, cv6, cv7, cv8, cv9, cv10,
                 cv11, cv12, cv13, cv14, cv15, cv16, cv17, cv18,
                 created_at
          FROM imei_data
          ORDER BY timestamp DESC
          LIMIT 50000
        `);
        res.json(result.rows);
      } catch (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ error: 'Failed to fetch vehicle data' });
      }
    });

    const PORT = 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Backend live at http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
