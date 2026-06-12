import { model, Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // ONE WHO IS SUBSCRIBING
        ref: 'User'
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {timestamps: true})

export const Subscription = model('Substription', subscriptionSchema)