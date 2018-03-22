#!/bin/bash

mysql -uroot -p <<MYSQL_SCRIPT
INSERT INTO cue.USERS(
  user_id, queue_pos, time_add_queue, time_game_start,
  time_game_end)
VALUES('1', '1', '2018-02-12 15:25:03', '2018-02-12 15:35:13', '2018-02-12 15:41:02');
INSERT INTO cue.USERS(
  user_id, queue_pos, time_add_queue, time_game_start,
  time_game_end)
VALUES('2', '2', '2018-02-12 14:25:03', '2018-02-12 14:32:03', '2018-02-12 14:38:03');
MYSQL_SCRIPT

echo "Added two users to the database"
