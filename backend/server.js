require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const passport = require('passport');
const fs = require('fs');
const path = require('path');
const { configurePassport } = require('./auth/passport');

const authRoutes = require('./routes/apiAuth');
const entryRoutes = require('./routes/entries');
const publicEntryRoutes = require('./routes/publicEntries');
const draftRoutes = require('./routes/drafts');
const profileRoutes = require('./routes/profiles');
const notificationRoutes = require('./routes/notifications');
const socialRoutes = require('./routes/social');

function createApp(options) {
  configurePassport();

  const app = express();
  const frontendDist = path.join(__dirname, '..', 'dist');
  const mongoDbName = process.env.MONGO_DB_NAME || 'nhat_ky_ca_nhan';
  const sessionStore = options?.sessionStore || MongoStore.create({ mongoUrl: process.env.MONGODB_URI, dbName: mongoDbName, collectionName: 'sessions' });
  const sessionSecret = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-secret-change-this');
  if (!sessionSecret) throw new Error('SESSION_SECRET is required in production.');
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(helmet(process.env.NODE_ENV === 'production' ? undefined : {
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use((req, res, next) => {
    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5174';
    if (process.env.NODE_ENV !== 'production' && req.headers.origin === frontendOrigin) {
      res.setHeader('Access-Control-Allow-Origin', frontendOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.vary('Origin');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  });
  app.use(express.json({ limit: '40kb' }));
  app.use(session({
    name: 'nhatky.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  const avatarDirectory = path.resolve(__dirname, '..', 'uploads', 'avatars');
  app.use('/api/avatars', express.static(avatarDirectory, { maxAge: '1d', immutable: true }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/profiles', profileRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/entries', entryRoutes);
  app.use('/api/public/entries', publicEntryRoutes);
  app.use('/api/drafts', draftRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/social', socialRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy API.' } }));

  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist, { index: false }));
    app.get('*', (req, res, next) => {
      if (path.extname(req.path)) return next();
      return res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => res.status(503).type('text').send('Frontend chưa được build. Chạy npm run build trước khi dùng npm start.'));
  }

  app.use((error, _req, res, _next) => {
    console.error(error);
    if (res.headersSent) return;
    const tooLarge = error.type === 'entity.too.large';
    const status = tooLarge ? 413 : error.name === 'ValidationError' ? 400 : 500;
    return res.status(status).json({
      error: {
        code: tooLarge ? 'AVATAR_TOO_LARGE' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: tooLarge ? 'Ảnh đại diện không được vượt quá 2 MB.' : status === 400 ? 'Dữ liệu không hợp lệ.' : 'Máy chủ gặp lỗi. Hãy thử lại sau.'
      }
    });
  });

  return app;
}

async function cleanLegacyIndexes() {
  try {
    const userColl = mongoose.connection.collection('users');
    const indexes = await userColl.indexes();
    for (const idx of indexes) {
      if (idx.name === 'googleId_1' || idx.name === 'email_1') {
        await userColl.dropIndex(idx.name).catch(() => {});
      }
    }
  } catch {
    // Collection might not exist yet
  }
}

async function startServer() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGO_DB_NAME || 'nhat_ky_ca_nhan' });
  await cleanLegacyIndexes();
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => console.log(`Nhật ký đang chạy tại http://localhost:${port}`));
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Không thể khởi động Nhật ký:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { createApp, startServer };
