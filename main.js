//
//	Copyright (c) 2014 Widget Revolt LLC.  All rights reserved
//
//	Permission is hereby granted, free of charge, to any person obtaining a copy
//	of this software and associated documentation files (the "Software"), to deal
//	in the Software without restriction, including without limitation the rights
//	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//	copies of the Software, and to permit persons to whom the Software is
//	furnished to do so, subject to the following conditions:
//
//	The above copyright notice and this permission notice shall be included in
//	all copies or substantial portions of the Software.
//
//	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//	THE SOFTWARE.


"use strict";

require('newrelic');
var ServerConfig = require("./config").ServerConfig;

var fs = require('fs');
var path = require('path');
var util = require('util');
var http = require('http');

var express = require('express');

var Utils = require("./lib/utils.js");
var Startup = require("./startup.js");
var Logger = require('./log.js').getLogger();
var API = require('./api.js');

var Data = null;
var AppStoreServer = null;


var options =
{
	DEBUG: (ServerConfig.DEPLOY_ENVIRONMENT == "staging") || (ServerConfig.DEPLOY_ENVIRONMENT == "development") || ServerConfig.SERVER_DEBUG
};

// Start everything up
Startup.Start('AppStoreServer', 
	function(world){
		Logger.info("AppStore", "DEPLOY_ENVIRONMENT = " + ServerConfig.DEPLOY_ENVIRONMENT);

		Data = world.Data;
		AppStoreServer = new _AppStoreServer();
		AppStoreServer.public.Go();
	},
	function(result){

		console.log("FATAL ERROR starting up");
	}
);

function _AppStoreServer()
{
this.public = {

	Go: function() 
	{
		var app = express();

		app.configure(function() {

			app.set('port', ServerConfig.PORT || 8080);
			app.set('views', __dirname + '/_server/views');
			app.set('view engine', 'ejs');
			app.set('view options', {layout:false});
			app.use(express.favicon());

			if(ServerConfig.SERVER_DEBUG) {
				app.use(express.static(__dirname + '/_client'));
				console.log("Static content at " + __dirname + '/_client');
			}

			
			app.use(express.logger('dev'));	//<== if ab performance issue, check this! http://micheljansen.org/blog/entry/1698
			app.use(express.bodyParser());
			app.use(express.methodOverride());
			app.use(express.cookieParser());

			app.use(app.router);
		});

		app.configure('development', function(){
			app.use(express.errorHandler());
		});

		app.get('/', function(req, res){
			res.write('OK');
			res.end();
		});

		// API Calls
		app.post("/:appname/register_user", API.registerUser);	// tested
		app.post("/:appname/add_user_install_info", API.addUserInstallInfo);
		app.post("/:appname/validate_ios_purchase", API.validateIOSPurchase);
		app.post("/:appname/validate_android_purchase", API.validateAndroidPurchase);
		app.post("/:appname/get_inventory", API.getInventory);
		app.post("/:appname/redeem_coupon", API.redeemCoupon);
		app.post("/:appname/register_device", API.registerDevice);//tested
		app.post("/:appname/save_app_user_info", API.saveAppUserInfo);
		app.post("/:appname/get_app_user_info", API.getAppUserInfo);
		app.post("/:appname/report_score", API.reportScore);
		app.post("/:appname/global_leaders_list", API.getGlobalLeaders);
		app.post("/:appname/friend_leaders", API.getFriendLeaders);
		app.post("/:appname/get_promo_banners", API.getPromoBanners);

		app.post("/:appname/send_facebook_gifts", API.sendFacebookGift);//tested
		app.post("/:appname/get_available_facebook_gifts", API.getAvailableGifts);//tested
		app.post("/:appname/claim_facebook_gifts", API.claimFacebookGifts);//tested

		//app.post("/tapstream_postback", API.tapstream_postback);

		// and create the server
		http.createServer(app).listen(ServerConfig.PORT, function() {
			console.log('Widget Revolt Backend server listening on port ' + app.get('port'));
		})
		.on('error', function(e) {
			console.log('Widget Revolt Backend startup failed. Error: ' + e.message);
		});

		///======= DEBUG DEBUG
		// var logLevel = 'info';
  //       if(true) {
  //           logLevel = 'debug';
  //       }

  //       var winston = require('winston');
  //       var testLog = new (winston.Logger)({
  //           transports: [
  //             new (winston.transports.Console)({ level: logLevel, colorize: true, json: true }),
  //           ]
  //         });
  //       testLog.info("****** HELLO FROM WINSTON ****");
  //       testLog.error("****** HELLO FROM WINSTON ****");
	},


	eoo:null
	};


}


