require('dotenv').config();
const postgres = require('postgres');
const bcrypt = require('bcrypt');
const strftime = require('strftime')
// const { use } = require('react');
async function getRealEthiopianDates() {
  let trueTimestamp = null;

  // Try Cloudflare first (Incredibly reliable, globally distributed)
  try {
    let response = await fetch('https://cloudflare.com/cdn-cgi/trace');
    let text = await response.text();
    
    // Cloudflare returns text data; we parse the 'ts=' line containing Unix time in seconds
    let tsLine = text.split('\n').find(line => line.startsWith('ts='));
    if (tsLine) {
      trueTimestamp = parseFloat(tsLine.split('=')[1]) * 1000;
    }
  } catch (e) {
    console.log("Cloudflare fetch failed, trying Google backup...");
  }

  // Backup: Fetch from Google and grab the timestamp from the server HTTP 'Date' header
  if (!trueTimestamp) {
    try {
      let response = await fetch('https://www.google.com', { method: 'HEAD' });
      let serverDateStr = response.headers.get('date');
      if (serverDateStr) {
        trueTimestamp = Date.parse(serverDateStr);
      }
    } catch (e) {
      console.error("All time-sync APIs failed. Network might be completely down.");
      return;
    }
  }

  // Now process the verified timestamp safely
  if (trueTimestamp) {
    let today = new Date(trueTimestamp);

    let expiryDate = new Date(today);
    expiryDate.setDate(today.getDate() + 1);

    // Format output specifically for the Ethiopian timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    console.log("Real Today (Ethiopia):", formatter.format(today));
    console.log("Real Expiry (Ethiopia):", formatter.format(expiryDate));
  }
}

// getRealEthiopianDates();

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

function db() {
    let sql = postgres(connectionString);
    return sql;
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

async function recharge(phoneNo, password, balance) {
    let sql;
    try {
        sql = postgres(connectionString);
        
        // 1. Fetch user data safely
        let users = await sql`SELECT id, password FROM users WHERE phone_number = ${phoneNo}`;
        
        if (!users || users.length === 0) {
            throw new Error("User not found!");
        }
        
        const user = users[0];

        // 2. Verify password immediately before running any math
        let checkPas = await bcrypt.compare(password, user.password);
        if (!checkPas) {
            throw new Error('Invalid password!');
        }

        const amount = parseFloat(balance);
        if (isNaN(amount) || amount <= 0 || amount%25 != 0) {
            throw new Error("Invalid deposit amount!");
        }
        
        // 3. FIXED PACKAGE LOGIC: 25 Br = 3 trials, 50 Br = 6 trials, 75 Br = 9 trials...
        let trials = Math.floor(amount / 25) * 3; 
        

        // 4. GENERATE ETHIOPIAN SYSTEM DATES
        // Use a trusted external anchor fallback framework similar to your helper
        let trueTimestamp = Date.now();
        try {
            let response = await fetch('https://cloudflare.com/cdn-cgi/trace');
            let text = await response.text();
            let tsLine = text.split('\n').find(line => line.startsWith('ts='));
            if (tsLine) {
                trueTimestamp = parseFloat(tsLine.split('=')[1]) * 1000;
            }
        } catch (e) {
            console.log("Cloudflare sync failed during recharge transaction, utilizing server backup time.");
        }

        let today = new Date(trueTimestamp);
        let expiryDate = new Date(trueTimestamp);
        expiryDate.setDate(today.getDate() + 1); // Sets expiration 1 day later

        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Addis_Ababa',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const formattedToday = formatter.format(today);
        const formattedExpiry = formatter.format(expiryDate);

        // 5. UPDATE THE DATABASE WITH RECHAGED_ON AND EXPIRY_DATE
        await sql`
            UPDATE users 
            SET balance = balance + ${amount}, 
                trials = trials + ${trials},
                recharged_on = ${formattedToday},
                expiry_date = ${formattedExpiry} 
            WHERE id = ${user.id}
        `;
        
        return true;
    }
    catch(err) {
        console.error("Recharge Error:", err.message);
        return false;
    }
    finally {
        if (sql) sql.end();
    }
}
// recharge('0949987315','1234','15.0')
// .then(data => console.log(data))
// .catch(err => console.log(err))
// console.log(Math.floor(19)/3*3)

module.exports = {login,products,addToCart,carts,createOrder,orders,deleteCart,orderFromCart,deleteExcessCart,cancelPendingOrder,searchCategory,insertUser,redeemCoin,recharge,db}