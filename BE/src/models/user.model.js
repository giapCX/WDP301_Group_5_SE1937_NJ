const { createModel } = require('./model-factory');

module.exports = createModel(
  'User',
  'users',
  {
    user_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    role_id: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    full_name: {
      type: String,
      required: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      maxlength: 150,
    },
    phone: {
      type: String,
      default: null,
      maxlength: 20,
    },
    password_hash: {
      type: String,
      required: true,
      maxlength: 255,
    },
    status: {
      type: String,
      required: true,
      maxlength: 20,
    },
    created_at: {
      type: Date,
      required: true,
    },
  },
  [
    {
      name: 'role',
      model: 'Role',
      localField: 'role_id',
      foreignField: 'role_id',
    },
  ],
);
