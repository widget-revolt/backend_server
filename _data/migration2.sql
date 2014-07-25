
-- 2014-04-30 - add leaderboard support



CREATE TABLE scores (
	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,

	app text,
	app_id text NOT NULL,	-- this is the bundle id
	user_uuid text NOT NULL,
	leaderboard_id text NOT NULL,
	score integer NOT NULL,			-- this is a 4byte long  dont overflow me

	document json
);