const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const multer = require('multer');
const bcrypt = require('bcryptjs'); // ✅ ADDED

const app = express();
app.use(express.static(__dirname));

// 1. الإعدادات الأساسية
app.use(cors());
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

// ---------------------------------------------------
// 2. الربط بقاعدة البيانات (MongoDB)
// ---------------------------------------------------


// 1. السطر ده أهم سطر عشان ملفات الـ HTML والـ CSS تظهر للناس
app.use(express.static(__dirname));

const dbURI = 'mongodb+srv://admin:nap123@cluster0.l7barrw.mongodb.net/NAP_DB';

mongoose.connect(dbURI)
  .then(() => {
      console.log('Connected to NAP Database! ✅');
      // لو عندك دالة اسمها seedProducts سيبها، لو مش عندك امسحي السطر اللي تحت ده
      if (typeof seedProducts === "function") seedProducts(); 
  })
  .catch((err) => console.log('Database Connection Error ❌:', err));
// ---------------------------------------------------
// 3. إعداد Nodemailer
// ---------------------------------------------------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'nap.egy.store@gmail.com',
        pass: 'ovov fbwh nhwx mqyv'
    },
    tls: {
        rejectUnauthorized: false
    }
});

transporter.verify((error) => {
    if (error) console.log("Email Config Error ❌:", error);
    else console.log("Server is ready to send emails 📧 ✅");
});

// ---------------------------------------------------
// 4. Models
// ---------------------------------------------------
const User = mongoose.model('User', new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }
}));

const Product = mongoose.model('Product', new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  stock: { type: Number, default: 0 } 
}));

// ---------------------------------------------------
// 5. AUTH (REGISTER + LOGIN UPDATED)
// ---------------------------------------------------

// REGISTER (SECURE)
app.post('/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword
    });

    await newUser.save(); 
    res.status(200).json({ status: 'success' }); 

  } catch (err) {
    res.status(400).json({ status: 'error', message: 'Email already exists!' });
  }
});

// LOGIN (SECURE)
app.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });

      if (!user) {
          return res.status(400).json({ status: 'error', message: "Invalid email/password" });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
          return res.status(400).json({ status: 'error', message: "Invalid email/password" });
      }

      res.status(200).json({
          status: 'success',
          userName: user.fullName,
          email: user.email
      });

    } catch (err) {
      res.status(500).json({ status: 'error' });
    }
});

// ---------------------------------------------------
// 6. UPDATE ACCOUNT (FIXED - NEW)
// ---------------------------------------------------
app.post('/update-account', async (req, res) => {
    try {
        const { email, fullName, newPassword } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (fullName) {
            user.fullName = fullName;
        }

        if (newPassword && newPassword.trim() !== "") {
            user.password = await bcrypt.hash(newPassword, 10);
        }

        await user.save();

        res.status(200).json({
            message: "Account updated successfully",
            userName: user.fullName
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// ---------------------------------------------------
// 7. ORDERS + EMAIL (FIXED FOR SPEED)
// ---------------------------------------------------
app.post('/place-order', async (req, res) => {
    try {
        const data = req.body;
        const { customer, payment, cart_items, total, custom_designs } = data;

        // ✅ التعديل الجوهري: نرسل النجاح فوراً للمتصفح حتى لا ينتظر المستخدم
        res.status(200).json({ status: 'success' });

        // الآن نقوم بمعالجة الإيميل في الخلفية دون تعطيل الرد
        let attachments = [];
        let customInfoText = "";

        if (custom_designs && custom_designs.length > 0) {
            customInfoText += `
=========================================
   🎨 CUSTOM DESIGN DETAILS
=========================================
`;

            custom_designs.forEach((design, i) => {

                customInfoText += `
Design #${i + 1}
-----------------------
Fit: ${design.fit}
Color: ${design.color}
Description: ${design.description}
`;

                if (design.images && Array.isArray(design.images) && design.images.length > 0) {
                    customInfoText += `Images: ${design.images.length} attached\n`;

                    design.images.forEach((img, index) => {

                        const base64 = img.includes(',')
                            ? img.split(',')[1]
                            : img;

                        attachments.push({
                            filename: `custom-design-${i + 1}-${index + 1}.png`,
                            content: Buffer.from(base64, 'base64'),
                            contentType: 'image/png'
                        });
                    });

                } else {
                    customInfoText += `Images: None\n`;
                }

                customInfoText += `-----------------------\n`;
            });
        }

        const mailOptions = {
            from: 'nap.egy.store@gmail.com',
            to: 'nap.egy.store@gmail.com',
            subject: `🚨 NEW ORDER from ${customer.name}`,
            attachments: attachments,
            text: `
=========================================
   📦 NEW ORDER DETAILS RECEIVED
=========================================

👤 CUSTOMER INFORMATION:
-----------------------
Name:    ${customer.name}
Email:   ${customer.email}
Phone:   ${customer.phone}

📍 SHIPPING INFORMATION:
-----------------------
Address: ${customer.address}

💳 PAYMENT INFORMATION:
-----------------------
Method:  ${payment}
Total:   ${total}

🛒 ORDER ITEMS:
-----------------------
${cart_items.map(item => `- ${item.name} (Qty: ${item.qty}) - EGP ${item.price}`).join('\n')}

${customInfoText}

=========================================
       END OF ORDER REPORT
=========================================
            `
        };

        // نرسل الإيميل هنا "بخلفية الكود" بدون Callback يعطل الاستجابة
        transporter.sendMail(mailOptions).catch(err => console.error("Mail Send Error In Background:", err));

    } catch (err) {
        console.error("Order Processing Error:", err);
        // لا نرسل res.status هنا لأننا أرسلناه بالفعل بالأعلى
    }
});

// ---------------------------------------------------
// CONTACT
// ---------------------------------------------------
app.post('/contact', (req, res) => {
    const { name, email, phone, comment } = req.body;

    // إرسال رد سريع للعميل
    res.status(200).json({ status: 'success' });

    const mailOptions = {
        from: 'nap.egy.store@gmail.com',
        to: 'nap.egy.store@gmail.com',
        subject: `📩 Contact Form: ${name}`,
        text: `Customer: ${name}\nEmail: ${email}\nPhone: ${phone}\nMessage: ${comment}`
    };

    transporter.sendMail(mailOptions).catch(err => console.error("Contact Mail Error:", err));
});

// ---------------------------------------------------
// PRODUCTS
// ---------------------------------------------------
app.get('/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: "Error" });
    }
});

async function seedProducts() {
    const count = await Product.countDocuments();
    if (count === 0) {
        await Product.insertMany([
            { name: "Black OFF-SHOULDER TEE", price: 600, image: "p1.jpg", stock: 5 },
            { name: "Mirror Ball Baby Tee", price: 500, image: "p2.jpg", stock: 0 },
            { name: "Sprint Baby Tee", price: 550, image: "p3.jpg", stock: 2 }
        ]);
        console.log("Products seeded ✅");
    }
}

// ---------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
