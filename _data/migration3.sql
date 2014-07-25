-- migration 3 - 2014-05-24
--
-- Create Table promobanners
-- Create Table pushnotifications
-- Create Table socialactions
-- add apnstracking to devices table:
	-- ALTER TABLE devices ADD COLUMN push_disabled boolean;
	-- ALTER TABLE devices ADD COLUMN apns_token boolean;
	-- ALTER TABLE devices ADD COLUMN apid text;
	-- ALTER TABLE devices ADD COLUMN push_tags text;



-- modifications to devices table
ALTER TABLE devices ADD COLUMN push_disabled boolean;
ALTER TABLE devices ADD COLUMN apns_token text;
ALTER TABLE devices ADD COLUMN apid text;
ALTER TABLE devices ADD COLUMN push_tags text;

UPDATE devices SET push_disabled = 'n';

-- modifications to users table
ALTER TABLE users ADD COLUMN install_tracker_id text;
ALTER TABLE users ADD COLUMN install_tracker_name text;
ALTER TABLE users ADD COLUMN install_referrer text;
ALTER TABLE users ADD COLUMN install_referrer_ip text;

UPDATE users SET install_tracker_id = '';
UPDATE users SET install_tracker_name = '';
UPDATE users SET install_referrer = '';
UPDATE users SET install_referrer_ip = '';

-- this table encapsulates both facebook requests and invites because they are essentially the same thing, the only difference being the actual state
CREATE TABLE social_actions(
	uid BIGSERIAL PRIMARY KEY,
    date_create timestamp NOT NULL,
    app text,
    date_update timestamp, 	-- updated when status changes

	status text NOT NULL,	-- active, inactive

	user_uuid text NOT NULL,   -- user this is from
	user_social_id text NOT NULL,  -- social id of this user (e..g facebook id)
	fname text, -- first name of user sending
	lname text, -- last name of user sending
	friend_id text NOT NULL, -- target friend
	request_type text,			-- optional request type field for biz logic
	request_text_data_1 text,
	request_num_data_1 numeric

);

CREATE TABLE promo_banners(
	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,
	app text,

	name text,		-- user friendly name, optional
	status text,	-- active, inactive
	banner_type text,	-- app specific
	platform text, -- ios or android or both
	rank integer DEFAULT 0,
	notes text,
	rules text,

	rule_is_monetizer text, 	-- y, n, blank = dont care
	rule_recency integer, -- >0 .  If 0 dont care
	rule_gender text, -- m, f, blank if not set
	rule_location text,	-- unused
	rule_date_start timestamp, -- placehold, can be null meaning we dont care
	rule_date_end timestamp,	-- placeholder, will expire promo banners

	title text,
	message text,
	media_url text,

	banner_action text, -- open store, open app store, go to twitter, go to fb, go to pinterest, invite, open url, etc
	banner_action_arg1 text,
	banner_action_arg2 text,

	document json
);


CREATE TABLE push_notifications(
	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,
	app text,

	-- status
	status text NOT NULL, -- unsent, sent
	schedule_date timestamp,
    date_sent timestamp,

    -- rules
	platform text NOT NULL,	--ios or android
	rule_is_monetizer text, -- y,n, ""
	rule_recency text, -- UNIMPLEMENTED, formatted pair --> lt,20 or gt,10, blank for dont care
	rule_frequency text, --  UNIMPLEMENTED, formatted pair --> lt,20 or gt,10, blank for dont care
	rule_channels text, -- UNIMPLEMENTED, comma separated list of app channels
	rule_gender text, -- UNIMPLEMENTED, m, f, ""
	quiet_time text, -- UNIMPLEMENTED, formatted pair --> 21,04 (quiet is from 9pm to 4am)
    ttl integer,	-- UNIMPLEMENTED: ttl in seconds?minutes?

	-- content
	message text NOT NULL,
	tracking_code text,
	target_app_id text, -- set this to non empty if launching an app
	extras text, --UNIMPLEMENTED additional key/data pairs
    badge_count text, -- UNIMPLEMENTED, "auto", or integer or increment
    sound text, --UNIMPLEMENTED


	-- stats
	push_receipt text, -- receipt from 3rd party service
	sends integer,  -- number of devices sent (hopefully we don't overflow!)
	direct_response integer,	--direct number of opens from this push
	indirect_response integer,	-- number of people that opened app within NN (NN=12) hours from push

	document json
);