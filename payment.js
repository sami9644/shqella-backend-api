const axios = require('axios');


const secretKey = process.env.chapa_secret_key
/**
 * Step 1: Get the checkout URL for the user
 */
async function initializePayment( amount, email, txRef, callbackUrl, returnUrl) {
    const url = "https://api.chapa.co/v1/transaction/initialize";
    
    const payload = {
        amount: amount.toString(),
        currency: 'ETB',
        email: email,
        tx_ref: txRef,
        callback_url: callbackUrl,
        return_url: returnUrl,
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${secretKey}`
            }
        });
        return response.data.data.checkout_url;
    } catch (error) {
        console.error("Initialization Error:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * Step 2: Check if the payment was actually successful
 */
async function verifyPayment( txRef) {
    const url = `https://api.chapa.co/v1/transaction/verify/${txRef}`;

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${secretKey}`
            }
        });

        const data = response.data;
        return data.status === 'success' && data.data?.status === 'success';
    } catch (error) {
        console.error("Verification Error:", error.response?.data || error.message);
        return false;
    }
}


const CHAPA_BASE_URL = "https://api.chapa.co/v1";


/**
 * Step 2: Move physical cash from your Escrow account 
 * to the Business bank account.
 */
async function settleToBusiness(amount, accountNumber, bankCode, businessName) {
    const url = `${CHAPA_BASE_URL}/transfers`;
    
    const payload = {
        account_name: businessName,
        account_number: accountNumber,
        amount: amount,
        currency: "ETB",
        bank_code: bankCode,
        reference: `settle-${crypto.randomBytes(4).toString('hex')}`
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.data == 'success') {
            throw new Error(response.data.message);
        }
        return response.data;
    } catch (error) {
        console.error("Transfer Error:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * Fetches the list of allowed banks from Chapa API.
 */
async function getChapaBankList() {
    const url = "https://api.chapa.co/v1/banks";

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            }
        });

        const data = response.data;

        if (data.message === "Banks retrieved") {
            return data.data || [];
        } else {
            console.log(`Error from Chapa: ${data.message}`);
            return [];
        }
    } catch (error) {
        console.error("HTTP Request failed:", error.response?.data || error.message);
        return [];
    }
}

getChapaBankList().then(data => console.log(data))

module.exports = {initializePayment,verifyPayment,settleToBusiness}