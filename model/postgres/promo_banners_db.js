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
var Utils = require("../../lib/utils.js");

///////////////////////////////////////////////////////
// Const



///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES PROMO BANNERS ===");

	var retObj = new PromoBannersDB(inName, inConnectString);
	return retObj;
};

///////////////////////////////////////////////////////
function PromoBannersDB(inName, inConnectString)
{

	this._mName = inName;
	this._mConnectString = inConnectString;
}

//--------------------------------------------------
PromoBannersDB.prototype.testClearDatabase = function(callback)
{
	var connectString = this._mConnectString;
	var queryStr = "DELETE from promo_banners";
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

			LOGDEBUG("** deleted all records in promobanners for testing **");
			callback(null, resultObj);

		});//query()
	});//connect()

};

//--------------------------------------------------
PromoBannersDB.prototype.createPromoBannerObject = function(inUID,
															app,
															bannerName,
															status,
															bannerType,
															platform,
															rank,
															notes,
															rule_is_monetizer,
															rule_recency,
															rule_gender,
															rule_location,
															rule_date_start,
															rule_date_end,
															title,
															message,
															mediaUrl,
															bannerAction,
															bannerActionArg1,
															bannerActionArg2,

															rule_frequency


	)
{

	// convert the rule dates from strings to date objects
	var ruleDateStart = rule_date_start;
	if(Utils.isEmptyString(ruleDateStart)) {
		ruleDateStart = null;
	}


	var ruleDateEnd = rule_date_end;
	if(Utils.isEmptyString(ruleDateEnd)) {
		ruleDateEnd = null;
	}

	// massage rule frequency
	var ruleFrequency = parseInt(rule_frequency);
	if(ruleFrequency < 1) {
		ruleFrequency = 1;
	}


	var retObject = {

		"uid": inUID || null,
		"app": app,

		"name": bannerName || "",
		"status": status || "active",
		"banner_type": bannerType || "",
		"platform": platform || "",
		"rank": rank || 0,
		"notes": notes || "",

		"rule_is_monetizer": rule_is_monetizer || "",
		"rule_recency": rule_recency,
		"rule_gender": rule_gender || "",
		"rule_location": rule_location || "",
		"rule_date_start": ruleDateStart,
		"rule_date_end": ruleDateEnd,


		"title": title || "",
		"message": message || "",
		"media_url": mediaUrl || "",

		"banner_action": bannerAction || "",
		"banner_action_arg1": bannerActionArg1 || "",
		"banner_action_arg2": bannerActionArg2 || "",

		"rule_frequency": ruleFrequency
	};
	return retObject;
};

//--------------------------------------------------
// saves promobanner. Will insert or update depending on if exists
PromoBannersDB.prototype.savePromoBannerObject = function(promoBannerObj, callback)
{
	var self = this;

	var needsInsert = false;
	var uid = promoBannerObj["uid"];

	self.findOne(uid, function(err, result){

		if(err || !result) {
			needsInsert = true;
		}

		if(needsInsert)
		{
			self.insertPromoBannerObject(promoBannerObj, function(err, result) {
				callback(err, result);
			});//insertPromoBannerObject
		}
		else
		{
			self.updatePromoBannerObject(promoBannerObj, function(err, result) {
				callback(err, result);
			});//updatePromoBannerObject
		}

	});//findOne()
};
//--------------------------------------------------
// find promobanner. Will insert or update depending on if exists
PromoBannersDB.prototype.findOne = function(uid, callback)
{
	// if the uid is null, fail immediately
	if(!uid) {
		callback("null uid, need to create", null);
		return;
	}


	var self = this;
	var queryStr = "SELECT * from promo_banners where uid = $1;";
	var queryParams = [uid];
	QueryHelpers.findOne(self._mConnectString, queryStr, queryParams, callback);

};
//--------------------------------------------------
// find promobanner. Will insert or update depending on if exists
PromoBannersDB.prototype.findOneByName = function(name, callback)
{

	var self = this;
	var queryStr = "SELECT * from promo_banners where name = $1;";
	var queryParams = [name];
	QueryHelpers.findOne(self._mConnectString, queryStr, queryParams, callback);

};
//--------------------------------------------------
// find all ACTIVE and return as json
PromoBannersDB.prototype.getActivePromoJSON = function(callback)
{
	var self = this;

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err, null);
			return;
		}

		var queryStr = "SELECT * FROM promo_banners WHERE status=$1 ORDER BY rank ASC, name ASC;";
		var queryParams = ["active"];

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
// find based on status (active, inactive)
PromoBannersDB.prototype.getPromoBannersByStatus = function(inStatus, callback)
{
	var self = this;

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err, null);
			return;
		}

		var queryParams = [];
		var queryStr = "SELECT * FROM promo_banners ORDER BY status ASC, rank ASC;";
		if(inStatus) {
			queryStr = 'SELECT * from promo_banners where status=$1 ORDER BY status ASC, rank ASC;';
			queryParams.push(inStatus);
		}

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
// saves promobanner. Will insert or update depending on if exists
PromoBannersDB.prototype.insertPromoBannerObject = function(promoBannerObj, callback)
{
	var qObj = createInsertUpdateQuery("INSERT", promoBannerObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};
//--------------------------------------------------
// saves promobanner. Will insert or update depending on if exists
PromoBannersDB.prototype.updatePromoBannerObject = function(promoBannerObj, callback)
{
	var qObj = createInsertUpdateQuery("UPDATE", promoBannerObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];

	var self = this;
	QueryHelpers.upsertQuery(self._mConnectString, queryStr, queryParams, callback);
};

//--------------------------------------------------
PromoBannersDB.prototype.setStatus = function(uid, status, callback)
{
	var validStatus = {
		"active": 1,
		"inactive": 1
	};
	if(!validStatus[status])
	{
		var errStr = "setStatus, invalid status: " + status;
		LOGERROR(errStr);
		callback(errStr);
		return;
	}

	var self = this;

	var queryStr = "UPDATE promo_banners SET status=$1 WHERE uid = $2";
	var queryParams = [status, uid];

	PG.connect(self._mConnectString, function(err, client, done) {

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

			LOGDEBUG("updated record");
			callback(null);
		});//query()
	});//connect()

};


///////////////////////////////////////////////////////
// Private Util Methods

//-----------------------------------------------------
function createInsertUpdateQuery(inType, promoBannerObj)
{
	/*
	 "uid": inUID || null,
	 "app": app,

	 "status": status || "ACTIVE",
	 "banner_type": bannerType || "",
	 "platform": platform || "",
	 "rank": rank || 0,
	 "notes": notes || "",
	 "rules": rules || "",

	 "title": title || "",
	 "message": message || "",
	 "media_url": mediaUrl || "",

	 "banner_action": bannerAction || "",
	 "banner_action_arg1": bannerActionArg1 || "",
	 "banner_action_arg2": bannerActionArg2 || ""
	 */

	var queryParams = [

		promoBannerObj.name,
		promoBannerObj.status,
		promoBannerObj.banner_type,
		promoBannerObj.platform,
		promoBannerObj.rank,
		promoBannerObj.notes,
		promoBannerObj.rule_is_monetizer,
		promoBannerObj.rule_recency,
		promoBannerObj.rule_gender,
		promoBannerObj.rule_location,
		promoBannerObj.rule_date_start,
		promoBannerObj.rule_date_end,

		promoBannerObj.title,
		promoBannerObj.message,
		promoBannerObj.media_url,
		promoBannerObj.banner_action,
		promoBannerObj.banner_action_arg1,
		promoBannerObj.banner_action_arg2,

		promoBannerObj.rule_frequency

	];

	var queryStr;
	if(inType == "UPDATE")
	{
		queryStr = "UPDATE promo_banners SET (name, status, banner_type, platform, rank, notes, rule_is_monetizer, rule_recency, rule_gender, rule_location, rule_date_start, rule_date_end, title, message, media_url, banner_action, banner_action_arg1, banner_action_arg2, rule_frequency) = ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) WHERE uid=$20;";

		var primaryKey = promoBannerObj.uid;
		queryParams.push(primaryKey);
	}
	else
	{
		queryStr = "INSERT INTO promo_banners(date_create, name, status, banner_type, platform, rank, notes, rule_is_monetizer, rule_recency, rule_gender, rule_location, rule_date_start, rule_date_end, title, message, media_url, banner_action, banner_action_arg1, banner_action_arg2, rule_frequency, app) "
			+ "VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20);";
		var app = promoBannerObj.app;
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