
// development/staging/production

var gConfig_deployEnvironment = process.env.DEPLOY_ENVIRONMENT || "development";
var gConfig_serverDebug = true;
var gConfig_port = 8080;

if(process.env.SERVER_DEBUG == "no") {
	gConfig_serverDebug = false;
}
else {
	console.log("SERVER_DEBUG==YES");
}

if(gConfig_deployEnvironment == "production") {
	// Heroku assigns its own config ports
	gConfig_port = process.env.PORT || 80;
}
else {
	// Heroku assigns its own config ports
	gConfig_port = process.env.PORT || gConfig_port;
}	


exports.ServerConfig =
{
	DEPLOY_ENVIRONMENT:		gConfig_deployEnvironment,
	SERVER_DEBUG:			gConfig_serverDebug,
	PORT:					gConfig_port
};


exports.LogConfig =
{
	'Startup':				true,
	'Database':				true,
	'AppStore':				true,
	'API':					true,
	'IOS IAP Validator':	true,
	'Android IAP Validator': true

};


exports.APP_CONFIG = 
{
	"my_app": {
		"db_development": "postgres://YOUR_LOCAL_POSTGRES_URL",

		"db_stage": "postgres://YOUR_STAGE_POSTGRES_URL",
		
		"db_production": "postgres://YOUR_PROD_POSTGRES_URL",
		
		"android_iap_hash": "PUT YOUR ANDROID IAP HASH HERE"
	}

	



};

exports.LEADERBOARD_CONFIG = {
	"refresh_timeout": 1800 //000		// 30 minutes

};