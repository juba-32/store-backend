const Order = require("../models/order");
const User = require("../models/user");
const Product = require("../models/product");

exports.getMegaDashboardStats = async (req, res) => {
  try {
    // ==========================================
    // 🗓️ تجهيز التواريخ لحساب الـ Trends ديناميكياً
    // ==========================================
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // ==========================================
    // 1️⃣ حساب بيانات الكروت العلوية (Cards)
    // ==========================================
    
    // أ- إجمالي العملاء والـ Trend
    const totalCustomers = await User.countDocuments({ role: "user" }); 
    const lastMonthCustomers = await User.countDocuments({
      role: "user",
      createdAt: { $gte: startOfLastMonth, $lt: startOfCurrentMonth }
    });
    const customerTrend = totalCustomers >= lastMonthCustomers ? "up" : "down";

    // ب- إجمالي الإيرادات والطلبات الناجحة (delivered)
    const cardStats = await Order.aggregate([
      { $match: { status: "delivered" } }, 
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" }, 
          totalOrders: { $sum: 1 }
        }
      }
    ]);
    const totalRevenue = cardStats[0]?.totalRevenue || 0;
    const totalOrders = cardStats[0]?.totalOrders || 0;
    const totalReturns = await Order.countDocuments({ status: "returned" });

    // ==========================================
    // 2️⃣ حساب مبيعات الشهور (SalesBarChart) لعام 2026
    // ==========================================
    const currentYear = 2026;
    const monthlySalesData = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          createdAt: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          sales: { $sum: "$total" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const salesMonthly = monthNames.map((name, index) => {
      const foundMonth = monthlySalesData.find(m => m._id === index + 1);
      return {
        month: name,
        sales: foundMonth ? foundMonth.sales : 0
      };
    });

    // ==========================================
    // 3️⃣ حساب مبيعات التصنيفات (CategorySalesPie)
    // ==========================================
    let categorySales = [];
    try {
      const categoryStats = await Order.aggregate([
        { $match: { status: "delivered" } },
        { $unwind: "$items" },
        {
          $addFields: {
            "items.productObjId": { $toObjectId: "$items.product" }
          }
        },
        {
          $lookup: {
            from: Product.collection.name,
            localField: "items.productObjId",
            foreignField: "_id",
            as: "productDetails"
          }
        },
        { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$productDetails.category.en", "Uncategorized"] }, 
            value: { 
              $sum: { 
                $multiply: [
                  { $toDouble: { $ifNull: ["$items.qty", 0] } },   
                  { $toDouble: { $ifNull: ["$items.price", 0] } }  
                ] 
              } 
            }
          }
        }
      ]);

      if (categoryStats && categoryStats.length > 0) {
        categorySales = categoryStats.map(item => ({
          name: item._id,
          value: item.value || 0
        }));
      }
    } catch (err) {
      console.error("Error in category aggregation:", err);
      categorySales = [];
    }

    // ==========================================
    // 4️⃣ حساب المنتجات الأكثر مبيعاً (BestSellers)
    // ==========================================
    let bestSellers = [];
    try {
      const bestSellersStats = await Order.aggregate([
        { $match: { status: "delivered" } },
        { $unwind: "$items" },
        {
          $addFields: {
            "items.productObjId": { $toObjectId: "$items.product" }
          }
        },
        {
          $lookup: {
            from: Product.collection.name,
            localField: "items.productObjId",
            foreignField: "_id",
            as: "productDetails"
          }
        },
        { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$items.product",
            name: { $first: { $ifNull: ["$productDetails.title.en", "Unknown Product"] } },
            sales: { $sum: { $toDouble: { $ifNull: ["$items.qty", 0] } } } 
          }
        },
        { $sort: { sales: -1 } },
        { $limit: 5 }
      ]);

      if (bestSellersStats && bestSellersStats.length > 0) {
        bestSellers = bestSellersStats.map(item => ({
          name: item.name || "Unknown Product",
          sales: item.sales || 0
        }));
      }
    } catch (err) {
      console.error("Error in bestSellers aggregation:", err);
      bestSellers = [];
    }

    // ==========================================
    // 🚀 تجميع وإرسال الـ Response النهائي للفرونت إند
    // ==========================================
    res.status(200).json({
      cards: {
        totalCustomers,
        customerTrend,
        totalRevenue,
        revenueTrend: "up",
        totalOrders,
        ordersTrend: "up",
        totalReturns,
        returnsTrend: "down"
      },
      salesMonthly,
      categorySales,
      bestSellers
    });

  } catch (error) {
    console.error("Mega Dashboard API Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};