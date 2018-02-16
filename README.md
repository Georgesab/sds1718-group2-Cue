# IDK SDS - node.js Server + mariaDB Database

# Endpoints

Server that provides endpoints to modify a mariaDB database on the hosting machine.

Note: all body requests should use **x-www-form-urlencoded**

'*' = optional

## GET Requests

### GET '/'

Returns index.html — eventually used for web UI

### GET '/config/*'

Returns a page under config (e.g. /config or /config/stats)

Each page in this section requires basic authentication, currently hardcoded.

**User**: idk, **Password**: blockchain

### GET /queue/pos

Returns the position in the queue of a specific user.

###### **Parameters**

| Key     | Format | Explanation                  |
| ------- | ------ | ---------------------------- |
| user_id | Int    | User ID of the specific user |

###### **Return value**

| Key       | Format | Explanation                                                  |
| --------- | ------ | ------------------------------------------------------------ |
| queue_pos | Int    | Position in the queue.<br />**-1** if not in queue.<br />**0** if currently playing a game. |

### GET /venue/machines

Returns all the machines that a particular venue has.

###### **Parameters**

| Key    | Format | Explanation                     |
| ------ | ------ | ------------------------------- |
| pub_id | Int    | ID for the specfic pub to query |

###### **Return**

| Key           | Format  | Explanation                                |
| ------------- | :------ | :----------------------------------------- |
| machine_id    | Int     | ID of the machine                          |
| venue_id      | Int     | ID of the venue                            |
| Category      | String  | Category of machine, e.g. "pool"           |
| total         | Int     | Number of machines the venue has in total. |
| available     | Int     | Number of machines available for use.      |
| base_price    | Decimal | Base price of the machine.                 |
| current_price | Decimal | Current price of the machine.              |

## GET /game/queue

**TODO** - Get the entire queue for a specific machine.

### GET /game/queue/wait

**TODO** - Returns the current average wait time for a specfic queue for a specifc machien.

## POST Requests

### POST /user/login

Verify a user's credentials against those stored in the server.

| Key		| Format	| Explanation	|
| -------------	| ------------- | ------------- |
| Username	| String (16)	|		|
| Password	| String (24)	|		|

### POST /user/add

Add a user to the service.

###### **Body**

| Key      | Format              | Explanation                                                 |
| -------- | ------------------- | ----------------------------------------------------------- |
| Username | String (1-16 chars) | Username for the user.                                      |
| password | String (1-24 chars) | Password for the user (will be hashed in a later iteration) |
| name     | String (1-40 chars) | First name of the user.                                     |

### POST /game/add

Add a new game into the queue.

###### **Body**

| Key            | Format | Explanation                                                  |
| -------------- | ------ | ------------------------------------------------------------ |
| user_id        | Int    | User ID of the specific user                                 |
| number_players | Int    | Number of players user is requesting for (used in extention) |
| machine_id     | Int    | ID of the machine the user wants to queue for.               |
| matchmaking    | Int    | **0** = user doesn't need matchmaking<br />**1** = user wants matchmaking |

### POST /machine/add

**TODO** - This will add a machine, e.g. if the pub gets a new category of machine.

## PUT Requests

### PUT /game/status/[start / end]

Use **start** to set the game start time of a player and set their current queue position to in a game.

Use **end** to set the game end time. This puts their queue position to -1 and sets the end time of the game.

###### **Body**

| Key     | Format | Explanation             |
| ------- | ------ | ----------------------- |
| user_id | Int    | User ID of the user.    |
| game_id | Int    | Game to set status for. |

### PUT /machine/

**TODO** - This will allow a pub to edit a machine (e.g. add or remove the number available, edit the price etc)

### PUT /user/

**TODO** - This will allow for updating a user e.g. increasing number of games played/missed.
**MAYBE** - Allow user to change their username/password.

### PUT /venue/

**MAYBE** - Allow pub to change their name/username/password.

# Setup

#### Server

`cd server`

`npm install`

This installs all required modules needed to run

#### Database

Install mariaDB, set password for 'root' to 'rosecolouredboy' (dummy)

When in /server folder, run:

```BASH
sudo ./setupdb.sh sds
```

You can then run the following to populate the database with dummy users:
```BASH
sudo ./insert-test.sh
```
## Running Server
`nodemon index.js` to auto-restart

# Database

## Database = 'cue' 

### USER

| Field        | Data Type        |
| ------------ | ---------------- |
| user_id      | INT (> 0)        |
| username     | VARCHAR(16)      |
| Password     | VARCHAR(256)     |
| name         | VARCHAR(40)      |
| games_played | SMALLINT (>= 0)  |
| games_missed | SMALLINT (>=  0) |

### GAME

| Field          | Data Type   |
| -------------- | ----------- |
| game_id        | INT (> 0)   |
| user_id        | INT (> 0)   |
| queue_pos      | INT (>= -1) |
| time_add       | DATETIME    |
| time_requested | DATETIME    |
| time_start     | DATETIME    |
| time_end       | DATETIME    |
| num_players    | INT (> 0)   |
| machine_id 	 | INT		|
| matchmaking	 | SMALLINT	|

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

| Field    | Data Type   |
| -------- | ----------- |
| venue_id | INT (> 0)   |
| username | VARCHAR(16) |
| password | VARCHAR(24) |

