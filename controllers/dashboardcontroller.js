const Order = require("../models/order");
const User = require("../models/user");
const Product = require("../models/product")

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
    const totalCustomers = await User.countDocuments({ role: "user" }); // تأكد إن حقل الأدمن اسمه role
    const lastMonthCustomers = await User.countDocuments({
      role: "user",
      createdAt: { $gte: startOfLastMonth, $lt: startOfCurrentMonth }
    });
    const customerTrend = totalCustomers >= lastMonthCustomers ? "up" : "down";

    // ب- إجمالي الإيرادات والطلبات الناجحة (delivered) بناءً على حقل total عندك
    const cardStats = await Order.aggregate([
      { $match: { status: "delivered" } }, // حروف صغيرة مطابقة للـ enum عندك
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" }, // استخدام حقل total من الـ Schema بتاعتك
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
    const categoryStats = await Order.aggregate([
      { $match: { status: "delivered" } },
      { $unwind: "$items" }, // تفكيك مصفوفة الـ items بتاعتك
      {
        $lookup: {
          from: Product.collection.name, // تأكد إن اسم الـ Collection في قاعدة البيانات هو products (جمع بحروف صغيرة)
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          // بنضرب الكمية (qty) في السعر (price) من جوه مصفوفة الـ items عندك مباشرة
          value: { $sum: { $multiply: ["$items.qty", "$items.price"] } }
        }
      }
    ]);

    const categorySales = categoryStats.map(item => ({
      name: item._id || "Uncategorized",
      value: item.value
    }));

    // ==========================================
    // 4️⃣ حساب المنتجات الأكثر مبيعاً (BestSellers)
    // ==========================================
    const bestSellersStats = await Order.aggregate([
      { $match: { status: "delivered" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: Product.collection.name,
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$productDetails.name" }, // سحب اسم المنتج من الـ Details
          sales: { $sum: "$items.qty" } // جمع حقل الـ qty لعدد المبيعات
        }
      },
      { $sort: { sales: -1 } },
      { $limit: 5 }
    ]);

    const bestSellers = bestSellersStats.map(item => ({
      name: item.name || "Unknown Product",
      sales: item.sales
    }));

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