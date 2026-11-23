const { createModel } = require('./model-factory');

module.exports = createModel(
  'DriverProfile',
  'driver_profiles',
  {
    driver_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    user_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    license_number: {
      type: String,
      required: true,
      unique: true,
      maxlength: 60,
    },
    license_expiry: {
      type: Date,
      default: null,
    },
    availability_status: {
      type: String,
      required: true,
      maxlength: 30,
    },
    approved_at: {
      type: Date,
      default: null,
    },
  },
  [
    {
      name: 'user',
      model: 'User',
      localField: 'user_id',
      foreignField: 'user_id',
    },
  ],
);
