import { Schema } from 'mongoose';
import { createSchema, embedded } from './schema.js';

const { ObjectId } = Schema.Types;

export const notificationSchema = createSchema({
  recipient_user_id: { type: ObjectId, ref: 'User', required: true },
  notification_type: String,
  title: { type: String, required: true },
  content: String,
  related_entity_type: String,
  related_entity_id: ObjectId,
  delivery_channels: embedded({
    in_app: embedded({
      status: String,
    }),
    email: embedded({
      status: String,
    }),
  }),
  is_read: Boolean,
  created_at: Date,
  read_at: Date,
});
