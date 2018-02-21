
var https = require('https');
var fs = require('fs');
var forceSsl = require('express-force-ssl');

var bcrypt = require('bcrypt');
const saltRounds = 10;

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

// Get all games/specific game currently IN queue
app.get('/queue', (request, response, next) => {

	// If user_id = 0, return all for that venue
	var venue_id = parseInt(request.query.venue_id);
	var machine_id = parseInt(request.query.machine_id);
	var user_id = parseInt(request.query.user_id);

	var sql = "SELECT G.* FROM GAME G Inner Join MACHINE M on G.machine_id=M.machine_id WHERE venue_id = ? AND queue_pos > -1";
	
	// If user_id is 0, return all users, else just specifc user
	if(user_id != 0) {
		sql += " AND user_id = ?";
	}

	if(machine_id != 0) {
		sql += " AND G.machine_id = ?"
	}

	sql += ";";
	
	var inserts = [venue_id, user_id, machine_id];
	sql = SQL.format(sql, inserts); 

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /queue: sent GAME details for venue: " + venue_id + " | user_id: " + user_id + " | machine_id: " + machine_id);
		}
	})
})

// Get current price of a certain machine in a specific venue to show the user.
app.get('/machine/price', (request, response, next) => {

	var venue_id = parseInt(request.query.venue_id);
	var category = request.query.category;

	var sql = "SELECT base_price, current_price FROM MACHINE WHERE venue_id = ?, category = ?;"
	var inserts = [venue_id, category];
	sql = SQL.format(sql, inserts); 

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /machine/price: got price of '" + category + "' machine in venue: " + venue_id);
		}
	})
})


// Get the list of machines in a specific venue.
app.get('/machine/all', (request, response, next) => {

	var venue_id = parseInt(request.query.venue_id);

	var sql = "SELECT * FROM MACHINE WHERE venue_id = ?"
	sql = SQL.format(sql, venue_id);

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /venue/machines: returned all the machines in venue: " + venue_id);
		}
	})
})

// Returns the current average wait time for a specfic type of machine in a specific venue.
app.get('/game/waitTime', (request, response, next) => {

	var venue_id = parseInt(request.query.venue_id);

	var sql = ""
	sql = SQL.format(sql, "");

	connection.query(sql, (err, result, fields) => {

		if(err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /game/waitTime - WAIT TIME")
		}

	})

})

///////////////////////////////////////////////// POST REQUESTS

// Allow a user to login/be authenticated.
app.post("/user/login", (request, response, next) => {

	var username = request.body.username;
	var password = request.body.password;

	var sql = "SELECT password_hash FROM USER WHERE username = ?";
	var inserts = [username];
	sql = SQL.format(sql, inserts); 

	connection.query(sql, (err, result, fields) => {

		if(err) {
			next(err);
		}
		else {

			bcrypt.compare(password, result[0].password_hash, (err, res) => {

				// If user details correct
				if(res) {
					response.sendStatus(200);
				}
				// If user details incorrect
				else {
					response.sendStatus(401);
				}
			})
		}

	})
})

// Add a new user to the service.
app.post('/user/add', (request, response, next) => {

	var username = request.body.username;
	var password = request.body.password;
	var name = request.body.name;
	var device_id = request.body.device_id;

	console.log("hello");
	
	// HASH PASSWORD
	bcrypt.hash(password, saltRounds, function(err, hash) {
		
		console.log("world");
		
		var sql = "INSERT INTO `USER` (username, password_hash, name, device_id) VALUES (?,?,?,?)";
		var inserts = [username, hash, name, device_id];
		sql = SQL.format(sql, inserts);

		connection.query(sql, (err, result) => {
	
			if(err) {
				next(err);
			}
			else {
				response.sendStatus(200);
				console.log("POST /user/add: Added new user - " + username);
			}

		});
	})
})

// Add a user to the queue — i.e. a user wants to play a game.
app.post('/queue/add', (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	//var venue_id = parseInt(request.body.venue_id);
	var machine_id = parseInt(request.body.machine_id);
	var time_requested = request.body.time_requested; // Use this later
	var matchmaking = parseInt(request.body.matchmaking); // Use this later
	var num_players = parseInt(request.body.num_players); // Use this later

	/*

	var time_add = request.body.time_add;
	var time_requested = request.body.time_requested;

	*/

	//var sql = "INSERT INTO `GAME` (user_id, time_add, number_players, machine_id, matchmaking) VALUES (?, ?, ?, (SELECT max(queue_pos) FROM (SELECT * FROM `USERS`) AS bob)+1)";
	var sql = "INSERT INTO `GAME` (user_id, time_add, machine_id, matchmaking, num_players, queue_pos) VALUES (?, ?, ?, ?, ?, (SELECT max(queue_pos) FROM (SELECT * FROM GAME AS get_queue WHERE queue_pos > 0 AND machine_id = ?) AS num_queue)+1)";
	var inserts = [user_id, new Date(), machine_id, matchmaking, num_players, machine_id];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("POST /queue/add: Added user to queue");
		}
	});
})

// Add a completely new type of machine to a specific venue
app.post('/machine/add', (request, response, next) => {

	var venue_id = parseInt(request.body.venue_id);
	var category = request.body.category;
	var total = parseInt(request.body.total);
	var base_price = parseInt(request.body.base_price);

	var sql = "INSERT INTO `MACHINE` (venue_id, category, total, available, base_price, current_price) VALUES (?,?,?,?,?,?);"
	var inserts = [venue_id, category, total, total, base_price, base_price]
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {

			// Now get machine_id of the machine that was just added
			var sql = "SELECT * FROM MACHINE WHERE machine_id=last_insert_id()"
			
			connection.query(sql, (err, result2) => {
				if(err) {
					next(err);
				}
				else {
					// Send 200 status back
					//response.sendStatus(200);
					response.send(result2)
					console.log("POST /machine/add: Added new machine");
				}
			})
		}
	});

})


///////////////////////////////////////////////// PUT REQUESTS

// Update statistics of an existing machine
app.put('/machine/edit', (request, response, next) => {

	var machine_id = parseInt(request.body.machine_id);
	var venue_id = parseInt(request.body.venue_id);
	var total = parseInt(request.body.total);
	var base_price = parseFloat(request.body.base_price);

	// Base sql
	var sql = "UPDATE MACHINE SET"

	if(total != 0) {
		sql += " total = " + connection.escape(total) + ", available = " + connection.escape(total)
		//sql = SQL.format(sql, total, total);

		if(base_price != 0) {
			sql += ", "
		}

	}
	if(base_price != 0) {
		sql += " base_price = " + connection.escape(base_price) + ", current_price = " + connection.escape(base_price)
		sql = SQL.format(sql, base_price)
	}
	
	sql += " WHERE machine_id = ?;";
	
	//var inserts = [total, total, base_price, base_price, machine_id]
	sql = SQL.format(sql, machine_id);

	console.log("MEME")
	console.log(sql);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("PUT /machine/edit: Update machine");
		}
	});


})


// Confirm the presence of a user/start the game.
app.put('/queue/gameStart', (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	var game_id = parseInt(request.body.game_id);
	
	var sql = "UPDATE GAME SET queue_pos = 0 WHERE game_id = ?;"
	// WILL NEED TO DECREASE NUMBER AVAILABLE MACHINE
	var inserts = [game_id];

	// SHUFFLE QUEUE UP
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("POST /queue/gameStart: Started GAME");
		}
	});
})

// Confirm game end.
app.put('/queue/gameEnd', (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	var game_id = parseInt(request.body.game_id);
	
	var sql = "UPDATE GAME SET queue_pos = -1 WHERE game_id = ?;"
	// WILL NEED TO INCREASE NUMBER AVAILABLE MACHINE
	// SHUFFLE QUEUE UP
	var inserts = [game_id];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("POST /queue/gameEND: Ended GAME");
		}
	});
})

// Update users device
app.put('/user/deviceid', (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	var device_id = request.body.device_id;

	var sql = "UPDATE USER SET device_id = ? WHERE user_id = ?"
	var inserts = [device_id, user_id];

	connection.query(sql, (err, result) => {

		if(err) {
			next(err);
		}
		else {
			response.sendStatus(200);
			console.log("POST /user/deviceid: Updated device ID for user " + user_id)
		}

	})

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
