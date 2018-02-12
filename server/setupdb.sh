#!/bin/bash

mysql -uroot -p <<MYSQL_SCRIPT
DROP DATABASE IF EXISTS $1;
CREATE DATABASE $1;
use $1;
CREATE TABLE USERS (
  user_id int(11) unsigned NOT NULL AUTO_INCREMENT,
  queue_pos int(11) DEFAULT NULL,
  time_add_queue datetime DEFAULT NULL,
  time_game_start datetime DEFAULT NULL,
  time_game_end datetime DEFAULT NULL,
  in_queue tinyint(1) DEFAULT '1',
  number_players int(11) DEFAULT '2',
  account_balance decimal(13,4) DEFAULT '0.0000',
  PRIMARY KEY (user_id),
  KEY queue (queue_pos)
) ENGINE=InnoDB AUTO_INCREMENT=228636 DEFAULT CHARSET=utf8;
MYSQL_SCRIPT

echo "Deleted any existing databases with name '$1'"
echo "Created database '$1'"
echo "Created table '$2'"
echo "Added 8 columns"