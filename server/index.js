const express = require('express');
const bodyParser = require('body-parser');
const basicAuth = require('basic-auth');
const app = express();
const port = 4000;

// Database
var SQL = require("mysql");
var connection = SQL.createConnection({
	host	: '127.0.0.1',
	user	: 'root',
	password: 'rosecolouredboy',
	database: 'cue'
});

//// Hard coded field names
var uid = "user_id";
var qpos = "queue_pos";
var t_add = "time_add_queue";
var t_gstart = "time_game_start";
var t_gend = "time_game_end";
var inq = "in_queue";
var nump = "num_players";
var bal = "account_balance";


// Connect to the database
connection.connect();

// Misc
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

///////////////////////////////////////////////// GET REQUESTS

// GET request -- webpage
app.get('/', (request, response) => {
	response.sendFile('/index.html', {root: 'public'});
	console.log("GET: Served /public/index.html");
})

// Get the current queue and all users in the queue
app.get('/queue', (request,response, next) => {

	// What user to grab
	var mode = parseInt(request.query.mode);
	var number_to_return = parseInt(request.query.num);
	var sql;
	var print;

	switch(mode) {

		case 1:
			sql = "SELECT * FROM `USERS`";
			print = "GET /queue: Served ALL users"
			break;
		case 2:
			sql = "SELECT * FROM `users` WHERE " + inq + " = 0";
			print = "GET /queue: Served users who have PLAYED/not in queue";
			break;
		case 3:
			sql = "SELECT * FROM `users` WHERE " + inq + " = 1";
			print = "GET /queue: Served users who have NOT PLAYED/in queue";
			break;
		default:
			console.log("Missing mode field");
			return next(new Error("Missing 'mode' field"));
	}

	if(number_to_return > 0) {
		sql = sql + " LIMIT " + number_to_return;
	}

	connection.query(sql, (err, result, fields) => {
		if (err) {
			next(err);
		}
		else {
			response.send(result);
			console.log(print);
		}
	});
})

// Get an individual user
app.get('/queue/user', (request, response, next) => {

	// What user to grab
	var user_to_get = parseInt(request.query.uid);

	var sql = "SELECT * FROM USERS WHERE " + uid + " = ?";
	sql = SQL.format(sql, user_to_get);

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(error);
		}
		else {
			response.send(result);
			console.log("GET /queue/user: Returned user '" + user_to_get + "'");
		}
	})

})

// Get the current queue and all users in the queue
app.get('/queue/completedTimes', (request, response, next) => {

	// How many records to return
	var number_to_return = parseInt(request.query.num_records);

	var sql = "SELECT " + t_add + "," + t_gstart + "," + t_gend + " FROM USERS WHERE " + inq + "= 0 ORDER BY " + t_gend;

	if(number_to_return < 0) {
		sql = sql + " LIMIT " + number_to_return;
	}

	sql = SQL.format(sql, number_to_return);

	connection.query(sql, (err, result, fields) => {
		if (err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /queue/completedTimes: Returned last " + number_to_return + " user times");
		}
	})
})

//Get the current average waiting time for a table
app.get('/queue/wait', (request, response, next) => {

	var sql = "SELECT SEC_TO_TIME(AVG(TIME_TO_SEC(TIMEDIFF("
	+ t_gstart + "," + t_add
	+")))) AS WAITING_TIME FROM USERS";
	sql = SQL.format(sql);

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(err);
		}
		else {
			response.send(result);
			console.log("GET /queue/wait: returned the average waiting time");
		}
	})
})

///////////////////////////////////////////////// POST REQUESTS

// Add a new user to the queue -- user_id, number_players
app.post("/queue/add", (request, response, next) => {

	var user_id = parseInt(request.body.uid);
	var number_players = parseInt(request.body.num_players);

	var sql = "INSERT INTO `USERS` (user_id, time_add_queue, number_players, queue_pos) VALUES (?, ?, ?, (SELECT max(queue_pos) FROM (SELECT * FROM `USERS`) AS bob)+1)";
	var inserts = [user_id, new Date(), number_players];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("POST /queue/add: User '" + user_id + "' added to queue!");
		}
	});
})

///////////////////////////////////////////////// PUT REQUESTS -- streamline this

// Sets the game start time of particular user
app.put("/users/status/start", (request, response, next) => {

	var user_id = parseInt(request.body.uid);

	var sql = "UPDATE `USERS` SET " + t_gstart + " = ? WHERE user_id = ?;";
	var inserts = [new Date(), user_id];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("Set start_game_time of '" + user_id + "' to now");
		}
	});
})

// Sets game end time of particular user + sets in_queue to 0
app.put("/users/status/end", (request, response, next) => {

	var user_id = parseInt(request.body.uid);

	var sql = "UPDATE `USERS` SET " + t_gend + " = ?, " + inq + "= 0 WHERE user_id = ?;";
	var inserts = [new Date(), user_id];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back
			response.sendStatus(200);
			console.log("Set end_game_time of '" + user_id + "' to now");
		}
	});
})

///////////////////////////////////////////////// DELETE REQUESTS

// Delete an item from the queue
app.delete('/users/delete', (request, response, next) => {

	// Get the user ID to delete
	var user_to_delete = request.body.uid;

	var sql = "UPDATE `USERS` SET queue_pos = queue_pos-1 WHERE queue_pos > (SELECT queue_pos FROM ((SELECT * FROM `users`) AS queue_del) WHERE user_id = ?) && " + inq + "= 1;"
	sql = SQL.format(sql, user_to_delete);

	// Reduce queue position by 1 for all items after deleted // only adjusts for those currently in queue
	connection.query(sql, (err,result) => {
		if(err) {
			next(err)
		}
		else {
			console.log("Adjusted queue positions");


			// Delete user from queue
			connection.query("DELETE FROM `USERS` WHERE user_id = (?)", user_to_delete, (err,result) => {
			if (err) {
				next(err);
			}
			else {
				// Send 200 status
				response.sendStatus(200);
				console.log("Deleted user '" + user_to_delete + "'");
			}
		});

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

app.all("/config/*", auth);

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

    // Send an error message to the user.
	response.status(500).send(error.message);

});
