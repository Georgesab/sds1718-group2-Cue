var https = require('https');
var fs = require('fs');
var forceSsl = require('express-force-ssl');
var async = require('async');
var bcrypt = require('bcrypt');

const saltRounds = 10;
const express = require('express');
const bodyParser = require('body-parser');
const basicAuth = require('basic-auth');
const app = express();
const unixTimestamp = require("unix-timestamp")
const port = 80;
const uuidv1 = require('uuid/v1');

// Enable HTTPS
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

var SAN = require("sql-template-strings");

// Connect to the database
connection.connect();

// Misc
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(forceSsl);

// Firebase
var serverKey = 'AAAA7qf1S-s:APA91bHj07GD0akUObgNBy8VnF2HGjrgZ5OJRtaBTmK3yTS_aYQV3vnlbE75laH3GOcg_FTwe2aYosIFC3mXDkFUxTO4N-yJe2Zda31uQUyxod73FGSPBFUIF_7uzDIQ34IiCi_kGewV';
var FCM = require('fcm-push');
var fcm = new FCM(serverKey);

///////////////////////////////////////////////// HELPER/REUSABLE FUNCTIONS
// Used to authenticate a user with the session_cookie
function authentication(user_id, session_cookie, next, callback) {
	
	var auth_query = (SAN
		
		`SELECT user_id, session_cookie FROM USER WHERE user_id = ${user_id} && session_cookie=${session_cookie};`
	);

	connection.query(auth_query, (err,result,fields) => {
		if(err || result === undefined || result.length == 0 || result == null) {
			console.log("AUTH DENIED");
			callback(null, {"auth":0})
		}
		else {
			console.log("AUTHENTICATION");
			callback(null, {"auth":1});
		}
	})
}

// Used to authenticate a user with the session_cookie && check they are the admin of the venue they're trying to modify
function authentication_admin(user_id, session_cookie, venue_id, next, callback) {

	var auth_query = (SAN
		`SELECT user_id, session_cookie FROM USER WHERE user_id = ${user_id} && session_cookie=${session_cookie};`
	);

	var admin_query = (SAN
		`SELECT * FROM ADMIN WHERE user_id = ${user_id} && venue_id=${venue_id};`
	);

	connection.query(auth_query, (err_auth, result_auth, fields) => {
		if(err_auth || result_auth === undefined || result_auth.length == 0 || result_auth == null) {
			console.log("AUTH DENIED");
			callback(null, {"auth":0})
		}
		else {

			connection.query(admin_query, (err_admin, result_admin, fields) => {

				if(err_admin || result_admin === undefined || result_admin.length == 0 || result_admin == null) {
					console.log("AUTH DENIED");
					callback(null, {"auth":0})
				}
				else {
					console.log("AUTHENTICATION");
					callback(null, {"auth":1});	
				}

			})
		}
	})
}

// Calculate average game duration.
function getAvgGameDuration(queue_id, next, callback) {

	var query = (SAN
		`SELECT (AVG(TIMESTAMPDIFF(SECOND, time_start, time_end))/60) AS dur
			FROM GAME
				WHERE wait_id=${queue_id} AND state=5;`
	);

	connection.query(query, (err, result, fields) => {
		if (err){
			console.log(err);
			callback(null, {"dur":-1});
		}
		else{
			if (result[0].dur == null) {
				callback(null, {"dur":10});
			}
			else {
				callback(null, {"dur":result[0].dur});
			}
		}
	})
}

// Calculate how many users are in a queue.
function getQueueLength(queue_id, next, callback) {
	var query = (SAN
		`SELECT COUNT(game_id) AS length FROM GAME
			WHERE wait_id=${queue_id} AND state<3;`
	);

	connection.query(query, (err, result, fields) => {
		if (err) {
			console.log(err);
			callback(null, {"length":-1});
		}
		else {
			callback(null, {"length":result[0].length});
		}
	})
}

// Find how many machines supply a queue.
function getNumMachines(queue_id, next, callback) {
	var query = (SAN
		`SELECT num_machines FROM QUEUE
			WHERE queue_id=${queue_id};`
	)

	connection.query(query, (err, result, fields) => {
		if (err) {
			console.log(err);
			callback(null, {"num_machines":-1});
		} else {
			callback(null, {"num_machines":result[0].num_machines});
		}
	})
}


// Check if a machine in a queue is available right now.
function getAvailableMachines(queue_id, next, callback) {
	
	var query = (SAN
		`SELECT machine_id FROM
			QUEUE Q LEFT JOIN MACHINE M
				ON Q.venue_id=M.venue_id AND Q.category=M.category
			WHERE queue_id=${queue_id}
			AND available=1;`
	);

	connection.query(query, (err, result, fields) => {
		
		if (err) {
			next(err);
		}
		else {

			if (result.length == 0) {
				callback(null, {"available":"None"});
			} else {
				callback(null, {"available":result});
			}
		}
	});
}


// Calculate expected waiting time for a given queue.
function getQueueStatus(queue_id, next, callback) {
	
	getAvgGameDuration(queue_id, next, (err, dur_result) => {
		
		var dur = dur_result.dur;

		if (dur == -1) {
			callback(null, {"wait":-1});
		} else {
			getQueueLength(queue_id, next, (err, length_result) => {
				
				var length = length_result.length;
					
				if (length == -1) {
					callback(null, {"wait":-1});
				} else {
					if (length == 0) {
						getAvailableMachines(queue_id, next, (machine_err, machine_result) => {
							if (machine_err) {
								next(machine_err);
							} else {

								console.log("TESTING: Available: "+ (machine_result.available==="None"));
								if (machine_result.available==="None") {
                                                			getNumMachines(queue_id, next, (err, num_result) => {

                                                        			var num = num_result.num_machines;
										console.log("TESTING: Machines: " + num);
                                                        			if (num == -1) {
                                                                			callback(null, {"wait":-1});
                                                        			} else {
                                                                			var wait = Math.round(dur);
                                                                			callback(null, {"wait":wait, "queue_size":length});
                                                				}
									})
                                        			} else {
                                                			callback(null, {"wait":0, "queue_size":0});
                                        			}
							}
						})		
					} else {
						getNumMachines(queue_id, next, (err, num_result) => {
						
							var num = num_result.num_machines;
	
							if (num == -1) {
								callback(null, {"wait":-1});
							} else {
								var wait = Math.round(dur + ((dur * length) / num));
								callback(null, {"wait":wait, "queue_size":length});
							}
						})
					}
				}					
			})
		}
	})
} 

// Calculate a user's position within a particular queue.
function getQueuePosition(user_id, queue_id, next, callback) {
	
	var query = (SAN
		`SELECT COUNT(game_id) AS num_in_front FROM GAME
			WHERE state<3
			AND user_id!=${user_id}
			AND wait_id=${queue_id}
			AND time_add<
				(SELECT time_add from GAME
					WHERE user_id=${user_id}
					AND state<3
					AND wait_id=${queue_id}
				);`
	);

	connection.query(query, (err, result, fields) => {
		
		if (err) {
			console.log(err);
			callback(null, {"position":-1});
		} else {
			var position = result[0].num_in_front + 1;
	
			if (position == 1) {
				getAvailableMachines(queue_id, next, (err_machines, result_machines) => {
					if (result.available==="none") {
						callback(null, {"position":position});
					} else {
						var machine_id = result_machines.available[0].machine_id;
						callback(null, {"position":0, "machine_id":machine_id});
					}
				})
			} else {
                        	callback(null, {"position":position});
			}
		}
	})
}


// Calculate a user's position and predicted waiting time within a queue.
function getUserQueueStatus(user_id, queue_id, next, callback) {
	
	getAvgGameDuration(queue_id, next, (err, dur_result) => {

        var dur = dur_result.dur;

        if (dur == -1) {
            callback(null, {"wait":-1});
        } else {
            getQueuePosition(user_id, queue_id, next, (err, position_result) => {

            	var position = position_result.position;

            	if (position == -1) {
        
 	               callback(null, {"wait":-1});
				} 
				else if (position == 0) {
				
					var machine_id = position_result.machine_id;

					callback(null, {"wait":0, "position":0, "machine_id":machine_id});
    	        } else {
                                        
        	        getNumMachines(queue_id, next, (err, num_result) => {

        		        var num = num_result.num_machines;

                		if (num == -1) {
                    		callback(null, {"wait":-1});
               			} else {
                    		var wait = Math.round((dur * position) / num);
                    		callback(null, {"wait":wait, "position":position});
                		}
           			})
                }
            })
        }
    })	
}

// Work out which - if any - queue a user is in.
function getUserQueue(user_id, next, callback) {
	
	var query = (SAN
		`SELECT QUEUE.queue_id, VENUE.venue_name, VENUE.venue_id, QUEUE.category FROM
    			QUEUE LEFT JOIN VENUE
        			ON VENUE.venue_id=QUEUE.venue_id
    			WHERE queue_id IN
        			(SELECT wait_id FROM GAME
        			    WHERE user_id=${user_id}
    					AND state<3
        			);`
	);

	connection.query(query, (err, result, fields) => {
		if (err) {
			next(err);
		} else {
			if (result.length == 0) {
				callback(null, {"Queue":"None"});
			} else {
				callback(null, {"Queue":result[0]});
			}
		}
	})
}


function getQueueDetails(queue_id, next, callback) {

	var query = (SAN
		`SELECT DISTINCT(queue_id) queue_id, QUEUE.category, num_machines, current_price 
			FROM QUEUE LEFT JOIN MACHINE
				ON(QUEUE.category=MACHINE.category AND QUEUE.venue_id=MACHINE.venue_id)
			WHERE queue_id=${queue_id};`
	);

	connection.query(query, (err_det, result_det, fields) => {
	
		if (err_det) {
			next(err_det);
		} else {
			getQueueStatus(queue_id, next, (err_stat, result_stat) => {
				callback(null, {"queue_id":result_det[0].queue_id, 
						"category":result_det[0].category, 
						"num_machines":result_det[0].num_machines,
						"current_price":result_det[0].current_price,
						"wait_time":result_stat.wait,
						"queue_size":result_stat.queue_size});
			})
		}
	})
 
}

// Ready a game for commencing by a user.
function prepareGame(game_id, machine_id, user_id, next, callback) {
	
	var query_game = (SAN
		`UPDATE GAME
			SET machine_id=${machine_id}, state=2
			WHERE game_id=${game_id};`
	);

	var query_machine = (SAN
		`UPDATE MACHINE
			SET available=0
			WHERE machine_id=${machine_id};`
	);

	var query_user = (SAN
		`SELECT device_id FROM USER
			WHERE user_id=${user_id};`
	);

	var query_num = (SAN
		`SELECT num_machines FROM QUEUE
			WHERE (QUEUE.category, QUEUE.venue_id) IN
				(SELECT category, venue_id FROM MACHINE
					WHERE machine_id=${machine_id});`
	);

	connection.query(query_game, (err_game, result_game) => {
		
		if (err_game) {
			next(err_game);
		} else {
			
			connection.query(query_machine, (err_machine, result_machine) => {
				
				if (err_machine) {
					next(err_machine);
				} else {
					
					connection.query(query_user, (err_user, result_user) => {
						
						if (err_user) {
							next(err_user);
						} else {

							connection.query(query_num, (err_num, result_num) => {
								
								if (err_num) {
									next(err_num);
								} else {

									var device_id = result_user[0].device_id

									var ready_message = {
                								to: device_id,
                        							data: {
                                							title: 'Cue.',
                                							body: 'Your game is ready!',
                                							type: 'ready',
											machines: result_num[0].num_machines
                								}
        								};

									fcm.send(ready_message, function(err, response){
               									if (err) {
                        								console.log("Something has gone wrong!");
                								} else {
                								        console.log("Successfully sent with response: ", response);
           								     }
        								});

									callback(null);
								}
							})
						}

					})
				}
			})
		}	
	})	
}


function isMachineAcceptable(machine_id, queue_id, next, callback) {
	
	var query = (SAN
		`SELECT machine_id 
			FROM QUEUE Q RIGHT JOIN MACHINE M
				ON Q.category=M.category AND Q.venue_id=M.venue_id
			WHERE queue_id=${queue_id};`
	);

	connection.query(query, (err, result) => {
	
		if (err) {
			next(err);
		} else {
			for (var i =0; i < result.length; i++) {
				if (result[i].machine_id==machine_id) {
					callback(null, {"Accepted":"Yes"});
				}
			}
			callback(null, {"Accepted":"No"});
		}

	})
}


function authenticateGameStart(user_id, machine_id, next, callback) {
	
	var query = (SAN
		`SELECT G.game_id, G.wait_id, M.machine_id, M.available 
			FROM GAME G INNER JOIN MACHINE M 
				ON G.machine_id=M.machine_id 
			WHERE user_id=${user_id}
			AND state=2;`
	);
	
	connection.query(query, (err, result) => {
		
		if (err) {
			next(err);
		} else {
			if (result.length==0) {
				callback(null, {"Authentication":"error", "Message":"not user's turn"});
			} else if (result[0].machine_id == machine_id) {
				var game_id = result[0].game_id;
				callback(null, {"Authentication":"ok", "game_id":game_id});
			} else if (result[0].available == 0) {
				callback(null, {"Authentication":"error", "Message":"wrong machine"});
			} else {
				// If the user has tapped the wrong machine, but it's a free machine in the right category, it can still be used.
				isMachineAcceptable(machine_id, result[0].wait_id, next, (err_acc, result_acc) => {
					if (err_acc) {
						next(err_acc);
					} else {
						if (result_acc.Accepted==="Yes") {
							var game_id = result[0].game_id;

							var query_update = (SAN
								`UPDATE GAME
									SET machine_id=${machine_id}
									WHERE game_id=${game_id};`
							);

							connection.query(query_update, (err, result_update) => {
								callback(null, {"Authentication":"ok", "game_id":game_id});
							})
						} else {
							callback(null, {"Authentication":"error", "Message":"wrong machine"});
						}
					}
				})
			}
		}
	})
}

// Start a game.
function startGame(game_id, machine_id, next, callback) {
	
	var query_mach = (SAN
		`UPDATE MACHINE
			SET available=0
			WHERE machine_id=${machine_id};`
	);

	var time = new Date();

	var query_game = (SAN
		`UPDATE GAME
			SET state=3, time_start=${time}
			WHERE game_id=${game_id};`
	);

	connection.query(query_mach, (err, result) => {
	
		if (err) {
			next(err);
		} else {
			
			connection.query(query_game, (err_game, result_game) => {
				callback(null);
			})
		}
	})
}


app.get('/TEST', (request, response, next) => {
		
	getQueueStatus(36, next, (err, result) => {
		
		if (err) {
			next(err);
		} else {
		
			console.log("TESTING getQueuePosition");
			response.send(result);
		}
	})
 
})


///////////////////////////////////////////////// GET REQUESTS

app.use(express.static(__dirname + '/public'));
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

app.get('/venues/nearby', (request, response, next) => {

	var cur_lat = parseFloat(request.query.latitude);
	var cur_long = parseFloat(request.query.longitude);
	
	console.log(cur_lat);
	console.log(cur_long);

	var nearby_query = (SAN
		
		`SELECT *, (3959 * acos(cos(radians(${cur_lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${cur_long})) + sin(radians(${cur_lat})) * sin(radians(latitude)))) AS distance_miles
		FROM VENUE 
		ORDER BY distance_miles
		LIMIT 0,5;`

	);

	//SELECT venue_name, latitude, longitude,  (3959 * acos(cos(radians(-1.928342) ) * cos(radians(latitude) ) * cos(radians(longitude) - radians(52.446729) ) + sin(radians(-1.928342)) * sin(radians(latitude)))) AS distance FROM VENUE ORDER BY distance;

	connection.query(nearby_query, (err,result,fields) => {
		if(err) {
			next(err);
		}
		else {
			//console.log(result);
			response.json({"Nearby": result})
		}
	})

})

// Get details of a particular machine.
app.get('/machine/details', (request, response, next) => {
	
	var machine_id = parseInt(request.query.machine_id);
	
	//var query = 	

})


// Get details of a particular venue, including available game queues and expected waiting times.
app.get('/venue/queue', (request, response, next) => {
	
	var venue_id = parseInt(request.query.machine_id);

	//var query = 
})


/*
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
*/


// Get the list of machines in a specific venue.
app.get('/venue/machines', (request, response, next) => {

	var venue_id = parseInt(request.query.venue_id);

	var sql = "SELECT * FROM MACHINE WHERE venue_id = ?"
	sql = SQL.format(sql, venue_id);

	connection.query(sql, (err, result, fields) => {
		if(err) {
			next(err);
		}
		else {
			//response.send(result);
			response.json({"Machines": result})
			console.log("GET /venue/machines: returned all the machines in venue: " + venue_id);
		}
	})
})

// Returns the current average wait time for a specfic type of machine in a specific venue.
app.get('/venue/wait', (request, response, next) => {

	var venue_id = parseInt(request.query.venue_id);
	var category = request.query.category;

	/*
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
	*/

})

// See if a user is responsible for a venue
app.get('/user/admin', (request, response, next) => {

	var user_id = parseInt(request.query.user_id);

	var sql = "SELECT venue_id FROM ADMIN WHERE user_id = ?"
	var inserts = [user_id];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result, fields) => {

		if(err) {
			next(err);
			console.log(err);
		}
		else {
			//response.send(result);

			response.json({"Venues": result})
			console.log("GET /user/admin: Sent admin status for user_id: " + user_id);

			//response.json([{"user_id": result[1][0].user_id}]);

		}
	})
})

// Get details for a specific venue
app.get('/venue', (request, response, next) => {

	var venue_id = parseInt(request.query.venue_id);

	var sql = "SELECT * FROM VENUE WHERE venue_id = ?"
	var inserts = [venue_id];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result, fields) => {

		if(err) {
			next(err);
		}
		else {
			response.json({"venue": result});
		}
	})

})


// Find out which queue (if any) a particular user is in.
app.get("/user/queue", (request, response, next) => {

	var user_id = parseInt(request.query.user_id);

	getUserQueue(user_id, next, (err_queue, result_queue) => {

                if (err_queue) {
			next(err_queue);
		}
		else {
	                if (result_queue.Queue==="None") {

				response.json({"Queue":"None"});
			} else {
	
				var queue_id = result_queue.Queue.queue_id;

				getUserQueueStatus(user_id, queue_id, next, (err, result_details) => {

					response.json({"Queue":result_queue.Queue, "Stats":result_details});
					console.log("GET /user/queue: Sent queue data for user " + user_id);
					
				})
			}
		}
	})
})


app.get("/venue/queues", (request, response, next) => {
	
	var venue_id = parseInt(request.query.venue_id);

	var query_num = (SAN `SELECT queue_id FROM QUEUE WHERE venue_id=${venue_id};`);
				
	connection.query(query_num, (err_num, result_num) => {

		if (err_num) {
			next(err_num);
		} else {
			var queues = [];
				async.forEachOf(result_num, function (dataElement, i, inner_callback) {
					
				getQueueDetails(dataElement['queue_id'], next, (err, result_det) => {
					queues[i] = result_det;
					inner_callback();
				});
			}, function(err_loop) {

				if(err_loop) {
					next(err_loop);
				} else {
					response.json({"Queues":queues});
					console.log("GET /venue/queues: Sent queue data for venue " + venue_id);
				}
			});
		}
	})
})


///////////////////////////////////////////////// POST REQUESTS

// Allow a user to login/be authenticated.
app.post("/user/login", (request, response, next) => {

	var username = request.body.username;
	var password = request.body.password;
	var device_id = request.body.device_id;

	var login_query = (SAN
		`SELECT user_id, password_hash FROM USER WHERE username = ${username};`
	);

	connection.query(login_query, (err, result, fields) => {

		if(err) {
			next(err);
		}
		else {

			if (result === undefined || result.length == 0) {
				// IF ARRAY = EMPTY, NO USER RETURNED = RETURN 401 STATUS
				response.sendStatus(401);
				return;
			}

			var logged_in_user = parseInt(result[0].user_id);

			bcrypt.compare(password, result[0].password_hash, (err, res) => {

				// If user details correct
				if(res) {
					// response.sendStatus(200);

					var session_cookie = uuidv1();

					var sql = "UPDATE USER SET device_id = ?, session_cookie = ? WHERE user_id = ?; SELECT V.venue_id, venue_name, google_token, latitude, longitude FROM VENUE V INNER JOIN ADMIN A ON V.venue_id=A.venue_id WHERE user_id = ?;"
					var inserts = [device_id, session_cookie, logged_in_user, logged_in_user, logged_in_user];
					sql = SQL.format(sql, inserts); 
				
					connection.query(sql, (err, result) => {
				
						if(err) {
							next(err);
						}
						else {
							response.json({User:[{"user_id": logged_in_user,"session_cookie": session_cookie}], Admin:result[1]});
							console.log("POST /user/login: Logged in + Updated device ID for user " + logged_in_user)
						}
			
					})

				}
				// If user details incorrect
				else {
					response.sendStatus(401);
				}
			})
		}

	})
})



app.post('/user/logout', (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	var session_cookie = request.body.session_cookie;
	
	var logout_query = (SAN
		`UPDATE USER SET session_cookie = '' WHERE user_id = ${user_id};`
	);

	authentication(user_id, session_cookie, next, (err, auth_result) => {

		if(auth_result.auth == 1) {
			
			connection.query(logout_query, (err, result, fields) => {

				if(err) {
					next(err);
					console.log(err);
				}
				else {
					//response.send(result);
					//response.sendStatus(200);
					console.log("POST /user/logout: User: " + user_id + " logged out!")

					// Remove from queue
					var remove_query = (SAN
						`DELETE FROM GAME WHERE
							user_id=${user_id}
							AND state <2;`
					);
		
					connection.query(remove_query, (err, result) => {
						if (err) {
							next(err);
						}
						else {
							if (result.affectedRows >= 1) {
								console.log("POST /queue/leave: User: " + user_id + " left queue");
								response.status(204);
								response.json({"User":[{logged_out:1}]});
								//response.json({"Success": "User left queue."});
							}
							else {
								console.log("POST /queue/leave: No queues left");
								response.status(204);
								response.json({"User":[{logged_out:1}]});
								//response.json({"Error": "User: " + user_id + " was not in queue."});
							}	
						}
		
					})
				}
			})
		}
		else {
			response.status(401);
			response.json({"Authentication":[{auth:0}]});
		}
	});
})

// Add a new user to the service.
app.post('/user/add', (request, response, next) => {

	var username = request.body.username;
	var password = request.body.password;
	var name = request.body.name;
	var device_id = request.body.device_id;
	var session_cookie = uuidv1();
	
	// HASH PASSWORD
	bcrypt.hash(password, saltRounds, function(err, hash) {
		
		var add_user_query = "INSERT INTO `USER` (username, password_hash, name, device_id, session_cookie) VALUES (?,?,?,?, ?); SELECT last_insert_id() AS user_id;";
		var inserts = [username, hash, name, device_id, session_cookie];
		add_user_query = SQL.format(add_user_query, inserts);

		connection.query(add_user_query, (err, result) => {
	
			if(err) {
				next(err);
			}
			else {

				response.json({User:[{"user_id": result[1][0].user_id, "session_cookie": session_cookie}]});
				console.log("POST /user/add: Added new user - " + username);
			}

		});
	})
})


app.post('/venue/history', (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	var session_cookie = request.body.session_cookie;
	var venue_id = parseInt(request.body.venue_id);

	authentication_admin(user_id, session_cookie, venue_id, next, (err, auth_result) => {
		
		if (auth_result.auth == 1) {

			var query = (SAN
				`SELECT G.user_id, U.name, U.username, G.machine_id, M.category, G.price, G.game_id, G.time_add, G.time_start, G.time_end
					FROM GAME G INNER JOIN MACHINE M 
						ON G.machine_id=M.machine_id INNER JOIN USER U 
							ON G.user_id=U.user_id 
						WHERE M.venue_id=${venue_id}
						AND G.state=5;`
			);

			connection.query(query, (err, result) => {

				if (err) {
					next(err);
				} else {
					response.json({"History":result});
					console.log("POST /venue/history: Sent history for venue #"+ venue_id + ".");
				}
			})

		} else {
			response.status(401);
			response.json({"Authentication":[{auth:0}]});
		}
	})
})


app.post('/user/history', (request, response, next) => { 

	var user_id = parseInt(request.body.user_id);
	var session_cookie = request.body.session_cookie;

	//var hist_query = SAN(`SELECT G.time_start, M.category, M.base_price, V.venue_name, V.google_token, V.latitude, V.longitude FROM ((GAME G INNER JOIN MACHINE M ON G.machine_id = M.machine_id) INNER JOIN VENUE V ON V.venue_id = M.venue_id) WHERE user_id = ${user_id} AND state = 5;`);
	var hist_query_2 = (SAN 
		`SELECT G.time_start, M.category, M.base_price, V.venue_id, V.venue_name, V.google_token, V.latitude, V.longitude 
			FROM 
				(GAME G INNER JOIN MACHINE M ON G.machine_id = M.machine_id) 
				INNER JOIN 
				VENUE V ON V.venue_id = M.venue_id 
					WHERE user_id=${user_id} AND state = 5 ORDER BY G.time_start ASC;`
	);

	authentication(user_id, session_cookie, next, (err, auth_result) => {

		if(auth_result.auth == 1) {

			
			connection.query(hist_query_2, (err, result) => {

				if(err) {
					next(err);
				}
				else {
					response.json({"History": result});
					console.log(result);
					//console.log("POST /user/history: Returned user history for user: " + parseInt(user_id));
				}
		
			})
		}
		else {
			response.status(401);
			response.json({"Authentication":[{auth:0}]});
		}

	})			

})


/*
app.post('/venues/admin', (request, response, next) => {
	
	var user_id = request.body.user_id;
	var session_cookie = request.body.session_cookie;

	var admin_query = (SAN
		
		`SELECT V.venue_id, venue_name, google_token, latitude, longitude FROM VENUE V INNER JOIN ADMIN A ON V.venue_id=A.venue_id WHERE user_id = ${user_id};`
	);

	authentication(user_id, session_cookie, next, (err, auth_result) => {

		if(auth_result.auth == 1) {
			
			connection.query(admin_query, (err,result,fields) => {
				if(err) {
					next(err);
				}
				else {
					response.json({"Venues": result})
					console.log("POST /venues/admin: Listed all venues that user_id:" + user_id + " is admin for.");

					v




				}
			})
		}
		else {
			response.status(401);
			response.json({"Authentication":[{auth:0}]});
		}
	});

})
*/

app.post('/game/start', (request, response, next) => {
	var user_id = parseInt(request.body.user_id);
        var machine_id = parseInt(request.body.machine_id);
        var session_cookie = request.body.session_cookie;

	// Authenticate
	authentication(user_id, session_cookie, next, (auth_err, auth_result) => {
		
		if (auth_result.auth == 1) {
			
			// Check if the endpoint access is legitimate.
			authenticateGameStart(user_id, machine_id, next, (legit_err, legit_result) => {
				if (legit_err) {
					next(legit_err);
				} else {
					if (legit_result.Authentication==="ok") {
						var game_id = legit_result.game_id;
						
						// Start the game.
						startGame(game_id, machine_id, next, (start_err, start_result) => {
							if (start_err) {
								next(start_err);
							} else {
								response.sendStatus(200);
								response.json({"Start":"ok"});
								console.log("POST /game/start: User " + user_id + " started game " + game_id);
							}
						})
					} else if (legit_result.Message==="wrong machine") {
						//response.sendStatus(400);
						response.json({"Start":"error, wrong machine"});
						console.log("POST /game/start: User " + user_id + " failed to start game.");
					} else {
						//response.sendStatus(400);
						response.json({"Start":"error, no game to start"});
						console.log("POST /game/start: User " + user_id + " failed to start game.");
					}
				}
			})
		} else {
			console.log("POST /queue/join: Authentication Failed");
                        response.status(401);
                        response.json({"Authentication":[{auth:0}]});
		}
	})
})


// End a game.
app.post('/game/end', (request, response, next) => {

})

/* JOIN QUEUE STUFF --------------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------------------------------------------------*/

function authenticateQueueJoin(user_id, session_cookie, next, callback) {

	authentication(user_id, session_cookie, next, (err_auth, result_auth) => {

		if(result_auth.auth == 1) {

			getUserQueue(user_id, next, (err_queue, result_queue) => {
				if (err_queue) {
        	    	next(err_queue);
               	}
				else if (result_queue.Queue==="None") {
					callback(null, result_auth);
				} else {
					callback(null, {"auth":0});
                       console.log("User " + user_id + " failed to join queue.");
				}
			})
		} else {
			callback(null, result_auth);
		}
	})
} 

function recceQueueJoin(machine_id, next, callback) {

	var query1 = (SAN
		`SELECT queue_id, Q.category, Q.venue_id, current_price, hub_addr FROM 
			MACHINE M LEFT JOIN QUEUE Q
				ON M.venue_id=Q.venue_id AND M.category=Q.category
			WHERE machine_id=${machine_id};`
	);

	connection.query(query1, (err1, result1) => {
		
		if (err1) {	
			next(err1);
		} else {

			var venue_id=result1[0].venue_id;
		
			var query2 = (SAN
                		`SELECT venue_name FROM VENUE
                        	WHERE venue_id=${venue_id}`
        		);

			connection.query(query2, (err2, result2) => {
				if(err2) {
					next(err2);
				} else {
					callback(null, {"queue_id":result1[0].queue_id,
									"category":result1[0].category,
									"venue_id":result1[0].venue_id,
									"current_price":result1[0].current_price,
									"hub_addr":result1[0].hub_addr,
									"venue_name":result2[0].venue_name
									}
					);
				}
			})
		}
	})

}

function addToQueue(queue_id, current_price, user_id, num_players, match_req, next, callback) {

	var time_add = new Date();

	var query = (SAN
		`INSERT INTO
        	GAME(user_id, state, time_add, wait_id, num_players, match_req, price)
            VALUES(${user_id}, 1, ${time_add}, ${queue_id}, ${num_players}, ${match_req}, ${current_price});`
	);

	var query_id = (SAN
		`SELECT game_id FROM GAME
			WHERE user_id=${user_id}
			AND state=1;`
	);

	// Insert new record.
	connection.query(query, (err, result) => {
		if (err){
			next(err);
		} else {

			// Find ID of new record.
			connection.query(query_id, (err_id, result_id) => {
				if (err_id) {
					next(err_id);
				} else {
					callback(null, {"game_id":result_id[0].game_id});
				}
			})
		}
	})
}


app.post('/queue/join', (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	var machine_id = parseInt(request.body.machine_id);
	var session_cookie = request.body.session_cookie;

	var match_req = 0;		// For later use.
	var num_players = 2;		// For later use.

	// Authenticate and check if user is already in queue.
	authenticateQueueJoin(user_id, session_cookie, next, (err_auth, result_auth) => {

		if (result_auth.auth == 1) {

			// Find which queue user should join, as well as other essential details.
			recceQueueJoin(machine_id, next, (err_recce, result_recce) => {

				var current_price = result_recce.current_price;
				var queue_id = result_recce.queue_id;

				// Create new game record.
				addToQueue(queue_id, current_price, user_id, num_players, match_req, next, (err_add, result_add) => {

					// Feedback to pi.
					var request=require('request');
					var addr = result_recce.hub_addr;
    
        			   	request(addr, function(err_fb, res_fb, body) {
                    				if(err_fb) {
                       					next(err_fb);
                    				} else {
							console.log("BEEP DA BOOP");
						}

						// Check if new game is ready immediately.
						getUserQueueStatus(user_id, queue_id, next, (err_status, result_status) => {
                    	    
                    	    				// If the game is ready immediately, set it up!
							if (result_status.position==0) {

								var machine_id = result_status.machine_id;
								var game_id = result_add.game_id;
								
								prepareGame(game_id, machine_id, user_id, next, (err_prep, result_prep) => {
									response.json({
										"Queue":{
                            								"queue_id":result_recce.queue_id,
                            								"category":result_recce.category,
                            								"venue_id":result_recce.venue_id,
                            								"venue_name":result_recce.venue_name,
                           								"queue_pos":0,
                            								"wait_time":0
                            							}
                            						});

   	                            					console.log("POST /queue/join: User " + user_id + " joined empty queue " + queue_id + ".");
								})
							} else {
								response.json({
									"Queue":{
                            							"queue_id":result_recce.queue_id,
                            							"category":result_recce.category,
                            							"venue_id":result_recce.venue_id,
                            							"venue_name":result_recce.venue_name,
                           							"queue_pos":result_status.position,
                            							"wait_time":result_status.wait
                            						}
                           					});

                            					console.log("POST /queue/join: User " + user_id + " joined queue " + queue_id + ".");
							}
                    				})
                    			})
				})
			})
		} else {
			console.log("POST /queue/join: Authentication Failed");
            		response.status(401);
            		response.json({"Authentication":[{auth:0}]});
		}
	})
})


// Allow a user to leave whichever queue they're in.
app.post("/queue/leave", (request, response, next) => {

        // Parse request parameters.
        var user_id = parseInt(request.body.user_id);
        var session_cookie = request.body.session_cookie;

        // Authenticate.
        authentication(user_id, session_cookie, next, (auth_err, auth_result) => {

                if(auth_result.auth == 1) {
			var query = (SAN
				`DELETE FROM GAME WHERE
					user_id=${user_id}
					AND state <2;`
			);

			connection.query(query, (err, result) => {
				if (err) {
					next(err);
				}
				else {
					if (result.affectedRows >= 1) {
						console.log("POST /queue/leave: User: " + user_id + " left queue");
						response.status(204);
						//response.json({"Success": "User left queue."});
					}
					else {
						console.log("POST /queue/leave: User: " + user_id + " attempted to leave queue they were not in.");
                                                response.status(400);
                                                response.json({"Error": "User was not in queue."});
					}	
				}

			})
		}
		else {
			console.log("POST /queue/leave: Authentication Failed");
			response.status(401);
			response.json({"Authentication":[{auth:0}]});
		}
	});
})


// Add a new machine to a specific venue.
app.post('/machine/add', (request, response, next) => {

	var venue_id = parseInt(request.body.venue_id);
	var category = request.body.category;
	var base_price = parseFloat(request.body.base_price).toFixed(2);

	var user_id = parseInt(request.body.user_id);
	var session_cookie = request.body.session_cookie;

	// Check whether queue exists yet for that category at that venue.
	var query = (SAN
			`SELECT queue_id, num_machines FROM QUEUE
				WHERE venue_id=${venue_id}
				AND category=${category};`
	);

	authentication_admin(user_id, session_cookie, venue_id, next, (err, auth_result) => {

		if(auth_result.auth == 1) {

			connection.query(query, (err, result) => {
				if (err) {
					next(err);
				}
				else {

					// If category doesn't exist yet, make a queue for it.
					if (result.length == 0) {
						var query2 = (SAN
							`INSERT INTO QUEUE(venue_id, category, num_machines)
								VALUES(${venue_id}, ${category}, 1);`
						);

						connection.query(query2, (err2, result2) => {
							if (err2) {
								next(err2);
							}
							else {
								console.log("POST /machine/add: Added new queue.");
							}
						})
					// If it does, update the number of machines it has.
					} else {
						
						var queue_id = result[0].queue_id;
						var num_machines = (result[0].num_machines + 1);
                                                console.log("TEST: " + result[0].num_machines + " before, now " + num_machines + ".");

						var query_update = (SAN
								`UPDATE QUEUE
									SET num_machines=${num_machines}
									WHERE queue_id=${queue_id};`
						);

						connection.query(query_update, (err_update, result_update) => {
							if (err_update) {
								next(err_update);
							}
							else {
								console.log("POST /machine/add: Number of machines in queue updated.");
							}
						})	
					}

					// Make new machine record.
					var query2 = (SAN
						`INSERT INTO
							MACHINE(venue_id, category, base_price, current_price, available)
							VALUES(${venue_id}, ${category}, ${base_price}, ${base_price}, 1);`
					);

					connection.query(query2, (err2, result2) => {
						if (err2) {
							next(err2);
						}
						else {
							query3 = (SAN
										`SELECT machine_id FROM MACHINE
															WHERE machine_id=last_insert_id();`
							);

							connection.query(query3, (err3, result3) => {
								if (err3) {
									next(err3);
								}
								else {
									response.json({Machine:result3});
									console.log("POST /machine/add: Added new machine");
								}
							})
						}
					})
				}
			})
		}
		else {
			console.log("POST /queue/add: Authentication Failed");
			response.status(401);
			response.json({"Authentication":[{auth:0}]});
		}
	});
})


///////////////////////////////////////////////// MISC REQUESTS

// Remove a machine
app.post('/machine/delete', (request, response, next) => {

	var machine_id = parseInt(request.body.machine_id);
	var venue_id = parseInt(request.body.venue_id);

	var user_id = parseInt(request.body.user_id);
	var session_cookie = request.body.session_cookie;
	var category;

	console.log("test");

	authentication_admin(user_id, session_cookie, venue_id, next, (err, auth_result) => {

		if(auth_result.auth == 1) {

			var delete_query = (SAN
				`SELECT category FROM MACHINE where machine_id=${machine_id}; DELETE FROM MACHINE where machine_id=${machine_id};`);

			connection.query(delete_query, (err, delete_result) => {
				
				if(delete_result.affectedRows == 0) {
					var error = new Error('Machine does not exist!');
					  error.name = 'NoneExistantMachine';
					next(error);
				}
				else if(err) {
					next(err);
				}
				else {
					category = delete_result[0][0].category;

								// Check whether queue exists yet for that category at that venue.
					var queue_query = (SAN
						`SELECT queue_id, num_machines FROM QUEUE
						WHERE venue_id=${venue_id}
						AND category=${category};`
					);

					// Run queue query
					connection.query(queue_query, (err, queue_result) => {


						if(err) {
							next(err)
						}
						else {

							var update_query;
							var queue_id = queue_result[0].queue_id;
							if((queue_result[0].num_machines) <= 1) {
								// DELETE
								update_query = (SAN `DELETE FROM QUEUE where queue_id = ${queue_id};`);
								console.log("DELETED QUEUE");

							}
							else {
								// UPDATE
								var new_value = (parseInt(queue_result[0].num_machines)) - 1;
								update_query = (SAN `UPDATE QUEUE set num_machines = ${new_value} WHERE queue_id=${queue_id};`);
								console.log(update_query);
								console.log("UPDATED QUEUE");
							}

							connection.query(update_query, (err, update_result) => {

								if(err) {
									next(err);
								}
								else {
									// Send 200 status back
									response.sendStatus(200);
									console.log("DELETE /machine/remove: Remove machine");
								}

							})

						
						}
 
					})
				



				}
			});




		}
		
		else {
			console.log("POST /queue/edit: Authentication Failed");
			response.status(401);
			response.json({"Authentication":[{auth:0}]});
		}


	})


})


// Update statistics of an existing machine
app.put('/machine/edit/price', (request, response, next) => {

	var venue_id = parseInt(request.body.venue_id);
	var category = request.body.category;
	var new_price = parseFloat(request.body.new_price);

	var user_id = parseInt(request.body.user_id);
	var session_cookie = request.body.session_cookie;

	authentication_admin(user_id, session_cookie, venue_id, next, (err, auth_result) => {

		if(auth_result.auth == 1) {

			var price_query = (SAN `UPDATE MACHINE SET base_price = ${new_price}, current_price = ${new_price} WHERE category = ${category} AND venue_id = ${venue_id};`);

			connection.query(price_query, (err, result) => {
				if(err) {
					next(err);
				}
				else {
					// Send 200 status back
					response.sendStatus(200);
					response.json({"OK":"Machine price updated"});
					console.log("PUT /machine/edit/price: Update prices of /" + category + "/ in venue: " + venue_id);
				}
			});

		}
		else {
			console.log("POST /queue/edit: Authentication Failed");
			response.status(401);
			response.json({"Authentication":[{auth:0}]});
		}
	})
})


// REMOVE THIS WHEN CODE MOVED ELSEWHERE
app.get('/notification/test', (request, response, next) => {

	var device_id = null;//// GET USERS DEVICE_ID FROM USER TABLE IN DATABASE
	var queue_position = 1; // GET FROM DATABASE

	// Use this one when telling the user their table is ready
	var ready_message = {
		to: device_id_test, // required fill with device token or topics
			data: {
				title: 'Cue.',
				body: 'Your table is ready!',
				type: 'ready'
		}
	};

	// Use this when updating a user of their position in the queue
	var update_message = {
		to: device_id_test, // required fill with device token or topics
			data: {
				title: 'Cue.',
				body: 'Your position has changed to: ' + queue_position.toString(),
				position: queue_position.toString(),
				type: 'update'
			}
	};

	// Use to send the message : swap ready_message for update_message if necessary
	fcm.send(ready_message, function(err, response){
		if (err) {
			console.log("Something has gone wrong!");
		} else {
			console.log("Successfully sent with response: ", response);
		}
	});

	response.send(200);

})


// Confirm game end.
app.put('/queue/gameEnd', (request, response, next) => {

	var machine_id = parseInt(request.body.machine_id);
	var game_id = parseInt(request.body.game_id);
	var user_id = parseInt(request.body.user_id);
	
	//var sql = "UPDATE GAME SET queue_pos = -1 WHERE game_id = ?;"
	var sql = "UPDATE `GAME` SET `queue_pos` = `queue_pos` -1 WHERE `queue_pos` != '-1' AND `machine_id` = ?; UPDATE `GAME` SET `time_end` = ? WHERE `game_id` = ?; SELECT device_id FROM `USER` WHERE user_id = (SELECT user_id FROM `GAME` AS bob WHERE queue_pos = 0 AND machine_id = ?);"
	var inserts = [machine_id, new Date(), game_id, machine_id];
	sql = SQL.format(sql, inserts);
	// WILL NEED TO INCREASE NUMBER AVAILABLE MACHINE
	//

	// SHUFFLE QUEUE UP
	var inserts = [game_id];
	sql = SQL.format(sql, inserts);

	connection.query(sql, (err, result) => {
		if(err) {
			next(err);
		}
		else {
			// Send 200 status back

			//console.log(result[2]);
			var resuu = result[2][0].device_id;
			var FCM = require('fcm-push');

			var serverKey = 'AAAA7qf1S-s:APA91bHj07GD0akUObgNBy8VnF2HGjrgZ5OJRtaBTmK3yTS_aYQV3vnlbE75laH3GOcg_FTwe2aYosIFC3mXDkFUxTO4N-yJe2Zda31uQUyxod73FGSPBFUIF_7uzDIQ34IiCi_kGewV';
			var fcm = new FCM(serverKey);

			var message = {
				to: result[2][0].device_id, // required fill with device token or topics
				notification: {
					title: 'Traintracks',
					body: 'This app sucks. Download the official TrainLine app.'
				}
			};

			//callback style
			fcm.send(message, function(err, response){
				if (err) {
					console.log("Something has gone wrong!");
				} else {
					console.log("Successfully sent with response: ", response);
				}
			});


			response.sendStatus(200);
			console.log("POST /queue/gameEND: Ended GAME");
		}
	});
})

// Update users device
app.put('/user/deviceid', (request, response, next) => {

	var user_id = parseInt(request.body.user_id);
	var device_id = request.body.device_id;

	var deviceid_query = (SAN
		`UPDATE USER SET device_id = ${device_id} WHERE user_id = ${user_id};`
	);

	authentication(user_id, session_cookie, next, (err, auth_result) => {

		if(auth_result.auth == 1) {
			
			connection.query(deviceid_query, (err, result) => {

				if(err) {
					next(err);
				}
				else {
					response.sendStatus(200);
					console.log("POST /user/deviceid: Updated device ID for user " + user_id)
				}
			})
		}
		else {
			response.status(401);
			response.json({"Authentication":[{auth:0}]});
		}
	});

})


///////////////////////////////////////////////// SERVER
// Start listening on HTTP PORT
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

// Listen on HTTPS port
https.createServer(options, app).listen(443);

