require('dotenv').config();
const postgres = require('postgres');
const bcrypt = require('bcrypt');
// const { use } = require('react');


const connectionString = process.env.DATABASE_URL;

const checkAccount = async (phone) => {
let sql;
try {
    sql = postgres(connectionString);
    let userInfo = await sql`SELECT phone_number FROM users WHERE phone_number = ${phone}`;
    return userInfo.length > 0;
}
catch (error) {
    console.log(error);
    return false;
}
finally {
    await sql.end();
}
}

// Database function
const insertUser = async (name, phoneNo, gender, password) => {
    let sql;
    try {
        sql = postgres(connectionString);
        const hashed = await bcrypt.hash(password, 10);
        // if (!checkAccount(phoneNo)) {
        const users = await sql`
            insert into users 
                (fullname, phone_number, gender, password)
            values 
                (${name}, ${phoneNo}, ${gender}, ${hashed})
            returning id, fullname, phone_number,gender,password
        `;
        return users[0];
        // }
        // else {
        //     return false
        // }
    } catch (err) {
        console.error("DB Error:", err);
        return null;
    } finally {
        if (sql) await sql.end();
    }
};



async function login(phoneNo,password) {
    let sql;
    try {
        sql = postgres(connectionString);
        const userinfo = await sql `
        SELECT * FROM users WHERE phone_number = ${phoneNo}
        `;
        if (userinfo.length > 0) {
            let hashed = userinfo[0]['password'];
            let isValid = await bcrypt.compare(password,hashed);
            if (isValid) {
                console.log("success")
                return userinfo[0];
            }
            else {
                console.log("Not found")
                return false;
            }
        }
        else {
            console.log("No account")
            return false;
        }
        
    }
    catch(err) {
        console.log(err);
        return false;
    }
    finally {
        await sql.end();
    }
}

async function products() {
    let sql;
    try {
        sql = postgres(connectionString);
        const products = await sql `SELECT * FROM items`;
        return products;
    }
    catch(err) {
        console.log(err);
        return false;
    }
    finally {
       if (sql) await sql.end();
    }
}


// add to cart/whishlist
async function addToCart(item,user,amount) {
let sql 
try {
sql = postgres(connectionString);
let itemAmount = await sql`SELECT amount FROM items WHERE id = ${item}`;

if (itemAmount.length > 0) {
if ((parseInt(itemAmount[0]['amount']) >= parseInt(amount))) {
let cartid =await sql`INSERT INTO carts(item,amount,owner) VALUES (${item},${amount},${user})
returning id
`;
if (cartid) {
console.log(cartid)
return cartid;
}
else {
    console.log("not added !")
    return false;
}
}
else {
    console.log("amount error");
    return false;
}
}
else {
    return false;
}

}
catch(err) {
    console.error(err);
    return false;
}
finally {
if (sql) await sql.end();
}
}


// cart items of user
async function carts(owner) {
    let sql;
    try {
        sql = postgres(connectionString);
        let cartItems = await sql`SELECT 
                carts.id AS cart_id,
                items.itemname,
                items.picture,
                items.price,
                carts.amount AS amount,
                items.id
            FROM carts
            JOIN items ON carts.item = items.id
            WHERE carts.owner = ${owner}`;
        if (cartItems.length > 0) {
            return cartItems
        }
        else {
            return cartItems;
        }
    }
    catch (err) {
        console.error(err);
        return false;
    }
    finally {
if (sql) await sql.end();
}
}
// carts('1e5373b7-f5e0-4078-8e5c-53c15dd6a951').then(data => console.log(data))

// place order
async function createOrder(item,user,location,paid_price,amount) {
let sql;
try {
sql = postgres(connectionString);
let lotto =await sql `INSERT INTO orders(item,ordered_by,location,paid_price,amount) VALUES (${item},${user},${location},${paid_price},${amount})
returning order_id, lotto_ticket
`;
await sql`UPDATE items SET amount = amount-${amount} WHERE id = ${item} and amount >= ${amount}`;
if (lotto) {
return true;
}
else {
    return false;
}

}
catch(err) {
    console.error(err);
    return false;
}
finally {
if (sql) await sql.end();
}   
}


// order list
async function orders(userid) {
        let sql;
    try {
        sql = postgres(connectionString);
        let cartItems = await sql`SELECT 
    orders.order_id,
    orders.location, 
    users.fullname, 
    items.itemname,
    items.picture,
    items.id,
    orders.paid_status,
    orders.created_at,
    orders.paid_price,
    orders.lotto_ticket
FROM orders
JOIN items ON orders.item = items.id
JOIN users ON orders.ordered_by = users.id
WHERE ordered_by = ${userid} AND paid_status = FALSE`;
        if (cartItems.length > 0) {
            return cartItems
        }
        else {
            return false;
        }
    }
    catch (err) {
        console.error(err);
        return false;
    }
    finally {
if (sql) await sql.end();
}
}


// delete item from cart
async function deleteCart(cartId) {
     let sql;
    try {
        sql = postgres(connectionString);
        await sql`DELETE FROM carts WHERE id = ${cartId}`;
        return true;
    }
    catch (err) {
        console.error(err);
        return false;
    }
    finally {
if (sql) await sql.end();
}
}


//order all items from your cart
async function orderFromCart(user,location) {
    let cartItems = await carts(user);
    let sql;
    try {
        if (cartItems.length > 0 ) {
        sql = postgres(connectionString);
        for (const item of cartItems) {
            await sql`INSERT INTO orders(item, ordered_by, location, paid_price, amount) 
                          VALUES(${item.id},${user},${location},${parseFloat(item.price)*parseFloat(item.amount)},${item.amount})`;
            await sql`
                    UPDATE items 
                    SET amount = amount - ${item.amount}
                    WHERE id = ${item.id} AND amount >= ${item.amount}
                    RETURNING id
                `;
        }
        await sql`DELETE FROM carts WHERE owner = ${user}`;
        console.log("Successfully ordered all items");
        return true;
        }
        else {
            console.log("You got nothing in cart!")
            return false;
        }
    }
    catch (err) {
        console.error(err);
        return false;
    }
    finally {
if (sql) await sql.end();
}
}

async function deleteExcessCart() {
    let sql;

    try {
        sql = postgres(connectionString);

        // Get all cart items with actual stock
        const cartItems = await sql`
            SELECT 
                carts.id AS cart_id,
                items.itemname,
                items.picture,
                items.price,
                items.amount AS item_stock,
                carts.amount AS cart_amount,
                items.id AS item_id
            FROM carts
            JOIN items 
            ON carts.item = items.id
        `;

        if (cartItems.length > 0) {
            for (const item of cartItems) {

                // If cart quantity is greater than available stock
                if (parseInt(item.cart_amount) > parseInt(item.item_stock)) {

                    // Delete that cart row
                    await sql`
                        DELETE FROM carts
                        WHERE id = ${item.cart_id}
                    `;

                    console.log(
                        `Deleted cart item ${item.cart_id} because requested amount (${item.cart_amount}) exceeds stock (${item.item_stock})`
                    );
                }
            }
        }

        return true;

    } catch (err) {
        console.error(err);
        return false;

    } finally {
        if (sql) await sql.end();
    }
}

async function cancelPendingOrder(orderid,userid) {
         let sql;
    try {
        sql = postgres(connectionString);
        let [deletedAmount] = await sql`DELETE FROM orders WHERE order_id = ${orderid} AND paid_status = FALSE AND ordered_by = ${userid} returning item,amount`;
        await sql`UPDATE items SET amount = amount + ${deletedAmount.amount} WHERE id = ${deletedAmount.item}`
        console.log("item added");
        return true;
    }
    catch (err) {
        console.log("damn")
        console.error(err);
        return false;
    }
    finally {
if (sql) await sql.end();
}
}


async function searchCategory(category) {
    let sql;
    try {
        sql = postgres(connectionString);
        let items = await sql`SELECT * FROM items WHERE item_type = ${category}`
        if (items.length > 0) {
            return items;
        }
        else {
            return false
        }
    }
     catch (err) {
        console.error(err);
        return false;
    }
    finally {
if (sql) await sql.end();
}
}

async function redeemCoin(phone,password,coin) {
    let sql;
    try {
        sql = postgres(connectionString);
        let users = await sql`SELECT * FROM users WHERE phone_number = ${phone}`;
        // console.log(users)
        if (users.length > 0) {
            let isPasswordValid = await bcrypt.compare(password,users[0].password);
            if (isPasswordValid) {
            let fullname = await sql`UPDATE users SET coins = coins+${parseInt(coin)} WHERE phone_number = ${phone} returning fullname`;
            console.log("d")
            return true;
            }
            else {
                console.log("Password invalid")
                return false
            }
        }
        else {
            console.log("Not found!")
            return false
        }
    }
    catch(err) {
        console.error(err);
        return false;
    }
    finally {
        if(sql) sql.end();
    }
    
}



module.exports = {login,products,addToCart,carts,createOrder,orders,deleteCart,orderFromCart,deleteExcessCart,cancelPendingOrder,searchCategory,insertUser,redeemCoin}