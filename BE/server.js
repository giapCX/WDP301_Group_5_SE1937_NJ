const express = require('express');
const morgan = require('morgan');
const { connectDb, disconnectDb } = require('./dal/database');
const corsMiddleware = require('./middlewares/cors.middleware');
const notFoundMiddleware = require('./middlewares/not-found.middleware');
const errorMiddleware = require('./middlewares/error.middleware');
const chargeRoutes = require('./src/routes/additional-charge.routes');
const renterChangeRoutes = require('./src/routes/renter-booking-change.routes');
const bookingRoutes = require('./src/routes/booking.routes');
const changeRequestRoutes = require('./src/routes/booking-change-request.routes');
const tripMonitoringRoutes = require('./src/routes/trip-monitoring.routes');
const operatorOverviewRoutes = require('./src/routes/operator-overview.routes');
const driverDashboardRoutes = require('./src/routes/driver-dashboard.routes');
const homepageRoutes = require('./src/routes/homepage.routes');
const renterDashboardRoutes = require('./src/routes/renter-dashboard.routes');
const managerDashboardRoutes = require('./src/routes/manager-dashboard.routes');
const managerMaintenanceRoutes = require('./src/routes/manager-maintenance.routes');
const tripWorkflowRoutes = require('./src/routes/trip-workflow.routes');
const garageWorkflowRoutes = require('./src/routes/garage-workflow.routes');

require('dotenv').config({ path: require('node:path').join(__dirname, '.env'), quiet: true });
const { router: authRoutes, attachUser } = require('./src/routes/auth.routes');

const app = express();
app.use(corsMiddleware);
app.use(morgan('dev'));
app.use('/api/garage', attachUser, garageWorkflowRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api', (req, res) => {
  res.status(200).json({ message: 'Welcome Express server' });
});
app.use('/api/homepage', homepageRoutes);
app.use('/api/auth', authRoutes);
app.use(['/api/operator', '/api/renter', '/api/manager', '/api/driver'], attachUser);
app.use('/api/manager/dashboard', managerDashboardRoutes);
app.use('/api/manager/maintenance-approvals', managerMaintenanceRoutes);
app.use('/api/driver', driverDashboardRoutes);
app.use('/api/renter/dashboard', renterDashboardRoutes);
app.use('/api/operator', operatorOverviewRoutes);
app.use('/api/operator/trips', tripMonitoringRoutes);
app.use('/api/operator/dispatch', tripWorkflowRoutes.operator);
app.use('/api/driver/workflow', tripWorkflowRoutes.driver);

app.use('/api/renter/bookings', renterChangeRoutes);
app.use('/api/renter/bookings', chargeRoutes.renterBookingRoutes);
app.use('/api/operator/bookings', bookingRoutes);
app.use('/api/operator/bookings', chargeRoutes.operatorBookingRoutes);
app.use('/api/operator/additional-charges', chargeRoutes.operatorChargeRoutes);
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
