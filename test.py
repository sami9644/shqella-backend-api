import requests
def redeem_coin():
    payload = {
        "phone":"0949987315",
        "password":"1234",
        "coin":"12"
    }
    res = requests.post(url='http://localhost:3000/redeem/coin',json=payload)
    print(res.json())
