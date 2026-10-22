require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const methodOverride = require('method-override');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const entryRoutes = require('./src/routes/entries');
const { attachUser } = require('./src/middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));
app.use(helmet());
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  name: 'nhatky.sid',
  secret: process.env.SESSION_SECRET || 'development-secret-please-change',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(attachUser);

app.get('/', (req, res) => res.redirect(req.user ? '/entries' : '/explore'));
app.use('/auth', authRoutes);
app.use('/entries', entryRoutes);

app.get('/explore', async (req, res, next) => {
  try {
    const Entry = require('./src/models/Entry');
    const search = String(req.query.q || '').trim().slice(0, 100);
    const filter = { visibility: 'public' };
    if (search) filter.$or = [
      { title: { $regex: escapeRegex(search), $options: 'i' } },
      { content: { $regex: escapeRegex(search), $options: 'i' } }
    ];
    const entries = await Entry.find(filter)
      .populate('author', 'displayName')
      .sort({ createdAt: -1 })
      .limit(30);
    res.render('explore/index', { title: 'Bài viết công khai', entries, search });
  } catch (error) { next(error); }
});

app.use('/explore', require('./src/routes/publicEntries'));

app.use((req, res) => res.status(404).render('errors/404', { title: 'Không tìm thấy trang' }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render('errors/500', { title: 'Có lỗi xảy ra' });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(port, () => console.log(`Nhật ký đang chạy tại http://localhost:${port}`));
  })
  .catch((error) => {
    console.error('Không thể kết nối MongoDB:', error.message);
    process.exit(1);
  });

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
