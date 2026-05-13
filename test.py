import requests
def reguser():
    payload = {
        "fullName":"sami",
        "email":"ethio@gmail.com",
        "gender":"male",
        "birthdate":"2000-12-15",
        "password":"12345"
    }
    res = requests.post(url='http://localhost:3000/api/register/user',json=payload)
    print(res)

def login():
    payload = {
        'email':"ethio@gmail.com",
        'password':"12345"
    }
    res = requests.post(url='http://localhost:3000/api/login',json=payload)
    print(res.json())

login()