
-- migration 1 -
-- add app to icetales db
	-- ALTER TABLE users ADD COLUMN app text;
	-- ALTER TABLE appconfig ADD COLUMN app text;
	-- ALTER TABLE inventory ADD COLUMN app text;
	-- ALTER TABLE transactions ADD COLUMN app text;

	-- update users set app='icetales';
	-- update appconfig set app='icetales';
	-- update inventory set app='icetales';
	-- update transactions set app='icetales';

-- migration 2
-- add scores table

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




CREATE TABLE users (
	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,
	uuid text NOT NULL,
	auth text,

	app text,

	-- facebook info
	fbid text,


	-- user info
	fname text,
	lname text,
	email text,
	birthday date,
	gender text,
	locale text,

	-- iOS gamecenter info
	gamecenter_id text,
	gamecenter_alias text,

	-- Google Play games info (reserved)
	gpg_id text,
	gpg_alias text,

	-- device info - this should really be split into a separate table 
	platform text,
	osvers text,
	device text,
	carrier text,
	mcc text,
	mnc text,
	
	-- ad fields
	idfv text,
	asid text,
	odin text,  -- this is irrelevant on ios

	-- referrer and trackers
	install_tracker_id text,
	install_tracker_name text,
	install_referrer text,
	install_referrer_ip text,

	-- this will hold all aux info that we don't want to schema-ize.  
	-- Future use only
	document json


);



-- this is a client auxilliary table
CREATE TABLE client_users (
	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,
	user_uuid text NOT NULL,

	-- this will hold all aux info 
	document json

);

-- this is used for push tracking
CREATE TABLE devices (
	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,
	
	user_uuid text NOT NULL,
	device_id text NOT NULL,	-- android id on android, idfv on ios
	apns_token text,			-- ios push token
	apid text,			-- gcm token
	push_tags text,
	push_disabled boolean,		-- T if push is disabled on device

	language text,
	country text,
	time_zone integer,
	platform text,
	osvers text,

	device text,
	carrier text,
	mcc text,
	mnc text,
	imei text
);



CREATE TABLE appconfig (

	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,
	app text,
	status text,
	version text,
	description text,
	data json

);


CREATE TABLE coupons (
	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,
	uuid text NOT NULL,
	coupon_id text NOT NULL,
	email text NOT NULL,
	redeemed boolean,
	coupon_code text,
	coupon_code_urlsafe text,
	redeem_date timestamp
);

CREATE TABLE inventory (
	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,

	app text,
	status text,		-- active, inactive
	product_id text,
	platform text,
	iap_type text,
	name text,
	description text,

	currency_type text,
	currency_amount numeric,

	current_price numeric,
	suggested_price numeric,
	rank integer,
	highlight text,
	tab text,
	icon text,

	document json		-- dumping gorund for other data
);


CREATE TABLE transactions (
	uid BIGSERIAL PRIMARY KEY,
	date_create timestamp NOT NULL,

	app text,
	user_uuid text NOT NULL,
	user_odin text,
	platform text NOT NULL,
	product_id text NOT NULL,

	item_price numeric,
	transaction_id numeric NOT NULL,
	itms_receipt text,

	document json
);


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
	rule_frequency integer DEFAULT 1, -- run every NN sessions

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