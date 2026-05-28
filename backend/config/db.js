const mongoose = require('mongoose');

function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri);
}

module.exports = { connectMongo };

