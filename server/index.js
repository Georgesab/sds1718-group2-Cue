const express = require('express');
const bodyParser = require('body-parser');
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

// Connect to the database
connection.connect();

// Misc
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// GET request
app.get('/', (request, response) => {
	//response.send('hello\n')
	response.sendFile("public/index.html");
})

// Add a new user to the queue -- user_id, number_players
app.post("/addToQueue", (request, response) => {

	var user_id = request.body.user_id;
	var number_players = request.body.num_players;

	var sql = "INSERT INTO `users` (user_id, time_added, number_players) VALUES (?, ?, ?)";
	var inserts = [user_id, new Date(), number_players];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			console.log(err);	
		}
		console.log("User '" + user_id + "' added to queue!");
	});
	response.sendStatus(200);
})

// Delete an item from the queue
// TODO: Change or add a request to only delete the front of the queue
app.delete('/queue/delete', (request, response) => {

	var user_to_delete = request.body.userid;

	response.send('Deleting user' + user_to_delete);

	connection.query("DELETE FROM `users` WHERE (userid) = (?)", user_to_delete, (err,result) => {
		if (err) throw err;
	});
  })


// Get the current queue and all users in the queue
app.get('/queue', (request,response) => {

	connection.query("SELECT * FROM `users`", (err, result, fields) => {
		if (err) throw err;
		response.send(result);
	});

})

// Start listening on the current port
app.listen(port, (err) => {
	if(err) {
		return console.log('something bad', err)
	}

	console.log("Server started. Now listening on: " + port);
})