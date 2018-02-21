# IDK SDS - node.js Server + mariaDB Database

# Server Details

### Server

`pm2 stop index` - Stop the background server

`pm2 start index` - Restart the background server.

`nodemon index.js` - Run from idk/server/ to run the server that restarts every time you save index.js. Use ctrl+c to quit.

### Database

**mysql**
​	<u>username</u>: blockchain
​	<u>password</u>: rosecolouredboy
​	<u>database</u>: SQL1

# HTTP Endpoints

Server that provides endpoints to modify a mariaDB database on the hosting machine.

All body requests should use **x-www-form-urlencoded**

All return values if not a default HTTP status code are in **json**.



## GET Requests

### GET '/'

Returns index.html — eventually used for web UI

### ~~GET '/config/*'~~

~~Returns a page under config (e.g. /config or /config/stats)~~

~~Each page in this section requires basic authentication, currently hardcoded.~~

~~**User**: idk, **Password**: blockchain~~

### GET /queue

Get all games or a specific game currently in the queue.

##### Query Parameters

| Key        | Format | Description                                                  |
| ---------- | ------ | ------------------------------------------------------------ |
| venue_id   | int    | ID of specific venue                                         |
| machine_id | int    | Type of machine to look for.<br />[IF 0, SHOW ALL]           |
| user_id    | int    | User ID to request queue for<br />[IF 0, SHOW ALL FOR VENUE] |

##### Return Value(s)

JSON object(s) of GAME row(s).

### GET /machine/price

Get current price of a certain machine in a specific venue to show the user.

##### Query Parameters

| Key          | Format | Description          |
| ------------ | ------ | -------------------- |
| venue_id     | int    | ID of specific venue |
| machine_type | int    | Type of machine      |

##### Return Value(s)

| Key           | Format | Description                  |
| ------------- | ------ | ---------------------------- |
| base_price    | int    | Default price of the machine |
| current_price | int    | Current price of the machine |

### GET /machine/all

Get the list of machines in a specific venue.

##### Query Parameters

| Key      | Format | Description          |
| -------- | ------ | -------------------- |
| venue_id | int    | ID of specific venue |

##### Return Value(s)

JSON object(s) of GAME row(s).

### ~~GET /game/waitTime — NOT FUNCTIONAL YET~~

~~Returns the current average wait time for a specfic type of machine in a specific venue.~~

~~QUESTION - HOW IS THIS CALC???~~

##### Query Parameters

| Key        | Format | Description          |
| ---------- | ------ | -------------------- |
| machine_id | int    | ID of specific venue |

##### Return Value

MACHINE objects.

**NOT IMPLEMENTED YET**

## POST Requests

### POST /user/login

Allow a user to login/be authenticated.

##### Request Body

| Key       | Format     | Description                |
| --------- | ---------- | -------------------------- |
| username  | String(16) | Chosen username            |
| password  | String(24) | Password                   |
| device_id | String     | ID of device from Firebase |

##### Return Value(s)

**<u>200 OK</u>** username/password correct

**<u>401</u>** incorrect username/password

### POST /user/add

Add a new user to the service.

##### Request Body

| Key       | Format     | Description                     |
| --------- | ---------- | ------------------------------- |
| username  | String(16) | Chosen username                 |
| password  | String(24) | Password (stored as hash in DB) |
| name      |            | First name of user              |
| device_id | String     |                                 |

##### Return Value(s)

***<u>200 OK</u>*** User successfully added

**<u>500 Internal Server Error</u>** Username already exists

### POST /queue/add

Add a user to the queue — i.e. a user wants to play a game.

##### Request Body

| Key            | Format   | Description                                                	   |
| -------------- | -------- | -------------------------------------------------------------------- |
| user_id        | int      | ID of user                                                	   |
| machine_id   	 | int      | Type of machine the user wants to play on         	           |
| time_requested | UNIXTIME | Time user wants to play. <br /> 0 = ASAP		                   |
| matchmaking    | int      | If the user wants to be matched.<br />**0** for no, **1** for yes.   |
| num_players    | int      | Number of players that are requesting to play.              	   |

##### Return Value(s)

**<u>200 OK</u>** User successfully added to queue

### POST /machine/add

Add a completely new type of machine to a specific venue

##### Request Body

| Key        | Format  | Description                      |
| ---------- | ------- | -------------------------------- |
| venue_id   | int     | ID of venue                      |
| category   | string  | Type of machine (e.g. pool)      |
| total      | int     | Number of this machine available |
| base_price | decimal | Start price                      |

##### Return Value(s)

JSON object of MACHINE row for newly created machine (use to get machine_id)

## PUT Requests

### PUT /machine/edit

Edit a machine - e.g. change the default price or the number in the venue.

##### Request Body

| Key        | Format  | Description                                                  |
| ---------- | ------- | ------------------------------------------------------------ |
| machine_id | int     | ID of machine to edit                                        |
| venue_id   | Int     | ID of venue where the machine is                             |
| total      | int     | New number of machines.<br />Set to 0 to keep current value.. |
| base_price | decimal | New default price.<br />Set to 0 to keep current value.      |

##### Return Value(s)

**<u>200 OK</u>** Successfully updated

### PUT /queue/gameStart

Confirm the presence of a user/start the game.

##### Request Body

| Key     | Format | Description |
| ------- | ------ | ----------- |
| user_id | int    | ID of user  |
| game_id | int    | ID of game  |

##### Return Value(s)

### PUT /queue/gameEnd

Confirm game end.

##### Request Body

| Key     | Format | Description |
| ------- | ------ | ----------- |
| user_id | int    | ID of user  |
| game_id | int    | ID of game  |

##### Return Value(s)

**<u>200 OK</u>** Successfully updated

### PUT /user/deviceid

Set new device ID

**Request Body**

**<u>200 OK</u>** Successfully updated

| Key       | Format | Description                   |
| --------- | ------ | ----------------------------- |
| user_id   | int    | ID of user                    |
| device_id | int    | New device ID to set for user |

**Return Value(s)**

****<u>200 OK</u>** Successfully updated**

# Database

## Database = 'SDS1' 

### USER

| Field         | Data Type        |
| ------------- | ---------------- |
| user_id       | INT (> 0)        |
| username      | VARCHAR(16)      |
| password_hash | VARCHAR(256)     |
| name          | VARCHAR(40)      |
| games_played  | SMALLINT (>= 0)  |
| games_missed  | SMALLINT (>=  0) |
| device_id     | VARCHAR(256)     |

### GAME

| Field          | Data Type   		    |
| -------------- | ------------------------ |
| game_id        | INT (> 0)   		    |
| user_id        | INT (> 0)    	    |
| queue_pos      | INT (>= -1)		    |
| time_add       | DATESTAMP (UNIX TIME)    |
| time_requested | DATESTAMP (UNIX TIME)    |
| time_start     | DATETIME (UNIX TIME)     |
| time_end       | DATETIME (UNIX TIME)     |
| num_players    | INT (> 0)  		    |
| machine_id 	 | INT			    |
| matchmaking	 | SMALLINT	            |

### MACHINE

| Field         | Data Type         |
| ------------- | ----------------- |
| machine_id    | INT (> 0)         |
| venue_id      | INT (> 0)         |
| category      | VARCHAR(16)       |
| total         | SMALLINT (> 0)    |
| available     | SMALLINT (>= 0)   |
| base_price    | DECIMAL (>= 0.00) |
| current_price | DECIMAL (>= 0.00) |

### VENUE

| Field      | Data Type   |
| ---------- | ----------- |
| venue_id   | INT (> 0)   |
| venue_name | VARCHAR(40) |
| username   | VARCHAR(16) |
| password   | VARCHAR(24) |

