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

var util = require('util');



var S = require("string");

var ServerConfig = require("../config").ServerConfig;
var APP_CONFIG = require("../config").APP_CONFIG;
var Logger = require("../log").getLogger();

var UserDB = require("./postgres/users_db");
var AppConfigDB = require("./postgres/appconfig_db");
var InventoryDB = require("./postgres/inventory_db");
var TransactionDB = require("./postgres/transactions_db");
var CouponsDB = require("./postgres/coupons_db");
var DevicesDB = require("./postgres/devices_db");
var ClientUsersDB = require("./postgres/client_users_db");
var LeaderboardDB = require("./postgres/leaderboard_db");
var PromoBannersDB = require("./postgres/promo_banners_db");
var SocialActionsDB = require("./postgres/social_actions_db");
var PushNotificationsDB = require("./postgres/push_notifications_db");

///////////////////////////////////////////////////////
// module vars

var _instanceDatabaseManager = null;// singleton instance


///////////////////////////////////////////////////////
// Exports
exports.Start = function(completionFn, errorFn)
{

	Logger.debug("Database", "Starting db manager...");
	
	DatabaseManager.sharedManager().onStart(completionFn, errorFn);
};

exports.Pre_Flight = function(completionFn)
{
	//until nodejitsu supports node 10.x...
	setTimeout(completionFn,0);//setImmediate(completionFn);
};


//----------------------------------------------
exports.sharedManager = function()
{
	return DatabaseManager.sharedManager();
};

///////////////////////////////////////////////////////
// Private utils
function LOGINFO(s) {
	Logger.info("Database", s);
}
function LOGDEBUG(s) {
	Logger.debug("Database", s);
}
function LOGERROR(s) {
	Logger.error("Database", s, false);
}
function LOGCRITICAL(s) {
	Logger.error("Database", s, true);
}


///////////////////////////////////////////////////////


// =====================================================
// Object def
function DatabaseManager()
{
	// we'll have a cluster of database instances.  Each database instance will have its own user, transactions, etc access
	this._mDatabases = {};
}
//----------------------------------------------
DatabaseManager.sharedManager = function()
{
	if(!_instanceDatabaseManager) {
		_instanceDatabaseManager = new DatabaseManager();
	}
	return _instanceDatabaseManager;
};

//----------------------------------------------
DatabaseManager.prototype.onStart = function(completionFn, errorFn)
{
	///LOGDEBUG(APP_CONFIG);
	var self = this;
	var appConfigKeys = Object.keys(APP_CONFIG);
	appConfigKeys.forEach(function(dbName){
		self._mDatabases[dbName] = new Database(dbName);
	});


	// now start each database
	var keyArray = Object.keys(this._mDatabases);

	var curDBIndex = 0;
	var curDatabase = this._mDatabases[keyArray[curDBIndex]];

	function _nextDatabase(err) 
	{
		LOGDEBUG("nextDatabase() called.  Err =" + err);
		if(err == 0) 
		{
			curDBIndex++;
			if(curDBIndex >= keyArray.length) {
				completionFn();
				return;
			}
			curDatabase = self._mDatabases[keyArray[curDBIndex]];
			curDatabase.startDatabase(_nextDatabase);
		}
		else
		{
			errorFn({result: 'fail', err: err});
		}
	}

	curDatabase.startDatabase(_nextDatabase);

};
//----------------------------------------------
DatabaseManager.prototype.getDBForApp = function(inAppName)
{
	var retObj = null;
	try
	{
		retObj = this._mDatabases[inAppName];
	}
	catch(e)
	{
		LOGERROR("Error getting db for app:" + inAppName + ", " + e.message);
	}
	return retObj;
};

//-----------------------------------------------


function Database(inName)
{
	this._mName = inName;
	this._mDatabase = null;
	this._mDBType = "pg";

	// db collections
	this._mUsers = null;
	this._mTransactions = null;
	this._mInventory = null;
	this._mAppConfig = null;
	this._mCoupons = null;
	this._mDevices = null;
	this._mClientUsers = null;
	this._mLeaderboard = null;
	this._mPromoBanners = null;
	this._mSocialActions = null;
	this._mPushNotifications = null;

	LOGINFO("creating db name=" + inName);
}

Database.prototype.getUserCollection = function() 
{
	return this._mUsers;
};

Database.prototype.getTransactionCollection = function() 
{
	return this._mTransactions;
};

Database.prototype.getInventoryCollection = function() 
{
	return this._mInventory;
};

Database.prototype.getAppConfigCollection = function()
{
	return this._mAppConfig;
};

Database.prototype.getCouponsCollection = function()
{
	return this._mCoupons;
};
Database.prototype.getDevicesCollection = function()
{
	return this._mDevices;
};
Database.prototype.getClientUsersCollection = function()
{
	return this._mClientUsers;
};

Database.prototype.getLeaderboardCollection = function()
{
	return this._mLeaderboard;
};

Database.prototype.getPromoBannersCollection = function()
{
	return this._mPromoBanners;
};

Database.prototype.getSocialActionsCollection = function()
{
	return this._mSocialActions;
};

Database.prototype.getPushNotificationsCollection = function()
{
	return this._mPushNotifications;
};



//------------------------------------------------
Database.prototype.startDatabase = function(callback)
{
	LOGINFO("startDatabase: " + this._mName);



    var connectString = '';

    var myConfig = APP_CONFIG[this._mName];
	if(ServerConfig.DEPLOY_ENVIRONMENT == "staging") {
		connectString = myConfig["db_stage"];
	}
	else if(ServerConfig.DEPLOY_ENVIRONMENT == "production") {
		connectString = myConfig["db_production"];
	}
	else if(ServerConfig.DEPLOY_ENVIRONMENT == "development") {
		connectString = myConfig["db_development"];
	}
	else
	{
		console.log('ERROR: Cannot find a connection string in APP_CONFIG');
		process.exit(99);
	}

	LOGDEBUG(connectString);


	// Connect to the db
	var selfObj = this;


	LOGINFO("...opening pg dbs");

	selfObj._mUsers = UserDB.createInstance(selfObj._mName, connectString);
	selfObj._mAppConfig = AppConfigDB.createInstance(selfObj._mName, connectString);
	selfObj._mInventory = InventoryDB.createInstance(selfObj._mName, connectString);
	selfObj._mTransactions = TransactionDB.createInstance(selfObj._mName, connectString);
	selfObj._mCoupons = CouponsDB.createInstance(selfObj._mName, connectString);
	selfObj._mDevices = DevicesDB.createInstance(selfObj._mName, connectString);
	selfObj._mClientUsers = ClientUsersDB.createInstance(selfObj._mName, connectString);
	selfObj._mLeaderboard = LeaderboardDB.createInstance(selfObj._mName, connectString);
	selfObj._mPromoBanners = PromoBannersDB.createInstance(selfObj._mName, connectString);
	selfObj._mSocialActions = SocialActionsDB.createInstance(selfObj._mName, connectString);
	selfObj._mPushNotifications = PushNotificationsDB.createInstance(selfObj._mName, connectString);


	LOGINFO("...Opened");


	callback(0);



};
