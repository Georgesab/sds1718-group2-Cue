
 
var https = require('https');
var fs = require('fs');
var forceSsl = require('express-force-ssl');

var bcrypt = require('bcrypt');
const saltRounds = 10;
const plain = "helloWorld";
const plain2 = "worldHello";

const express = require('express');
const bodyParser = require('body-parser');
const basicAuth = require('basic-auth');
const app = express();
const port = 80;

var options = {
	key: fs.readFileSync('/etc/letsencrypt/live/idk-cue.club/privkey.pem'),
	cert: fs.readFileSync('/etc/letsencrypt/live/idk-cue.club/cert.pem'),
	ca: fs.readFileSync('/etc/letsencrypt/live/idk-cue.club/chain.pem')
};

// Database
var SQL = require("mysql");
var connection = SQL.createConnection({
	host	: '127.0.0.1',
	user	: 'blockchain',
	password: 'rosecolouredboy',
	multipleStatements: true,
	database: 'SDS1'
});

// Connect to the database
connection.connect();

// Misc
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(forceSsl);

///////////////////////////////////////////////// GET REQUESTS

// GET request -- webpage
app.get('/', ( request, response, next) => {
	response.sendFile('/index.html', {root: 'public'});
	console.log("GET: Served /public/index.html");

	//if(err) console.log(err);

})

// GET request - queue
app.get('/queue', (request, response, next) => {

	// If user_id = 0, return all for that venue
	var venue_id = parseInt(request.query.venue_id);
	var user_id = parseInt(request.query.user_id);

	var sql = "SELECT G.* FROM GAME G Inner Join MACHINE M on G.machine_id=M.machine_id WHERE venue_id = ?";
	
	if(user_id != 0) {
		sql += " AND user_id = ?;";
	}
	else {
		sql += ";";
	}
	
	var inserts = [venue_id, user_id];
	sql = SQL.format(sql, inserts); 

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /queue: sent GAME details for venue: " + venue_id + " | user_id: " + user_id);
		}
	})
})

// GET request - see if a table is available
app.get('/queue/isTableAvailable', (request, response, next) => {

	var venue_id = parseInt(request.query.venue_id);
	var user_id = parseInt(request.query.user_id);

	var sql = "SELECT G.* FROM GAME G Inner Join MACHINE M on G.machine_id=M.machine_id WHERE venue_id = ?";

	connection.query(sql, (err,result, fields) => {
		if(err) {
			next(err);
		}
		else {
			////
		}
	})
	

	// TODO: Implement me 

})


// GET request - price of specific machine in specific venue
app.get('/machine/price', (request, response, next) => {

	var venue_id = parseInt(request.query.venue_id);
	var machine_type = request.query.machine_type;

	var sql = "SELECT base_price, current_price FROM MACHINE WHERE venue_id = ?, category = ?;"
	var inserts = [venue_id, machine_type];
	sql = SQL.format(sql, inserts); 

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /machine/price: got price of machine");
		}
	})
})


// Get queue position of a particular user
app.get('/queue/pos', (request, response, next) => {

	var user_id = parseInt(request.query.user_id);

	var sql = "SELECT queue_pos FROM GAME WHERE user_id = ?"
	sql = SQL.format(sql, user_id);

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /queue/pos: returned position of user " + user_id);
		}
	})
})

// Get all machines for a particular venue
app.get('/venue/machines', (request, response, next) => {

	var pub_id = parseInt(request.query.pub_id);

	var sql = "SELECT * FROM MACHINE WHERE venue_id = ?"
	sql = SQL.format(sql, pub_id);

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /venue/machines: returned all the machines in this pub.");
		}
	})
})

///////////////////////////////////////////////// POST REQUESTS

app.post('/user/add/demo', (request, response, next) => {

	var username = request.body.username;
	var device_id = request.body.device_id;
	var password = "123";
	var name = "daniel";

	var sql = "INSERT INTO `USER` (username, password, name, device_id) VALUES (?,?,?, ?)";
	var inserts = [username, password, name, device_id];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {

		if(err) {
			next(err);
		}
		else {
			response.sendStatus(200);
			console.log("DEMO USER ADDED!");
		}
	});
})

app.post('/queue/add/demo', (request, response, next) => {

	var username = parseInt(request.body.username);
	var venue_id = parseInt(request.body.venue_id);
	var machine_type = request.body.machine_type;
	var time_requested = requested.body.time_requested;


	var sql = "INSERT INTO `GAME` (user_id, venue_id, time_add, machine_id) VALUES ((SELECT user_id FROM USER WHERE username = ?), ?, ?, ?)";
	var inserts = [username, venue_id, new Date(), machine_id];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("ADDED DUMMY");
		}
	});
})




// Allow a user to login -- currently checks the login details
app.post("/user/login", (request, response, next) => {

	var username = request.body.username;
	var password = request.body.password;

	var sql = "SELECT password FROM USER WHERE username = ?";
	var inserts = [username];
	sql = SQL.format(sql, inserts); 

	connection.query(sql, (err, result, fields) => {
		//console.log(result[0].password);
		//console.log();

		if(err) {
			next(err);
		}
		else {

			bcrypt.compare(password, result[0].password, (err, res) => {
				console.log(res);

				if(res) {
					response.sendStatus(200);
				}
				else {
					response.sendStatus(401);
				}
			})
		}

	})

	/*
	// NEED TO GET THE HASH SOMEHOW
	bcrypt.compare(password, hash, (err, res) => {
		
	})
	*/

	// DO SOME CHECKING LOGIC

})

// Add a new user to the service
app.post("/user/add", (request, response, next) => {

	// USER ID IS AUTO-GENERATED
	//var user_id = parseInt(request.body.user_id);
	var username = request.body.username;
	var password = request.body.password;
	var name = request.body.name;

	var pwhash;

	// HASH PASSWORD
	bcrypt.hash(password, saltRounds, function(err, hash) {
		if(err) console.log(err);
		
		var sql = "INSERT INTO `USER` (username, password, name) VALUES (?,?,?)";
		var inserts = [username, hash, name];
		sql = SQL.format(sql, inserts);

		connection.query(sql, (err, result) => {
	
			if(err) {
				next(err);
			}
			else {
				response.sendStatus(200);
				console.log("ok...");
			}

		});

	});

	//// TBA -- ADD HASHING AND SALTING
	/* 
	var sql = "INSERT INTO `USER` (u/sername, password, name) VALUES (?, ?, ?)";
	var inserts = [username, bob, name];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("POST /user/add: Added to queue");
		}
	});

	*/
})

// Start a new GAME request in the queue
app.post("/game/add", (request, response, next) => {

	var user_id = parseInt(request.body.uid);
	var number_players = parseInt(request.body.number_players);
	var machine_id = parseInt(request.body.machine_id);
	var matchmaking = parseInt(request.body.matchmaking);

	var sql = "INSERT INTO `GAME` (user_id, time_add, number_players, machine_id, matchmaking) VALUES (?, ?, ?, (SELECT max(queue_pos) FROM (SELECT * FROM `USERS`) AS bob)+1)";
	var inserts = [user_id, new Date(), number_players, matchmaking];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("POST /game/add: User '" + user_id + "' added to queue!");
		}
	});
})

///////////////////////////////////////////////// PUT REQUESTS

// Sets a user to currently playing a game
app.put("/game/status/start", (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	var game_id = parseInt(request.body.game_id);

	var sql = "UPDATE `GAME` SET " + time_start + " = ?, queue_pos = 0 WHERE user_id = ? AND game_id = ?;";
	
	// ALSO NEED TO UPDATE QUEUE
	
	var inserts = [[new Date(), user_id, game_id]];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("Set time_start of '" + user_id + "' to now");
		}
	});
})

// Sets a user to having finished a game
app.put("/game/status/end", (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	var game_id = parseInt(request.body.game_id);

	var sql = "UPDATE `GAME` SET " + time_end + " = ?, queue_pos = -1 WHERE user_id = ? AND game_id = ?;";
	var inserts = [[new Date(), user_id, game_id]];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("Set end_time of '" + user_id + "' to now");
		}
	});
})

///////////////////////////////////////////////// MISC

var auth = function (req, res, next) {
  var user = basicAuth(req);
  if (!user || !user.name || !user.pass) {
    res.set('WWW-Authenticate', 'Basic realm="This pages requires logging in to access"');
    res.sendStatus(401);
    return;
  }
  if (user.name === 'idk' && user.pass === 'blockchain') {
    next();
  } else {
    res.set('WWW-Authenticate', 'Basic realm="This pages requires logging in to access"');
    res.sendStatus(401);
    return;
  }
}

app.all("/config*", auth);

app.get("/config", function (req, res) {
	res.send("CONFIG PAGE FOR THE SERVER/DATABASE");
	console.log("GET: Served dummy authentication page");
});

app.get("/config/stats", function (req, res) {
	res.send("CONFIG PAGE FOR STATS");
	console.log("GET: Served dummy stats page");
});

// Start listening on the current port
app.listen(port, (err) => {
	if(err) {
		return console.log('Something bad happened: ', err);
	}

	console.log("Server started. Now listening on port " + port);
})

// Error handling
app.use(function(error, request, response, next) {
    console.log("Error handler: ", error.message);
	
	console.log(error);
    // Send an error message to the user.
	response.status(500).send(error.message);

});

https.createServer(options, app).listen(443);
