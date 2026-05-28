require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { connectMongo } = require('./config/db');

const productsRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const auditRoutes = require('./routes/audit');


// ensure roles can be loaded from MongoDB users collection
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(async (req, _res, next) => {
  if (!req.user?.uid) return next();
  try {
    // Hydrate authorization role deterministically from MongoDB.
    // Never trust role claims from the client/token.
    const u = await User.findOne({ uid: req.user.uid }).select('role name').lean();
    if (u) {
      req.user.role = u.role;
      if (!req.user.name && u.name) req.user.name = u.name;
    } else {
      req.user.role = null;
    }

    return next();

  } catch (e) {
    return next();
  }
});


// health
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/', (req, res) => {
  res.send('Mongo/Express API Running');
});

// routes
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/audit', auditRoutes);


const PORT = process.env.PORT || 5000;

connectMongo()
  .then(() => {
    console.log('MongoDB Connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Mongo connection error:', err);
    process.exit(1);
  });

