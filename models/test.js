const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: Number,
        price: Number,
        discount: Number,
      },
    ],

    subtotal: Number,
    discount: Number,
    total: Number,

    status: {
      type: String,
      enum: ["pending", "shipping", "delivered", "canceled", "returned"],
      default: "pending",
    },

    shippingInfo: {
      fullname: String,
      email: String,
      phone: String,
      address: String,
    },

    paymentMethod: {
      type: String,
      enum: ["cod", "card"],
      default: "cod",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);