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

const mongoose = require('mongoose');

function connectMongo() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }

  mongoose.set('strictQuery', true);

  return mongoose.connect(uri).then(() => {
    console.log('Connected DB:', mongoose.connection.name);
  });
}

module.exports = { connectMongo };