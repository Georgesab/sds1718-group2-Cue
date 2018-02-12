# IDK SDS - node.js Server + DB

------

Server that provides endpoints to modify a mySQL database on the hosting machine.

## HTTP Endpoints

Note: all body requests should use **x-www-form-urlencoded**

'*' = optional

### GET Requests

#### GET '/'

Returns index.html — eventually used for web UI

TODO: Add login to secure this page

#### GET '/config/*'

Returns a page under config (e.g. /config or /config/stats)

Each page in this section requires basic authentication, currently hardcoded.

**User**: idk, **Password**: blockchain

#### GET /queue
Returns the entire queue as a json object

If **num** not specified, returns all.

| Key  | Format | Explanation                                                  |
| ---- | ------ | ------------------------------------------------------------ |
| mode | Int    | **1**: all<br />**2**: only users who have played<br />**3**: only users who have not played |
| num* | Int    | Can specify number of records to return.                     |

#### GET /queue/user

Returns an individual user in json format

###### Params

| Key  | Format | Example Value |
| ---- | ------ | ------------- |
| uid  | Int    | 111           |

#### GET /queue/completedTimes

Returns a json object of **time_add_queue**, **time_game_start** and **time_game_end** for the last N (value specifed by num_records) players who have completed their game.

If **num_records** not specified, returns all.

###### Params

| Key          | Format | Example Value |
| ------------ | ------ | ------------- |
| num_records* | Int    | 111           |

#### GET /queue/wait

Returns the current average wait time.

### POST Requests

#### POST /queue/add

Add a user to the queue.

**queue_pos** will default to the next available.

**time_add_queue** set to time of insertion.

**time_game_start**, **time_game_end** are null

**in_queue** defaults to 1 (true)

**account_balance** defaults to 0.

**num_players** defaults to 2 if not specified.

######Body

| Key          | Format | Example Value |
| ------------ | ------ | ------------- |
| uid          | int    | 111           |
| num_players* | Int    | 2             |

### PUT Requests

#### PUT /users/status/[start | end]

Adds the current time to either **time_game_start** or **time_game_end**.

Use **start** to set the game start time.

Use **end** to set the game end time. This also sets **game_played** to 1.

###### Body

| Key  | Format | Example Value |
| ---- | ------ | ------------- |
| uid  | int    | 111           |

### DELETE Requests

#### DELETE /users/delete

Delete user from queue and move other users in the queue to fill gap.

###### Params

| Key  | Format | Example Value |
| ---- | ------ | ------------- |
| uid  | Int    | 111           |


## Notes
Requires a mySQL server to be running with details below.

## Setup
#### Server

`cd server`

`npm install`

This installs all required modules needed to run

#### Database

Install mySQL, set password for 'root' to 'rosecolouredboy' (dummy)

When in /server folder, run:

```BASH
sudo ./setupdb.sh cue
```

run:
```BASH
sudo ./insert-test.sh
```
To make two dummy users and add them to the USERS table.

## Running Server
`node index.js`

# Database Structure

## Database = 'cue' | Table = 'USERS'

| Column            | Data Type                         |
| ----------------- | --------------------------------- |
| user_id           | INT                               |
| queue_pos         | INT                               |
| time_add_queue    | DATETIME                          |
| time_game_start   | DATETIME                          |
| time_game_end     | DATETIME                          |
| in_queue          | TINYINT (0 for false, 1 for true) |
| number_of_players | INT                               |
| account_balance   | DECIMAL ???                       |
