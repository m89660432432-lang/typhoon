// server.js
// Основной сервер Node.js + Express для галереи фотографий

const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');

const app = express();

// ================== НАСТРОЙКИ ==================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'secret_key',
  resave: false,
  saveUninitialized: false
}));

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ================== БАЗА ДАННЫХ ==================
const db = mysql.createConnection({
  host: 'localhost',
  user: 'r999926v_typhoon',
  password: '(-Vegas2026-)',
  database: 'r999926v_typhoon'
});

db.connect(err => {
  if (err) {
    console.error('Ошибка подключения к БД:', err);
  } else {
    console.log('MySQL подключена');
  }
});

// ================== MIDDLEWARE ==================
function isAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.send('Доступ запрещён');
}

// ================== РОУТЫ ==================

// Главная — галерея
app.get('/', (req, res) => {
  db.query('SELECT * FROM photos', (err, photos) => {
    res.render('index', { user: req.session.user, photos });
  });
});

// ================== АВТОРИЗАЦИЯ ==================
app.get('/register', (req, res) => res.render('register'));
app.get('/login', (req, res) => res.render('login'));

app.post('/register', (req, res) => {
  const { email, password } = req.body;
  db.query(
    'INSERT INTO users (email, password, role) VALUES (?, ?, "user")',
    [email, password],
    () => res.redirect('/login')
  );
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query(
    'SELECT * FROM users WHERE email=? AND password=?',
    [email, password],
    (err, results) => {
      if (results.length > 0) {
        req.session.user = results[0];
        res.redirect('/');
      } else {
        res.send('Неверные данные');
      }
    }
  );
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ================== ЗАКАЗЫ ==================
app.get('/buy/:id', isAuth, (req, res) => {
  db.query('SELECT * FROM photos WHERE id=?', [req.params.id], (err, photo) => {
    res.render('buy', { photo: photo[0] });
  });
});

app.post('/buy/:id', isAuth, (req, res) => {
  const { fullname, phone, address } = req.body;
  db.query(
    'INSERT INTO orders (user_id, photo_id, fullname, phone, address, status) VALUES (?, ?, ?, ?, ?, "open")',
    [req.session.user.id, req.params.id, fullname, phone, address],
    () => res.redirect('/profile')
  );
});

// ================== ПРОФИЛЬ ==================
app.get('/profile', isAuth, (req, res) => {
  db.query(
    'SELECT orders.*, photos.title FROM orders JOIN photos ON photos.id=orders.photo_id WHERE user_id=?',
    [req.session.user.id],
    (err, orders) => res.render('profile', { user: req.session.user, orders })
  );
});

app.get('/cancel/:id', isAuth, (req, res) => {
  db.query('DELETE FROM orders WHERE id=? AND user_id=?', [req.params.id, req.session.user.id], () => {
    res.redirect('/profile');
  });
});

// ================== АДМИН ==================
app.get('/admin', isAdmin, (req, res) => {
  db.query('SELECT * FROM orders', (err, orders) => {
    res.render('admin', { orders });
  });
});

app.post('/admin/close/:id', isAdmin, (req, res) => {
  db.query('UPDATE orders SET status="closed" WHERE id=?', [req.params.id], () => {
    res.redirect('/admin');
  });
});

app.post('/admin/add-photo', isAdmin, (req, res) => {
  const { title, price, image_url } = req.body;
  db.query(
    'INSERT INTO photos (title, price, image_url) VALUES (?, ?, ?)',
    [title, price, image_url],
    () => res.redirect('/admin')
  );
});

// ================== СЕРВЕР ==================
app.listen(3000, () => console.log('Сервер запущен на порту 3000'));
