# idk SDS - Prototype
Prototype server -- allows you to get and request.

## Functionality

#### GET '/'
Returns the demo index.html

#### GET /queue
Returns the entire queue incl parametres

#### POST /queue/add
body: (int) user_id, (int) number_players

#### DELETE /queue/delete
Delete user from queue and move other users in the queue to fill gap
body: (int) user_id


## Notes
Requires a mySQL server to be running, only currently running on George's laptop.

## Setup
`cd server`

`npm install`

This installs all required modules needed to run

## Running
`node index.js`
