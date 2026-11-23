const { createModel } = require('./model-factory');

module.exports = createModel(
  'Role',
  'roles',
  {
    role_id: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Must be a safe integer',
      },
    },
    role_name: {
      type: String,
      required: true,
      unique: true,
      maxlength: 40,
    },
  },
  [],
);
