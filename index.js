const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidV4 } = require('uuid');
const userS = [], userI = [];
const ExpressPeerServer = require('peer').ExpressPeerServer;
const peerServer = ExpressPeerServer(server, {
  debug: true
});

const mongoose=require("mongoose");


mongoose.connect("mongodb://localhost:27017/userData",{useNewUrlParser: true,useUnifiedTopology: true});

const userSchema=mongoose.Schema({
	username:String,
	password:String
});

const User=mongoose.model("usertable",userSchema);

app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.use(express.static('public'));

//===========================================================
app.get('/', (req, res) => {
	res.render("register");
	
	// res.redirect(`/${uuidV4()}`);  //send uuid to client address bar
});

app.get('/home',(req,res)=>{
	res.render("home", { id: uuidV4() });
})

app.get("/login",(req,res)=>{
	res.render("login");
})

app.get('/:room', (req, res) => {
	let addRoomId = req.params.room;
	console.log(addRoomId);
	console.log(userS[0]);
	res.render('room', { roomId: `${addRoomId}` }); //get id from address bar and send to ejs
});

//===========================================================

app.post("/register",function(req,res){
	const username=req.body.username;
	const password=req.body.password;

	const user=new User({
		username:username,
		password:password
	});

	user.save(function(err){
		if(err){
			console.log(err);
		}
		else{
			res.redirect("/login");
		}
	});

	
});

app.post("/login",function(req,res){
	const username=req.body.username;
	const password=req.body.password;

	User.findOne({username:username},function(err,result){
		if(!err){
			if(!result)
			{
				res.send("User not registered");
			}
			else
			{
				if(result.password===password){
					console.log(result);
					res.redirect("/home");
				}
				else{
					console.log("Wrong password");
					res.redirect("/login");
				}
				
			}
		}
		
	})

})



io.on('connection', socket =>{
	//code to disconnect user using socket simple method ('join-room')
	socket.on('join-room',(roomId, userId) =>{

		userS.push(socket.id);
		userI.push(userId);
		//console.log("room Id:- " + roomId,"userId:- "+ userId);    //userId mean new user

		//join Room
		console.log("room Id:- " + roomId,"userId:- "+ userId);    //userId mean new user
		socket.join(roomId);                                       //join this new user to room
		socket.to(roomId).emit('user-connected',userId); //for that we use this and emit to cliet

		//Remove User
	    socket.on('removeUser', (sUser, rUser)=>{
	    	var i = userS.indexOf(rUser);
	    	if(sUser == userI[0]){
	    	  console.log("SuperUser Removed"+rUser);
	    	  socket.to(roomId).broadcast.emit('remove-User', rUser);
	    	}
	    });

		//code to massage in roomId
		socket.on('message', (message,yourName) =>{
			io.to(roomId).emit('createMessage',message,yourName);

		})

	    socket.on('disconnect', () =>{
	    	//userS.filter(item => item !== userId);
	    	var i = userS.indexOf(socket.id);
	    	userS.splice(i, 1);
            socket.to(roomId).broadcast.emit('user-disconnected', userI[i]);
            //update array

            userI.splice(i, 1);
	    });
	    socket.on('seruI', () =>{
	    	socket.emit('all_users_inRoom', userI);
			//console.log(userS);
		    console.log(userI);
	    });
	})

})

server.listen(process.env.PORT || 3000, function() {
  console.log("Server is running on port 3000");
});
