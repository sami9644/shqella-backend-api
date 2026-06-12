const express = require('express');
const cors = require('cors');
const db = require('./database');
const pay = require("./payment");
const crypto = require("crypto");
const fs = require("fs");
const cookieParser = require('cookie-parser');
const { message } = require('telegraf/filters');

const app = express(); // Fixed: Added 'const' here to declare app properly

app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

app.get("/", (req, res) => {
    return res.send("<h1>Backend api is running </h1>");
});

// ==========================================
// FIXED GET RECHARGE ROUTE
// ==========================================
app.get("/recharge", async (req, res) => {
    const { tx_ref } = req.query;
    let sql;

    // Fix 1: Add 'return' so if there's no query param, we stop execution instantly.
    if (!tx_ref) {
        return res.render('index');
    }

    try {
        sql = db.db();
        let data = await sql`SELECT * FROM payments WHERE txref = ${tx_ref}`;
        
        if (data.length == 0) {
            return res.send(`<h2>Payment info not found!</h2><a href="/recharge">Back</a>`);
        }

        let verify = await pay.verifyPayment(tx_ref);
        let isPaid = await sql`SELECT status FROM payments WHERE txref = ${tx_ref}`;
        
        if (isPaid.length > 0) {
            if (isPaid[0].status == "paid") {
                return res.send(`<h2>Already recharged!</h2><a href="/recharge">Back</a>`);
            }
        }

        if (verify) {
            await sql`UPDATE payments SET status = 'paid' WHERE txref = ${tx_ref}`;
            await db.recharge(data[0].payer, data[0].password, data[0].amount);
            return res.send('<h2>Recharged successfully</h2><a href="/">Back</a>');
        } else {
            return res.send(`<h2>Recharge failed try again</h2><a href="/recharge">Back</a>`);
        }
    }
    catch (err) {
        // Fix 2: Safety guard check to make sure headers weren't already sent
        if (!res.headersSent) {
            return res.send(`<h2>${err.message}</h2><a href="/recharge">Back</a>`);
        }
    }
    finally {
        // Fix 3: Safely check if database connection object exists before closing
        if (sql && typeof sql.end === 'function') {
            sql.end();
        }
    }
});

// ==========================================
// FIXED POST RECHARGE ROUTE
// ==========================================
app.post('/recharge', async (req, res) => {
    let { phoneNo, password, amount } = req.body;
    const txref = crypto.randomUUID();
    let sql;
    try {
        sql = db.db();
        
        // This query executes properly now 
        let payer = await sql`INSERT INTO payments(txref,amount,payer,password) VALUES(${txref},${amount},${phoneNo},${password})`;
        
        let checkoutUrl = await pay.initializePayment(
            parseFloat(amount), 
            'ethio@gmail.com', 
            txref, 
            `https://shqella-backend-api.onrender.com/recharge?tx_ref=${txref}`, 
            `https://shqella-backend-api.onrender.com/recharge?tx_ref=${txref}`
        );
        
        return res.redirect(checkoutUrl);
    }
    catch (err) {
        console.log(err.message);
        if (!res.headersSent) {
            return res.send(`<h2>${err.message}</h2><a href="/recharge">Back</a>`);
        }
    }
    finally {
        if (sql && typeof sql.end === 'function') {
            sql.end();
        }
    }
});

// ==========================================
// REST OF YOUR APIS (Unchanged but verified)
// ==========================================
app.post("/api/signup", async (req, res) => {
    const { fullname, phoneNo, gender, password } = req.body;
    const userInfo = await db.insertUser(fullname, phoneNo, gender, password);
    if (userInfo) {
        return res.status(200).json({
            status: "Success",
            message: "Registered successfully",
            data: userInfo
        });
    } else {
        return res.status(404).json({
            status: "Error",
            message: "Error registering make sure you arent using already used phone number",
            data: null
        });
    }
});

app.post("/api/login", async (req, res) => {
    const { phoneNo, password } = req.body;
    const userInfo = await db.login(phoneNo, password);

    if (userInfo) {
        return res.json({
            status: "success",
            message: "Logged in successfully!",
            data: userInfo
        });
    } else {
        return res.json({
            status: "error",
            message: "Invalid credentials or something occured!"
        });
    }
});

app.get('/items', async (req, res) => {
    let products = await db.products();
    if (products) {
        return res.json({
            status: "success",
            data: products
        });
    } else {
        return res.json({
            status: "error",
            data: null
        });
    }
});

app.post("/addtocart", async (req, res) => {
    const { item, user, amount } = req.body;
    const cartId = await db.addToCart(item, user, amount);
    if (cartId) {
        return res.json({
            status: "Success",
            message: `Item ${item} added to cart with id ${cartId}`
        });
    } else {
        return res.json({
            status: "Error",
            message: "Error occured while adding item to cart"
        });
    }
});

app.get("/cart/:userid", async (req, res) => {
    await db.deleteExcessCart();
    let cartItems = await db.carts(req.params.userid);
    if (cartItems) {
        return res.json({
            status: "Success",
            message: `${cartItems.length} items found`,
            data: cartItems
        });
    } else {
        return res.json({
            status: "Error",
            message: "Error retrieving cart items",
            data: null
        });
    }
});

app.delete("/delete/cart/:cartId", async (req, res) => {
    let delStatus = await db.deleteCart(req.params.cartId);
    if (delStatus) {
        return res.json({
            status: "Success",
            message: `Item successfully deleted from cart!`
        });
    } else {
        return res.json({
            status: "Error",
            message: "Unknown error try again!"
        });
    }
});

app.post("/place/order/fromcart", async (req, res) => {
    await db.deleteExcessCart();
    let orderStatus = await db.orderFromCart(req.body.user, req.body.location);
    if (orderStatus) {
        return res.json({
            status: "Success",
            message: "Order cleared out"
        });
    } else {
        return res.json({
            status: "Error",
            message: "Error occured while ordering!"
        });
    }
});

app.post("/user/orders", async (req, res) => {
    let orders = await db.orders(req.body.userid);
    if (orders.length > 0) {
        return res.json({
            status: "Success",
            message: `${orders.length} of orders returned successfully!`,
            data: orders
        });
    } else {
        return res.json({
            status: "error",
            message: "No orders retrieved",
            data: null
        });
    }
});

app.delete("/cancel/order/:orderid/:userid", async (req, res) => {
    let cancel = await db.cancelPendingOrder(req.params.orderid, req.params.userid);
    if (cancel) {
        return res.json({
            status: "Success",
            message: 'Cancelled'
        });
    } else {
        return res.json({
            status: "Error",
            message: "Error occured"
        });
    }
});

app.get("/search/:category", async (req, res) => {
    let items = await db.searchCategory(req.params.category);
    if (items) {
        return res.json({
            status: "Success",
            message: `${items.length} items returned`,
            data: items
        });
    } else {
        return res.status(404).json({
            status: "error",
            message: `No items found!`,
            data: null
        });
    }
});

app.post("/redeem/coin", async (req, res) => {
    let { phone, password, coin } = req.body;
    let fullname = await db.redeemCoin(phone, password, coin);
    if (fullname) {
        return res.json({
            status: "Success",
            data: fullname,
            message: `Coin have been added to ${fullname}`
        });
    } else {
        return res.status(404).json({
            status: "error",
            data: null,
            message: `An error occured!`
        });
    }
});

app.get('/get/balance/:userid',async (req,res) => {
    let sql;
    try {
        sql = db.db();
        let balance = await sql`SELECT balance,trials FROM users WHERE id = ${req.params.userid}`;
        if (balance.length > 0) {
            res.json({
                status:"Success",
                data:balance[0],
                message:""
            });

        }
        else {
            res.json({
                status:"error",
                data:null,
                message:"User not found!"
            })
        }
    }
    catch(err) {
        console.log(err.message);
    }
    finally {
        if(sql) sql.end();
    }
})

app.delete('/reduce/trials', async (req, res) => {
    let { userid } = req.body;
    let sql;
    
    // Safety check: Make sure userid is sent in the body
    if (!userid) {
        return res.status(400).json({ status: "Error", message: "User ID is required" });
    }

    try {
        sql = db.db();
        
        // 1. Fetch current trials and balance first to verify they have enough
        let user = await sql`SELECT trials, balance FROM users WHERE id = ${userid}`;
        
        if (user.length === 0) {
            return res.status(404).json({ status: "Error", message: "User not found!" });
        }

        if (user[0].trials <= 0) {
            return res.status(400).json({ status: "Error", message: "No trials left! Please recharge." });
        }

        // 2. SQL FIX: Deduct 1 trial AND deduct 3 Birr from balance simultaneously
        let updateResult = await sql`
            UPDATE users 
            SET trials = trials - 1, 
                balance = balance - 3 
            WHERE id = ${userid} 
            RETURNING trials, balance
        `;

        let transfer = pay.settleToBusiness(parseFloat(updateResult[0].balance),'0910232425',855,'shqella');

        // 3. Always return a response to prevent hanging requests
        return res.json({
            status: "Success",
            message: "Trial consumed successfully",
            remainingTrials: updateResult[0].trials,
            remainingBalance: updateResult[0].balance
        });

    } catch (err) {
        console.error("Error reducing trials:", err.message);
        
        if (!res.headersSent) {
            return res.status(500).json({ status: "Error", message: err.message });
        }
    } finally {
        if (sql && typeof sql.end === 'function') {
            sql.end();
        }
    }
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});