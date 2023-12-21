const express = require('express');
const bodyparser = require('body-parser');
const dotenv = require('dotenv').config();
const cors = require('cors');
// const { notFound, erroHandler } = require('./middlewares/errorMiddleware');
const https = require('https')
const fs = require('fs');
const app = express()
const port = process.env.PORT || 8008;
// const userrouter = require('./routs/userRouts/user.routs');

// app.use(cors({
//   credentials: true,
//   origin: [
//     "http://localhost:3000",
//     "http://localhost:5000"
//   ],
//   exposedHeaders: ["set-cookie"],
// }));

app.use(cors());
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});
app.use(bodyparser.urlencoded({ extended: false }))
app.use(bodyparser.json())

// app.use('/userrouter', userrouter);

// app.use(notFound);
// app.use(erroHandler);

app.listen(port, () => console.log(`Connecion suceesfull ${port}`)) 