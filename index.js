const express = require('express');
const app = express();
const fs = require('fs');
const server = require('http').createServer(app);
const WebSocket = require("ws");
const host={uid:"",sid:"",name:""}


// ====================Socket===========================

const io = require('socket.io')(server);
const {
  v4: uuidV4
} = require('uuid');
const userS = [],
  userI = [];
const ExpressPeerServer = require('peer').ExpressPeerServer;

//===========Database===============

// const app = express();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const mongoose = require("mongoose");
const session = require("express-session");
const passportLocalMongoose = require("passport-local-mongoose");

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/users", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const userSchema = new mongoose.Schema({
  username: String,
  name: String,
  password: String,
  meetings: [{
    date: Date,
    time: String
  }]
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// =============================================================


//=======================GET-ROUTES====================================

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
})

app.get("/register", (req, res) => {
  res.render("register");
});


app.get("/login", (req, res) => {
  res.render("login");
});


app.get('/lobby', (req, res) => {
  if (req.isAuthenticated()) {
    res.render("lobby", {
      id: uuidV4()
    }); //send uuid to client address bar
  } else {
    res.redirect("/login");
  }
});

app.get("/schedule", (req, res) => {
  res.render("schedule");
})


app.get('/:room', (req, res) => {
  if (req.isAuthenticated()) {
    let addRoomId = req.params.room;

    res.render('room', {
      roomId: `${addRoomId}`
    }); //get id from address bar and send to ejs
  } else {
    res.redirect("/");
  }
});


//=======================POST-ROUTES====================================

app.post("/login", (req, res) => {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/lobby");
      })
    }
  })
});

app.post("/schedule", (req, res) => {

  if (req.isAuthenticated()) {
    // console.log(req.user);
    const date = req.body.date;
    const time = req.body.time;

    // console.log(date + " " + time);

    User.updateOne({
      username: req.user.username
    }, {
      $push: {
        "meetings": {
          date: date,
          time: time
        }
      }
    },function(err){
      if(err){
        console.log(err);
      }else{
        console.log("updated successfully");
      }
    });
    res.redirect("/lobby");
  } else {
    res.redirect("/register");
  }

})

// const wss=new WebSocket.Server({ server });
//
// wss.on("connection",ws=>{
//
//
// })

//===========================SOCKET-CONNECTION=================================

io.on('connection', socket => {

  console.log("Socket connected");

  //Register route
  app.post("/register", (req, res) => {

    User.register({
      username: req.body.username,
      name: req.body.name,
      meetings: []
    }, req.body.password, function(err, user) {
      if (err) {
        console.log(err);
        socket.emit("message", "User exists!Please login")
        // res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/login");
        });
      }
    })

  });
  //====================================

  //code to disconnect user using socket simple method ('join-room')
  socket.on('join-room', (roomId, userId ,username) => {

    if(userS.length===0){
      host.sid=socket.id;
      host.uid=userId;
      host.name=username;
      // console.log("Host: "+host.uid);
    }
    userS.push(socket.id);
    userI.push({uid:userId,name:username});
    //console.log("room Id:- " + roomId,"userId:- "+ userId);    //userId mean new user

    //join Room
    console.log("room Id:- " + roomId, "userId:- " + userId); //userId mean new user
    socket.join(roomId); //join this new user to room
    io.to(roomId).emit("get-host",host.uid);
    socket.to(roomId).emit('user-connected', userId); //for that we use this and emit to cliet
    //Remove User
    socket.on('removeUser', (sUser, rUser) => {
      // var i = userS.indexOf(rUser);
      if (sUser === host.uid) {
        console.log("User Removed" + rUser);
        socket.to(roomId).broadcast.emit('remove-User', rUser);
      }
    });

    //code to massage in roomId
    socket.on('message', (message, yourName) => {
      io.to(roomId).emit('createMessage', message);

    })

    socket.on('disconnect', () => {
      //userS.filter(item => item !== userId);
      var i = userS.indexOf(socket.id);
      userS.splice(i, 1);
      socket.to(roomId).broadcast.emit('user-disconnected', userI[i].uid);
      //update array

      userI.splice(i, 1);
    });
    socket.on('seruI', () => {
      socket.emit('all_users_inRoom', userI);
      //console.log(userS);
      console.log(userI);
    });
  })

})

// =======================SERVER-CONNECTION============================


server.listen(process.env.PORT || 3000, function() {
  console.log("Server is running on port 3000");
});
