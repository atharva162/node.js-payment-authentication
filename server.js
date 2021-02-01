const express = require('express');
let session = require('express-session');
let passport = require('passport');
let LocalStrategy = require('passport-local');
const mongoose= require('mongoose');
let bcrypt = require('bcrypt'); 
const path = require('path');
require('dotenv').config();
const nodemailer = require('nodemailer');
const stripe = require('stripe')(process.env.SECRET_KEY);

const app = express();

app.use(express.urlencoded());
app.use(express.json());
          
app.use(session({
    secret: process.env.SECRET_SESSION,
    resave: true,
    saveUninitialized: true
}),passport.initialize(), passport.session())

let uri=process.env.DB_URI;
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

let purchasedetail = mongoose.Schema({
    amount: String,
    address: String,
    createdAt:{
        type: Date,
        default: new Date()
    }
  })
  let adminlog = mongoose.Schema({
    amount: String,
    item: String,
    createdAt:{
        type: Date,
        default: new Date()
    }
  })
  let personSchema = mongoose.Schema({
    email: String,
    password: String,
    role: String,
    log: [purchasedetail],
    log: [adminlog]
  });
  let purchaseSchema;
let User = mongoose.model('User',personSchema);
let Purchasedetail = mongoose.model('Purchasedetail',purchasedetail);
let Adminlog = mongoose.model('Adminlog',adminlog);
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

app.use(express.static(path.join(__dirname, './views')));

passport.serializeUser((user,done)=>{
    done(null,user._id);
})
passport.deserializeUser((userId, done)=>{
  User.findOne(
      { _id: userId},
  (error,doc)=>{
     done(null, doc);
  })
})

const port = 3000;
app.listen(port, () => 
console.log(`Server started on port ${port}`)
);
           app.post('/register', (req, res, next)=>{
              User.findOne({username: req.body.email},(error,user)=>{
                  if(!error && user){
                      res.json('User already exists')
                     }
                     })
                       let hash = bcrypt.hashSync(req.body.password, 12);
                       User.insertOne({
                       username: req.body.email,
                       role: req.body.role,
                       password: hash,
                               },
                               (error, createdUser)=>{
                                   if(!error && createdUser){
                                       next()
                                   }
                               }
                               )
                           },
                           passport.authenticate('local'),
                             (req,res)=>{
                                 res.json('Logged In')                     
                             }
                           )
               let findUser = new LocalStrategy(
                (email, password, done) => {
                    User.findOne(
                        {username: email},
                        (error, user)=>{
                            if(error){
                                return done(error)
                            }else if(!user){
                               res.json('No user with this mail exists')
                            }else if(!bcrypt.compareSync(password, user.password)){
                                res.json("Passwords don't match")
                            }else{
                                done(null, user)
                            }
                        }
                        )
                }
              )
              passport.use(findUser);
                app.get('/login',passport.authenticate('local'),
                 (request, response)=>{
                     console.log(request.user);
                     res.json('You are logged In')
                 }
              )
              let isSignedIn = (req,res,next)=>{
                if(req.isAuthenticated()){
                       next()
                }else{
                      res.json('You need to Login first');
                }
                 }
                 app.get('/profile', isSignedIn,(req,res)=>{
                    res.json('This is your profile stuff')
               })
               app.get('/admin',isSignedIn,(req,res)=>{
                    if(req.user.role=='admin'){
                        res.json('You are allowed to view this section')
                    }else{
                        res.json('Not allowed, requires Admin role')
                    }
           })
           app.post('/admin/generatelog',isSignedIn,(req,res)=>{
            if(req.user.role=='admin'){
                purchaselog = new Adminlog({
                    amount: req.body.amount,
                    item: req.body.item
                }),
                 User.findOneAndUpdate({username: req.user.email},{$push: {log: purchaselog}},{new: true},(err, updateddoc)=>
                    res.json(updateddoc)
            )
             }else{
                res.json('Not allowed, requires Admin role')
            }
   })
                 app.get('/logout',(req,res)=>{
                      req.logOut()
                      res.json('You are logged out')
                 })
                 app.use((req,res)=>{
                    res.status(404).type('text').send('Error 404 Page Not found')
                           })
                           app.post("/charge", (req, res) => {
                            try {
                              stripe.customers
                                .create({
                                  address: req.body.name,
                                  email: req.body.email,
                                  source: req.body.stripeToken
                                })
                                .then(customer =>
                                stripe.charges.create({
                                amount: req.body.amount * 100, //the amount //will come from front-end
                                currency: "INR",
                                customer: customer.id
                                  })
                                )
                                .then(() => 
                                purchaseSchema = new Purchasedetail({
                                    amount: req.body.amount,
                                    address: req.body.address
                                }),
                                 User.findOneAndUpdate({username: req.body.email},{$push: {log: purchaseSchema}},{new: true},(err, updateddoc)=>{
                                    let mailtransport = nodemailer.createTransport({
                                        service: 'gmail',
                                        auth:{
                                            user: process.env.MAIL,
                                            pass: process.env.PASSWORD
                                        }
                                    });
                                    let maildetails ={
                                        from: process.env.MAIL,
                                        to: req.body.email,
                                        subject: "Payment Successful",
                                        html:' <p>Your payment is received by us and your item will be delivered to you by next three working days. </p>'
                                    };
                                    mailtransport.sendMail(maildetails,(err,data)=>{
                                      res.json('Payment Successful');  
                                    })
                              }))
                                .catch(err => console.log(err));
                            } catch (err) {
                              res.send(err);
                            }
                          });