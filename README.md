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
​	<u>database</u>: SDS1

# HTTP Endpoints

Server that provides endpoints to modify a mariaDB database on the hosting machine.

All body requests should use **x-www-form-urlencoded**

All return values if not a default HTTP status code are in **json**.


## GET Requests

### GET '/'

Returns index.html — eventually used for web UI

### GET /queue -- **subject to change**

Get all games or a specific game currently in the queue.

##### Query Parameters

| Key        | Format | Description                                                  |
| ---------- | ------ | ------------------------------------------------------------ |
| venue_id   | int    | ID of specific venue                                         |
| machine_id | int    | Type of machine to look for.<br />[IF 0, SHOW ALL]           |
| user_id    | int    | User ID to request queue for<br />[IF 0, SHOW ALL FOR VENUE] |

##### Return Value(s)

JSON object(s) of GAME row(s).

### GET /venues/nearby

Get the 5 closest venues to a user.

##### Query Parameters

| Key        | Format     | Description                                                  |
| ---------- | ---------- | ------------------------------------------------------------ |
| latitude   | decimal    | Current latitude of the user                                 |
| longitude  | decimal    | Current longitude of the user                                |

##### Return Value(s)

JSON object containing array **Nearby** with objects that have following fields:
- venue_id \ integer
- venue_name \ string
- google_token \ string
- latitude \ decimal
- longitude \ decimal
- distance_miles \ decimal

### GET /venue/machines

Get the list of machines in a specific venue.

##### Query Parameters

| Key      | Format | Description          |
| -------- | ------ | -------------------- |
| venue_id | int    | ID of specific venue |

##### Return Value(s)

JSON object containing array **Machines** with objects that have following fields:
- machine_id \ integer
- venue_id \ integer
- category \ string
- base_price \ decimal
- current_price \ decimal
- available \ boolean

### GET /user/queue

Return which queue, if any, the specified user is currently in.

##### Query Parameters

| Key     | Format | Description         |
| ------- | ------ | ------------------- |
| user_id | int    | ID of specific user |

##### Return Value(s)

JSON object containing an array of *Queue*s the user is in, for example:
```
{
    "Queue": {
        "queue_id": 30,
        "venue_name": "Cherry Red's (New Street)",
	"venue_id": 13,
        "category": "Skittles"
    },
    "Stats": {
        "wait": 29,
        "position": 2
    }
}
```
##### Notes
* Array will be empty if the specified user is not in a queue.
* `avg_game_duration` will be `NULL` if there is no previous game data from which to calculate an average. 

### Get /venue/queues

Return an array of queues available at a particular venue.

##### Query Parameters

| Key      | Format | Description         |
| -------- | ------ | ------------------- |
| venue_id | int    | ID of venue         |

##### Return Value

JSON object containing an array of *Queue*s the venue has. for example:
```
{
    "Queues": [
        {
            "queue_id": 30,
            "category": "Skittles",
            "num_machines": 1,
            "current_price": 0.6,
            "wait_time": 29,
            "queue_size": 2
        }
    ]
}
```

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

***<u>200 OK</u>*** If details correct -> User successfully logged in 
JSON object containing array **User** with objects that have following fields:
- user_id \ integer
- session_cookie \ string
Alongside array **Admin** with objects that have the following fields (if user is admin of any venues):
- venue_id \ integer

**<u>401</u>** Incorrect username/password

### POST /user/logout

Allow a user to log out.

##### Request Body

| Key             | Format     | Description                |
| --------------- | ---------- | -------------------------- |
| user_id         | int        | ID of user to logout       |
| session_cookie  | String(24) | Session cookie of user     |

##### Return Value(s)

**Successful logout -- Valid user_id and session_cookie**
JSON object containing array **User** with objects that has the following fields:
- logged_out \ integer (should == 1)

**Invalid user_id/session_cookie pair**
<u>401 Unauthorised</u> - 
{
    "Authentication": [
        {
            "auth": 0
        }
    ]
}

### POST /user/add (REGISTRATION)

Add a new user to the service.

##### Request Body

| Key       | Format     | Description                     |
| --------- | ---------- | ------------------------------- |
| username  | String(16) | Chosen username                 |
| password  | String(24) | Password (stored as hash in DB) |
| name      | String     | First name of user              |
| device_id | String     | Device ID from Firebase         |

##### Return Value(s)

***<u>200 OK</u>*** User successfully added
JSON object containing array **User** with objects that have following fields:
- user_id \ integer
- session_cookie \ string

**<u>500 Internal Server Error</u>** Username already exists [CATCH ONLY THIS]

### POST /venues/admin

Returns a list of venues that the user is admin for.

##### Request Body

| Key             | Format     | Description                     |
| --------------- | ---------- | ------------------------------- |
| user_id         | String(16) | Chosen username                 |
| session_Cookie  | String(24) | Session cookie for user         |

##### Return Value(s)

**Valid user_id and session_cookie**
JSON object containing array **Venues** with objects that have following fields:
- venue_id \ integer
- venue_name \ string
- google_token \ string
- latitude \ decimal
- longitude \ decimal

**Invalid user_id/session_cookie pair**
<u>401 Unauthorised</u> - 
{
    "Authentication": [
        {
            "auth": 0
        }
    ]
}

### ~~POST /queue/add~~

Add a user to the queue — i.e. a user wants to play a game.

##### Request Body

| Key            | Format   | Description                                                	         |
| -------------- | -------- | -------------------------------------------------------------------- |
| user_id        | int      | ID of user                                                	         |
| machine_id   	 | int      | Type of machine the user wants to play on         	                 |
| time_requested | UNIXTIME | Time user wants to play. <br /> 0 = ASAP		                         |
| matchmaking    | int      | If the user wants to be matched.<br />**0** for no, **1** for yes.   |
| num_players    | int      | Number of players that are requesting to play.              	       |
| session_cookie | string   | Session cookie of the user to add.                                   |

##### Return Value(s)

**Valid user_id and session_cookie**
<u>200 OK</u>
JSON object containing array **Game** with object that has following fields:
- game_id \ int
- user_id \ int
- time_add \ TIME
- time_start \ TIME
- time_end \ TIME
- num_players \ int
- machine_id \ int
- matchmaking \ int
- time_requested \ time

**Invalid user_id/session_cookie pair**
<u>401 Unauthorised</u> - 
{
    "Authentication": [
        {
            "auth": 0
        }
    ]
}


### POST /queue/join

Allow a user to join a queue with immediate effect. Venue and game category are determined by the **machine_id** given in the request.

##### Request Body

| Key            | Format | Description                     |
| -------------- | ------ | ------------------------------- |
| user_id        | int    | ID of user to be added to queue |
| machine_id     | int    | ID of machine tapped by app     |
| session_cookie | string | Session cookie of the user      |

##### Return Value(s)
**Valid user_id and session_cookie combination:**
JSON object containing array **Queue**, for example:
```
{
    "Queue": {
        "queue_id": 30,
        "category": "Skittles",
        "venue_id": 13,
        "venue_name": "Cherry Red's (New Street)",
        "queue_pos": 3,
        "wait_time": 44
    }
}
```

**User already in queue:**
JSON object containing error string.

**Invalid user_id/session_cookie pair**
<u>401 Unauthorised</u> -
```
{
    "Authentication": [
        {
            "auth": 0
        }
    ]
}
```

### POST /queue/leave

Allow a user to leave whatever queue they are currently in.

##### Request Body

| Key            | Format | Description                |
| -------------- | ------ | -------------------------- |
| user_id        | int    | ID of user to leave queue  |
| session_cookie | string | Session cookie of the user |


### POST /machine/add

Add a new machine to a specific venue.

##### Request Body

| Key               | Format  | Description                      |
| ----------------- | ------- | -------------------------------- |
| venue_id          | int     | ID of venue                      |
| category          | string  | Type of machine (e.g. pool)      |
| base_price        | decimal | Start price                      |
| user_id           | int     | ID of the admin user             |
| session_cookie    | string  | Session cookie of admin user     |

##### Return Value(s)

**Valid user_id and session_cookie -- USER IS ADMIN OF VENUE**
<u>200 OK</u>
JSON object containing array **Machine** with object that has following fields:
- machine_id \ int

**Invalid user_id/session_cookie pair -- OR USER NOT ADMIN OF VENUE**
<u>401 Unauthorised</u> - 
{
    "Authentication": [
        {
            "auth": 0
        }
    ]
}

### POST /user/history

View the games the user has previously played.

##### Request Body

| Key               | Format  | Description                      |
| ----------------- | ------- | -------------------------------- |
| user_id           | int     | ID of the user                   |
| session_cookie    | string  | Session cookie of user           |

#### Return Value(s)

**Valid user_id and session_cookie**
<u>200 OK</u>
JSON object containing array **History** with object that has following fields:
- time_start \ time
- category \ string
- base_price \ decimal
- venue_name \ string
- google_token \ string
- latitude \ decimal 
- longitude \ decimal

**Invalid user_id/session_cookie pair -- OR USER NOT ADMIN OF VENUE**
<u>401 Unauthorised</u> - 
{
    "Authentication": [
        {
            "auth": 0
        }
    ]
}

### POST /venue/history

View all games played at a specific venue.

##### Request Body

| Key               | Format  | Description                      |
| ----------------- | ------- | -------------------------------- |
| user_id           | int     | ID of the user                   |
| session_cookie    | string  | Session cookie of user           |
| venue_id	    | int     | ID of the venue                  |

#### Return Value
If the user is an admin of the venue, a JSON array will be returned, such as the following:
```
{
    "History": [
        {
            "user_id": 72,
            "name": "Test Player",
            "username": "Player2",
            "machine_id": 76,
            "category": "Skittles",
            "price": 0.6,
            "game_id": 124,
            "time_add": "2018-03-19T18:57:24.000Z",
            "time_start": "2018-03-19T18:57:24.000Z",
            "time_end": "2018-03-19T19:12:25.000Z"
        },
        {
            "user_id": 72,
            "name": "Test Player",
            "username": "Player2",
            "machine_id": 76,
            "category": "Skittles",
            "price": 0.7,
            "game_id": 125,
            "time_add": "2018-03-19T18:58:01.000Z",
            "time_start": "2018-03-19T19:14:01.000Z",
            "time_end": "2018-03-19T19:28:03.000Z"
        }
    ]
}
```

## PUT Requests

### PUT /machine/edit

Edit a machine - e.g. change the default price or the number in the venue.

##### Request Body

| Key               | Format  | Description                                                  |
| ----------------- | ------- | ------------------------------------------------------------ |
| machine_id        | int     | ID of machine to edit                                        |
| venue_id          | Int     | ID of venue where the machine is                             |
| to_delete         | int     | To delete machine. 0 if nnoot, 1 if yes                      |
| base_price        | decimal | New default price.<br />Set to 0 to keep current value.      |
| category          | string  | New category to set                                          | 
| user_id           | int     | ID of the admin user                                         |
| session_cookie    | strng   | Session cookie of admin user                                 |

##### Return Value(s)

**<u>200 OK</u>** Successfully updated

### PUT /queue/gameStart

Confirm the presence of a user/start the game.

##### Request Body

| Key               | Format | Description               |
| ----------------- | ------ | ------------------------- |
| user_id           | int    | ID of user                |
| session_cookie    | strng  | Session cookie of user    |
| game_id           | int    | ID of game                |

##### Return Value(s)
TBA

### PUT /queue/gameEnd

Confirm game end.

##### Request Body

| Key               | Format | Description               |
| ----------------- | ------ | ------------------------- |
| user_id           | int    | ID of user                |
| session_cookie    | strng  | Session cookie of user    |
| game_id           | int    | ID of game                |

##### Return Value(s)

TBA
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

**200 OK** - Successfully updated**

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
| state          | INT (0 >= state >= 5)    |
| time_add       | DATESTAMP (UNIX TIME)    |
| time_start     | DATETIME (UNIX TIME)     |
| time_end       | DATETIME (UNIX TIME)     |
| num_players    | INT (> 0)  		    |
| wait_id	 | INT (> 0)                |
| machine_id 	 | INT (> 0)		    |
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

### QUEUE

| Field     | Data Type   |
| --------- | ----------- |
| queue_id  | INT (>0)    |
| venue_id  | INT (>0)    |
| category  | VARCHAR(16) 
|
