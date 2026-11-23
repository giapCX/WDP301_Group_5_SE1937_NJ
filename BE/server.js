const express = require('express');
const morgan = require('morgan');
const { connectDb, disconnectDb } = require('./dal/database');
const corsMiddleware = require('./middlewares/cors.middleware');
const notFoundMiddleware = require('./middlewares/not-found.middleware');
const errorMiddleware = require('./middlewares/error.middleware');
const renterChangeRoutes = require('./src/routes/renter-booking-change.routes');
const bookingRoutes = require('./src/routes/booking.routes');
const changeRequestRoutes = require('./src/routes/booking-change-request.routes');

require('dotenv').config();

const app = express();
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/api', (req, res) => {
  res.status(200).json({ message: 'Welcome Express server' });
});

app.use('/api/renter/bookings', renterChangeRoutes);
app.use('/api/operator/bookings', bookingRoutes);
app.use('/api/operator/booking-change-requests', changeRequestRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

async function startServer() {
  try {
    await connectDb();
    const port = Number(process.env.PORT) || 9999;
    const server = app.listen(port, () => {
      console.log(`API chạy tại http://localhost:${port}/api`);
    });

    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        server.close(async () => {
          await disconnectDb();
          process.exit(0);
        });
      });
    }
  } catch (error) {
    console.error('Không khởi động được server:', error.message);
    await disconnectDb().catch(() => {});
    process.exitCode = 1;
  }
}

startServer();
