const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');

const app = express();

/* ===== НАСТРОЙКИ ===== */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'typhoon_secret',
  resave: false,
  saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ===== БАЗА ДАННЫХ ===== */
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===== ИНИЦИАЛИЗАЦИЯ БД ===== */
async function initDB() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT,
        password TEXT,
        role TEXT DEFAULT 'user'
      );

      CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        title TEXT,
        price INTEGER,
        image_url TEXT
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        photo_id INTEGER REFERENCES photos(id),
        fullname TEXT,
        phone TEXT,
        address TEXT,
        status TEXT
      );
    `);

    const { rows } = await db.query('SELECT COUNT(*) FROM photos');
    if (rows[0].count === '0') {
      await db.query(`
        INSERT INTO photos (title, price, image_url) VALUES
        ('Mountain', 3000, 'https://images.unsplash.com/photo-1501785888041-af3ef285b470'),
        ('Sea', 2500, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e'),
        ('Forest', 2000, 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee');
      `);
    }

    console.log('База данных готова');
  } catch (err) {
    console.error('Ошибка БД:', err);
  }
}

initDB();

/* ===== MIDDLEWARE ===== */
function isAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.send('Доступ запрещён');
}

/* ===== РОУТЫ ===== */
app.get('/', async (req, res) => {
  const { rows: photos } = await db.query('SELECT * FROM photos');
  res.render('index', { user: req.session.user, photos });
});

app.get('/register', (req, res) => res.render('register'));
app.get('/login', (req, res) => res.render('login'));

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  await db.query(
    'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
    [email, password, 'admin']
  );
  res.redirect('/login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await db.query(
    'SELECT * FROM users WHERE email=$1 AND password=$2',
    [email, password]
  );

  if (rows.length) {
    req.session.user = rows[0];
    res.redirect('/');
  } else {
    res.send('Неверные данные');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/buy/:id', isAuth, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM photos WHERE id=$1', [req.params.id]);
  res.render('buy', { photo: rows[0] });
});

app.post('/buy/:id', isAuth, async (req, res) => {
  const { fullname, phone, address } = req.body;
  await db.query(
    `INSERT INTO orders (user_id, photo_id, fullname, phone, address, status)
     VALUES ($1, $2, $3, $4, $5, 'open')`,
    [req.session.user.id, req.params.id, fullname, phone, address]
  );
  res.redirect('/profile');
});

app.get('/profile', isAuth, async (req, res) => {
  const { rows: orders } = await db.query(
    `SELECT orders.*, photos.title
     FROM orders
     JOIN photos ON photos.id = orders.photo_id
     WHERE user_id=$1`,
    [req.session.user.id]
  );
  res.render('profile', { user: req.session.user, orders });
});

app.get('/cancel/:id', isAuth, async (req, res) => {
  await db.query(
    'DELETE FROM orders WHERE id=$1 AND user_id=$2',
    [req.params.id, req.session.user.id]
  );
  res.redirect('/profile');
});

app.get('/admin', isAdmin, async (req, res) => {
  const { rows: orders } = await db.query('SELECT * FROM orders');
  res.render('admin', { orders });
});

app.post('/admin/add-photo', isAdmin, async (req, res) => {
  const { title, price, image_url } = req.body;
  await db.query(
    'INSERT INTO photos (title, price, image_url) VALUES ($1, $2, $3)',
    [title, price, image_url]
  );
  res.redirect('/admin');
});

/* ===== СТАРТ ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Typhoon запущен'));
