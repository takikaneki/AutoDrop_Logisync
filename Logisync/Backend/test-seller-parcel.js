const http = require("http");

const loginData = JSON.stringify({
  email: "seller@example.com",
  password: "password123"
});

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(body)
          });
        } catch {
          resolve({
            status: res.statusCode,
            body
          });
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

async function test() {
  try {
    // 1. Login
    const login = await request({
      hostname: "localhost",
      port: 5000,
      path: "/api/auth/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(loginData)
      }
    }, loginData);

    console.log("LOGIN");
    console.log("Status:", login.status);

    if (!login.body.token) {
      console.log("Login failed:", login.body);
      return;
    }

    const token = login.body.token;

    // 2. Get parcel
    const parcel = await request({
      hostname: "localhost",
      port: 5000,
      path: "/api/parcels/seller/PX123456",
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("\nSELLER PARCEL");
    console.log("Status:", parcel.status);
    console.log("Response:", JSON.stringify(parcel.body, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

test();