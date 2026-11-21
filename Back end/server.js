const express = require('express');
const morgan = require('morgan');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(morgan("dev"));

app.get('/api', async(req,resp,next) => {
    try {
        resp.status(200).json({message:`Welcome Express server`});
    } catch (error) {
        next(error);
    }
});


(async()=>{
    try {

        const server = app.listen(process.env.PORT, () => {
            console.log(`API chạy tại http://localhost:${process.env.PORT}/api`);
        });
        
    } catch (error) {
        console.error(`Không khởi động được server: `, error.message);
        process.exit(1);
    }
})()