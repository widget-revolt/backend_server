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

var ServerConfig = require("../../config").ServerConfig;
var PG = require('pg');
if(ServerConfig.DEPLOY_ENVIRONMENT != "development") {
	PG = require('pg').native;
}

var Logger = require("../../log").getLogger();
var QueryHelpers = require('./query_helpers.js');


///////////////////////////////////////////////////////
// Const



///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES PUSH NOTIFICATIONS ===");

	var retObj = new PushNotificationsDB(inName, inConnectString);
	return retObj;
};

///////////////////////////////////////////////////////
function PushNotificationsDB(inName, inConnectString)
{

	this._mName = inName;
	this._mConnectString = inConnectString;
}

//--------------------------------------------------
PushNotificationsDB.prototype.testClearDatabase = function(callback)
{
	var connectString = this._mConnectString;
	var queryStr = "DELETE from push_notifications";
	var queryParams = [];

	PG.connect(connectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		client.query(queryStr, queryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results?
			var resultObj = result;

			LOGDEBUG("** deleted all records in push_notifications for testing **");
			callback(null, resultObj);

		});//query()
	});//connect()

};


//--------------------------------------------------
PushNotificationsDB.prototype.createPushNotificationObject = function(uid,
																	  app,
																	  status,
																	  //date_sent
																	  platform,

																	  rule_is_monetizer,
																	  rule_recency,
																	  rule_frequency,
																	  rule_channels,
																	  quiet_time,
																	  ttl,
																	  message,
																	  tracking_code,
																	  target_app_id,
																	  extras,
																	  badge_count,
																	  sound,

																	  date_sent_str,
																	  push_receipt

																		)
{

	// data clean
	if(!ttl) {
		ttl = "0";
	}
	ttl = parseInt(ttl);

	var date_sent = null;
	try {
		date_sent = new Date(date_sent_str);
		date_sent = date_sent.toISOString();
	}
	catch(e) {
		date_sent = null;
	}

	var retObject = {

		"uid": uid || null,
		"app": app,

		"status": status || "unsent",

		"platform": platform,
		"rule_is_monetizer": rule_is_monetizer || "",
		"rule_recency": rule_recency || "",
		"rule_frequency": rule_frequency || "",
		"rule_channels": rule_channels || "",
		"quiet_time": quiet_time || "",
		"ttl": ttl ,

		"message": message,
		"tracking_code": tracking_code || "",
		"target_app_id": target_app_id || "",
		"extras" : extras || "",
		"badge_count" : badge_count || "",
		"sound" : sound || "",

		"date_sent": date_sent,
		"push_receipt": push_receipt || ""

	};
	return retObject;
};

//--------------------------------------------------
// saves PushNotification. Will insert or update depending on if exists
PushNotificationsDB.prototype.savePushNotificationObject = function(pushNotificationObj, callback)
{
	var self = this;

	var needsInsert = false;
	var uid = pushNotificationObj["uid"];

	self.findOne(uid, function(err, result){

		if(err || !result) {
			needsInsert = true;
		}

		if(needsInsert)
		{
			self.insertPushNotificationObject(pushNotificationObj, function(err, result) {
				callback(err, result);
			});//insertPushNotificationObject
		}
		else
		{
			self.updatePushNotificationObject(pushNotificationObj, function(err, result) {
				callback(err, result);
			});//updatePushNotificationObject
		}

	});//findOne()
};

//--------------------------------------------------
// find promobanner. Will insert or update depending on if exists
PushNotificationsDB.prototype.findOne = function(uid, callback)
{
	// if the uid is null, fail immediately
	if(!uid) {
		callback("null uid, need to create", null);
		return;
	}


	var self = this;
	var queryStr = "SELECT * from push_notifications where uid = $1;";
	var queryParams = [uid];
	QueryHelpers.findOne(self._mConnectString, queryStr, queryParams, callback);

};

//--------------------------------------------------
// find list based on some query (eventually - right now returns all)
PushNotificationsDB.prototype.getPushNotifications = function(inQueryStr, inQueryParams, inOrderBy, callback)
{

	var self = this;

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err, null);
			return;
		}

		var queryStr = "SELECT * FROM push_notifications";
		var queryParams = [];
		if(inQueryStr)
		{
			queryStr += " WHERE " + inQueryStr;
			queryParams = inQueryParams;
		}

		if(inOrderBy)
		{
			queryStr += " ORDER BY " + inOrderBy;
		}

		queryStr += ";";


		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				callback(err, null);
				return;
			}

			// any results?
			callback(null, result.rows);


		});//query()
	});//connect()
};

//--------------------------------------------------
// saves SocialAction. Will insert or update depending on if exists
PushNotificationsDB.prototype.insertPushNotificationObject = function(pushNotificationObj, callback)
{
	var qObj = createInsertUpdateQuery("INSERT", pushNotificationObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};
//--------------------------------------------------
// saves SocialAction. Will insert or update depending on if exists
PushNotificationsDB.prototype.updatePushNotificationObject = function(pushNotificationObj, callback)
{
	var qObj = createInsertUpdateQuery("UPDATE", pushNotificationObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};

///////////////////////////////////////////////////////
// Private Util Methods

//-----------------------------------------------------
function createInsertUpdateQuery(inType, pushObj)
{
	/*
	 "uid": uid || null,
	 "app": app,

	 "status": status || "unsent",

	 "platform": platform,
	 "rule_is_monetizer": rule_is_monetizer || "",
	 "rule_recency": rule_recency || "",
	 "rule_frequency": rule_frequency || "",
	 "rule_channels": rule_channels || "",
	 "quiet_time": quiet_time || "",
	 "ttl": ttl || "",

	 "message": message,
	 "tracking_code": tracking_code || "",
	 "target_app_id": target_app_id || "",
	 "extras" : extras || "",
	 "badge_count" : badge_count || "",
	 "sound" : sound || "",

	 "date_sent": date_sent,
	 "push_receipt": push_receipt || ""

	 */

	var queryParams = [


		pushObj.platform,
		pushObj.status,

		pushObj.rule_is_monetizer,
		pushObj.rule_recency,
		pushObj.rule_frequency,
		pushObj.rule_channels,

		pushObj.quiet_time,
		pushObj.ttl,

		pushObj.message,
		pushObj.tracking_code,
		pushObj.target_app_id,
		pushObj.extras,
		pushObj.badge_count,
		pushObj.sound,

		pushObj.date_sent,
		pushObj.push_receipt

	];

	var queryStr;
	if(inType == "UPDATE")
	{
		queryStr = "UPDATE push_notifications SET (platform, status, rule_is_monetizer, rule_recency, rule_frequency, rule_channels, quiet_time, ttl, message, tracking_code, target_app_id, extras, badge_count, sound, date_sent, push_receipt) = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) WHERE uid=$17;";

		var primaryKey = pushObj.uid;
		queryParams.push(primaryKey);
	}
	else
	{
		queryStr = "INSERT INTO push_notifications(date_create, platform, status, rule_is_monetizer, rule_recency, rule_frequency, rule_channels, quiet_time, ttl, message, tracking_code, target_app_id, extras, badge_count, sound, date_sent, push_receipt, app) "
			+ "VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);";
		var app = pushObj.app;
		queryParams.push(app);
	}

	var retObj = {
		"queryStr":queryStr,
		"queryParams": queryParams
	};

	return retObj;

}
//-----------------------------------------------------
function LOGINFO(s) {
	Logger.info("Database", s);
}
//-----------------------------------------------------
function LOGDEBUG(s) {
	Logger.debug("Database", s);
}
//-----------------------------------------------------
function LOGERROR(s) {
	Logger.error("Database", s, false);
}
//-----------------------------------------------------
function LOGCRITICAL(s) {
	Logger.error("Database", s, true);
}
