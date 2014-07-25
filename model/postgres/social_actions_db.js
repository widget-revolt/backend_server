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

var Async = require("async");

var ServerConfig = require("../../config").ServerConfig;
var PG = require('pg');
if(ServerConfig.DEPLOY_ENVIRONMENT != "development") {
	PG = require('pg').native;
}
var Utils = require("../../lib/utils.js");
var Logger = require("../../log").getLogger();
var QueryHelpers = require('./query_helpers.js');


///////////////////////////////////////////////////////
// Const
var GIFT_WAIT_PERIOD = 24 * 3600000;	// 24 hours
if(ServerConfig.DEPLOY_ENVIRONMENT == "staging") {
	GIFT_WAIT_PERIOD = 10 * 60 * 1000; // 10 minutes
}

///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES SOCIAL ACTIONS ===");
	LOGINFO("Social actions gifting timeout: " + GIFT_WAIT_PERIOD);

	var retObj = new SocialActionsDB(inName, inConnectString);
	return retObj;
};

///////////////////////////////////////////////////////
function SocialActionsDB(inName, inConnectString)
{

	this._mName = inName;
	this._mConnectString = inConnectString;
}



//--------------------------------------------------
SocialActionsDB.prototype.createSocialActionObject = function(inUID,
															inApp,
															dateUpdate,
															status,
															user_uuid,
															user_social_id,
															friend_id,
															requestType,
															requestTextData1,
															requestNumData1,
															fname,
															lname


	)
{
	// status should be:
	// active: open request
	// claimed: friend opened or otherwise invoked the action
	// inactive: player has been credited with action

	var retObject = {

		"uid": inUID || null,
		"app": inApp,
		"date_update": dateUpdate,

		"status": status || "active",
		"user_uuid": user_uuid,			// required
		"user_social_id": user_social_id, // required
		"friend_id": friend_id,			// required

		"request_type": requestType || "",
		"request_text_data_1": requestTextData1 || "",
		"request_num_data_1": requestNumData1,

		"fname": fname || "",
		"lname": lname || ""

	};
	return retObject;
};

//--------------------------------------------------
// saves promobanner. Will insert or update depending on if exists
SocialActionsDB.prototype.saveSocialActionObject = function(socialActionObj, callback)
{
	var self = this;

	var needsInsert = false;
	var uid = socialActionObj["uid"];

	self.findOne(uid, function(err, result){

		if(err || !result) {
			needsInsert = true;
		}

		if(needsInsert)
		{
			self.insertSocialActionObject(socialActionObj, function(err, result) {
				callback(err, result);
			});//insertSocialActionObject
		}
		else
		{
			self.updateSocialActionObject(socialActionObj, function(err, result) {
				callback(err, result);
			});//updateSocialActionObject
		}

	});//findOne()
};

//--------------------------------------------------
// find promobanner. Will insert or update depending on if exists
SocialActionsDB.prototype.findOne = function(uid, callback)
{
	// if the uid is null, fail immediately
	if(!uid) {
		callback("null uid, need to create", null);
		return;
	}

	var self = this;
	var queryStr = "uid = $1;";
	var queryParams = [uid];

	self.findOneWithParams(queryStr, queryParams, callback);

};

//--------------------------------------------------
// find promobanner. Will insert or update depending on if exists
SocialActionsDB.prototype.findOneWithParams = function(inQueryStr, inQueryParams, callback)
{

	var self = this;
	var queryStr = "SELECT * FROM social_actions WHERE " + inQueryStr;

	var queryParams = inQueryParams;
	QueryHelpers.findOne(self._mConnectString, queryStr, queryParams, callback);

};


//--------------------------------------------------
// saves SocialAction. Will insert or update depending on if exists
SocialActionsDB.prototype.insertSocialActionObject = function(socialActionObj, callback)
{
	var qObj = createInsertUpdateQuery("INSERT", socialActionObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};
//--------------------------------------------------
// saves SocialAction. Will insert or update depending on if exists
SocialActionsDB.prototype.updateSocialActionObject = function(socialActionObj, callback)
{
	var qObj = createInsertUpdateQuery("UPDATE", socialActionObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};

//--------------------------------------------------
// This biz logic "sends gifts" to a users fb friends.
// Not sure if I really like having biz logic here but this is ok for now since it needs to do a lot of db work
SocialActionsDB.prototype.sendGifts = function(userUUID, userSocialId, facebookFriendList, requestType, fname, lname, outerCallback)
{
	var friendArray = facebookFriendList.split(",");
	var self = this;


	var updatedFriends = [];

	//NOTE: using eachSeries to debug.  This doesn't need to be serial
	Async.eachSeries(friendArray,
		function(friendId, callback) {

			var safeFriendId = friendId.trim();
			self.sendGiftToFriend(userUUID, userSocialId, safeFriendId, requestType, fname,lname, function(err, result){
				if(err) {
					callback(err);
				}
				else {
					// if result==null then we didn't update record so only increment counter otherwise
					if(result) {
						updatedFriends.push(safeFriendId);
					}
					callback();
				}
				//done
			});

		},
		function(err) {

			if(err) {
				outerCallback(err, null);
				return;
			}

			// ok
			outerCallback(null, {"gifts_sent": updatedFriends.length, "gifts_sent_to_friend_ids":  updatedFriends});
		}
	);//Async.each

};

//--------------------------------------------------
///@private
// send a single gift to a friend with conditions
SocialActionsDB.prototype.sendGiftToFriend = function(userUUID, userSocialId, friendId, requestType, fname, lname, callback) {

	// strategy: we're going to do upserts here to keep our db from growing out of control.
	// plus this will keep things nice and tidy
	var self = this;

	var expiryTimeout = GIFT_WAIT_PERIOD;
	var socialActionObj = self.createSocialActionObject(null, "", null,
		"active",
		userUUID,
		userSocialId,
		friendId,
		requestType,
		"",
		0,
		fname,
		lname);

	var queryStr = "user_social_id = $1 AND friend_id = $2 AND request_type = $3";
	var queryParams = [userSocialId, friendId, requestType];
	self.findOneWithParams(queryStr, queryParams, function(err, result) {

		var needsInsert = false;
		if(err || !result) {
			needsInsert = true;
		}

		// if we need to insert, then we are good, just insert, else
		if(needsInsert) {
			self.insertSocialActionObject(socialActionObj, function(err, result) {

				callback(err, result);

			});//insertSocialActionObject
		}
		else {

			var existingObj = result;

			// if active and within the last 24 hours, dont touch,
			// else update it by making it active and updated now.  Old requests will be considered to be expired
			var now = new Date().getTime();
			var oldDate = existingObj["date_update"].getTime();
			oldDate += expiryTimeout;

			if(oldDate > now) {
				callback(null, null);	// dont flag an error to caller (cuz we'll exit outer loop);
				return;
			}

			socialActionObj["uid"] = existingObj["uid"];
			self.updateSocialActionObject(socialActionObj, function(err, result) {

				callback(err, result);

			});//updateSocialActionObject

		}
	});


};

//--------------------------------------------------
// Finds all gifts marked "active" for user specified.  Limited to 100 if limit not specified
SocialActionsDB.prototype.getGiftsForSocialId = function(userSocialId, inLimit, callback)
{

	var self = this;
	var limit = inLimit;
	if(!limit) {
		limit = 100;
	}

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err, null);
			return;
		}

		var queryStr = "SELECT * FROM social_actions WHERE (friend_id = $1 AND status = $2) LIMIT $3;";
		var queryParams = [userSocialId, "active", limit];
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
// marks inactive any active gifts for friends and returns update count.
// NOTE: in the future you may first want to run a query to sum request_num_data_1
// and then return that as well so you could have various actions with various rewards

SocialActionsDB.prototype.claimGiftsForSocialId = function(userSocialId, requestType, callback)
{

	var self = this;


	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err, null);
			return;
		}

		var queryStr = "UPDATE social_actions SET status = $1 WHERE (friend_id = $2 AND status = $3);";
		var queryParams = ["inactive", userSocialId, "active"];

		if(!Utils.isEmptyString(requestType))
		{
			var splitArray = requestType.split("|");
			var argIndex = 4;
			var argArray = [];
			splitArray.forEach(function(element, index, array) {
				var argStr = "$" + argIndex;
				argArray.push(argStr);
				queryParams.push(element);
				argIndex++;
			});

			var argStr = argArray.join(",");

			queryStr = "UPDATE social_actions SET status = $1 WHERE (friend_id = $2 AND status = $3 AND request_type in (%s));";
			queryStr = util.format(queryStr, argStr);
		}

		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				callback(err, null);
				return;
			}

			// we need to return the row count
			var resultObj = {};
			resultObj["count"] = result.rowCount;
			callback(null, resultObj);


		});//query()
	});//connect()

};

//--------------------------------------------------
SocialActionsDB.prototype.testClearDatabase = function(callback)
{
	var connectString = this._mConnectString;
	var queryStr = "DELETE from social_actions";
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

			LOGDEBUG("** deleted all records in social_actions for testing **");
			callback(null, resultObj);

		});//query()
	});//connect()

};

//--------------------------------------------------
// send a user_uuid to delete
SocialActionsDB.prototype.testAPIClearDatabase = function(uuid,callback)
{
	var connectString = this._mConnectString;
	var queryStr = "DELETE from social_actions where user_uuid=$1";
	var queryParams = [uuid];

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

			LOGDEBUG("** deleted social_actions for API testing **");
			callback(null, resultObj);

		});//query()
	});//connect()

};

//--------------------------------------------------
// send a user_uuid to delete
SocialActionsDB.prototype.testUpdateQuery = function(inQuery,inQueryParams, callback)
{
	var connectString = this._mConnectString;

	PG.connect(connectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		client.query(inQuery, inQueryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results?
			var resultObj = result;

			LOGDEBUG("** updated social_actions for API testing **");
			callback(null, resultObj);

		});//query()
	});//connect()

};

///////////////////////////////////////////////////////
// Private Util Methods

//-----------------------------------------------------
function createInsertUpdateQuery(inType, socialActionObj)
{
	/*
	 "uid": inUID || null,
	 "app": inApp,
	 "date_update": dateUpdate,

	 "status": status || "active",
	 "user_uuid": userUUID,			// required
	 "friend_id": friendId,			// required

	 "request_type": requestType || "",
	 "request_text_data_1": requestTextData1 || "",
	 "request_num_data_1": requestNumData1 || 0
	 */

	var queryParams = [


		socialActionObj.status,
		socialActionObj.user_uuid,
		socialActionObj.user_social_id,
		socialActionObj.friend_id,
		socialActionObj.request_type,
		socialActionObj.request_text_data_1,
		socialActionObj.request_num_data_1,
		socialActionObj.fname,
		socialActionObj.lname
	];

	var queryStr;
	if(inType == "UPDATE")
	{
		queryStr = "UPDATE social_actions SET (date_update, status, user_uuid, user_social_id, friend_id, request_type, request_text_data_1, request_num_data_1, fname, lname) = (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9) WHERE uid=$10;";

		var primaryKey = socialActionObj.uid;
		queryParams.push(primaryKey);
	}
	else
	{
		queryStr = "INSERT INTO social_actions(date_create, date_update, status, user_uuid, user_social_id, friend_id, request_type, request_text_data_1, request_num_data_1, fname, lname, app) "
			+ "VALUES (now(), now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10);";
		var app = socialActionObj.app;
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