#!/bin/bash

mysql -uroot <<MYSQL_SCRIPT
DROP DATABASE IF EXISTS SDS1;
CREATE DATABASE SDS1;
use SDS1;

CREATE TABLE VENUE (
  venue_id int(11) unsigned NOT NULL,
  username varchar(16) NOT NULL DEFAULT '',
  password varchar(24) NOT NULL DEFAULT '',
  PRIMARY KEY (venue_id),
  CONSTRAINT CHK_ID CHECK (venue_id > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE MACHINE (
  machine_id int(11) unsigned NOT NULL,
  venue_id int(11) unsigned DEFAULT NULL,
  category varchar(16) NOT NULL DEFAULT '',
  total smallint(11) unsigned DEFAULT NULL,
  available smallint(11) unsigned DEFAULT NULL,
  base_price decimal(11,0) unsigned DEFAULT NULL,
  current_price decimal(11,0) unsigned DEFAULT NULL,
  PRIMARY KEY (machine_id),
  KEY VENUE_MACHINE (venue_id),
  CONSTRAINT VENUE_MACHINE FOREIGN KEY (venue_id) REFERENCES VENUE (venue_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT CHK_PRICE CHECK (base_price >= 0.00 and current_price >= 0.00),
  CONSTRAINT CHK_TOT CHECK (total > 0 and available >= 0),
  CONSTRAINT CHK_ID CHECK (machine_id > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE USER (
  user_id int(11) unsigned NOT NULL,
  username varchar(16) NOT NULL DEFAULT '',
  password varchar(24) NOT NULL DEFAULT '',
  name varchar(40) NOT NULL DEFAULT '',
  games_played smallint(11) unsigned DEFAULT 0,
  games_missed smallint(11) unsigned DEFAULT 0,
  PRIMARY KEY (user_id),
  CONSTRAINT CHK_NUM_POS CHECK (games_played >= 0 and games_missed >= 0),
  CONSTRAINT CHK_ID CHECK (user_id > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE GAME (
  game_id int(11) unsigned NOT NULL,
  user_id int(11) unsigned DEFAULT NULL,
  queue_pos int(11) DEFAULT -1,
  time_add datetime DEFAULT NULL,
  time_start datetime DEFAULT NULL,
  time_end datetime DEFAULT NULL,
  num_players int(11) unsigned DEFAULT 2,
  machine_id int(11) unsigned DEFAULT 0,
  matchmaking tinyint(1) DEFAULT 0,
  PRIMARY KEY (game_id),
  KEY USER_GAME (user_id),
  KEY MACHINE_GAME (machine_id),
  CONSTRAINT MACHINE_GAME FOREIGN KEY (machine_id) REFERENCES MACHINE (machine_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT USER_GAME FOREIGN KEY (user_id) REFERENCES USER (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT CHK_QUEUE CHECK (queue_pos >= -1),
  CONSTRAINT CHK_NUMP CHECK (num_players > 0),
  CONSTRAINT CHK_TIME CHECK (time_start >= time_add and time_end >= time_start),
  CONSTRAINT CHK_ID CHECK (game_id > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

grant all on sds1.* to 'blockchain' identified by 'rosecolouredboy';

MYSQL_SCRIPT

echo "Deleted any existing databases with name 'SDS1'"
echo "Created database 'SDS'"
echo "Created 4 tables "