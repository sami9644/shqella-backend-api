const express = require('express');
const cors = require('cors');
const db = require('./database');
const { message } = require('telegraf/filters');
// const { message } = require('telegraf/filters');

app = express();

app.use(express.json());
app.use(cors());

app.get("/",(req,res) => {
    res.send("<h1>Backend api is running </h1>");
})


// login user 
app.post("/api/login",async (req,res) => {
    const {phoneNo,password} = req.body;
    const userInfo = await db.login(phoneNo,password);

    if (userInfo) {
        res.json({
        status:"success",
        message:"Logged in successfully!",
        data:userInfo
    })
    }
    else {
        res.json({
        status:"error",
        message:"Invalid credentials or something occured!"
    })
    }
})

// list product items
app.get('/items',async (req,res) => {
    let products = await db.products();
    if (products) {
        res.json({
            status:"success",
            data:products
        })
    }
    else {
        res.json({
            status:"error",
            data:null
        })
    }
});

app.post("/addtocart",async (req,res) => {
    const {item,user,amount} = req.body;
    const cartId = await db.addToCart(item,user,amount);
    if (cartId) {
        res.json({
            status:"Success",
            message:`Item ${item} added to cart with id ${cartId}`
        })
    }
    else {
        res.json({
            status:"Error",
            message:"Error occured while adding item to cart"
        })
    }
})

app.get("/cart/:userid",async (req,res) => {
    await db.deleteExcessCart();
let cartItems = await db.carts(req.params.userid); // array of objects
if (cartItems) {
    res.json({
        status:"Success",
        message:`${cartItems.length} items found`,
        data:cartItems
    })
}
else {
    res.json({
        status:"Error",
        message:"Error retrieving cart items",
        data:null
    })
}
})

app.delete("/delete/cart/:cartId",async (req,res) => {
    let delStatus =await db.deleteCart(req.params.cartId);
    if (delStatus) {
        res.json({
            status:"Success",
            message:`Item successfully deleted from cart!`
        })
    }
    else {
        res.json({
            status:"Error",
            message:"Unknown error try again!"
        })
    }
})


//checkout cart items
app.post("/place/order/fromcart",async (req,res) => {
    await db.deleteExcessCart();
    const {user,location} = req.body;
    let orderStatus = await db.orderFromCart(req.body.user,req.body.location);
    if (orderStatus) {
        res.json({
            status:"Success",
            message:"Order cleared out"
        })
    } 
    else {
        res.json({
            status:"Error",
            message:"Error occured while ordering!"
        })
    }
})

//orders 
app.post("/user/orders",async (req,res) => {
let {userid} = req.body
let orders = await db.orders(req.body.userid);
if (orders.length > 0) {
    res.json({
    status:"Success",
    message:`${orders.length} of orders returned successfully!`,
    data:orders
    })
}
else {
    res.json({
        status:"error",
        message:"No orders retrieved",
        data:null
    })
}
})

//cancel pending order
app.delete("/cancel/order/:orderid/:userid",async (req,res) => {
   let cancel = await db.cancelPendingOrder(req.params.orderid,req.params.userid);
    if (cancel) {
        res.json({
            status:"Success",
            message:'Cancelled'
        })
    }
    else {
        res.json({
            status:"Error",
            message:"Error occured"
        })
    }
});


//search by category
app.get("/search/:category",async (req,res) => {
    let items = await db.searchCategory(req.params.category);
    if (items) {
        console.log("hello")
        res.json({
            status:"Success",
            message:`${items.length} items returned`,
            data:items
        })
    }
    else {
        console.log("Nope")
        res.status(404).json({
             status:"error",
            message:`No items found!`,
            data:null
        })
    }
})

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});