const { Schema } = require('mongoose');

module.exports = new Schema({
  content_type: { type: String, enum: ['image/jpeg', 'image/png'], required: true },
  data: { type: Buffer, required: true },
}, { _id: false });
