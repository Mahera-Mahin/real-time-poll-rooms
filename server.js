require('dotenv').config({ path: '.env' });

const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const base = `http://${req.headers.host || `${hostname}:${port}`}`;
      const parsedUrl = new URL(req.url || '/', base);
      const pathname = parsedUrl.pathname;
      const query = Object.fromEntries(parsedUrl.searchParams);
      await handle(req, res, { pathname, query });
    } catch (err) {
      console.error('Error handling request', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  const io = new Server(server, {
    path: '/api/socketio',
    addTrailingSlash: false,
  });

  io.on('connection', (socket) => {
    socket.on('join', (pollId) => {
      if (pollId) socket.join(`poll:${pollId}`);
    });
    socket.on('leave', (pollId) => {
      if (pollId) socket.leave(`poll:${pollId}`);
    });
  });

  global.io = io;
  globalThis.io = io;

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
