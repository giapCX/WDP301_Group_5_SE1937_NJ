process.env.MONGODB_DB_NAME = process.env.OPERATOR_DB_NAME || 'tourist_car_rental_demo';
await import('../src/operator-server.js');
